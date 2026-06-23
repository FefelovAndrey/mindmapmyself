# Decision — Architecture Decision Record
## Mind Map Editor (задачи RULI)

**Версия:** 1.1  
**Дата:** 23.06.2026

---

## 1. Тип приложения

**Решение:** локальное веб-приложение  
**Запуск:** `npm run dev` → открыть браузер вручную на `localhost:3000`

**Альтернативы, которые рассматривались:**

| Вариант | Плюсы | Минусы | Решение |
|---------|-------|--------|---------|
| Веб-приложение (выбрано) | Просто запустить, не нужна установка, легко расширять | Нужен Node.js | ✅ |
| Electron (десктоп) | Выглядит как обычная программа | Сложнее в сборке, тяжелее | ❌ |
| Только браузер (без сервера) | Нет зависимостей | Нет доступа к файловой системе напрямую | ❌ |

---

## 2. Технологический стек

### Framework
- **Next.js App Router** + **TypeScript**
- Один процесс, один порт, одна команда `npm run dev`
- API route handlers встроены — отдельный Express не нужен

### Frontend
- **React 18** (через Next.js) — компонентный UI
- Интерактивные компоненты помечаются `'use client'`
- **CSS Modules** — стили без конфликтов, без лишних зависимостей

### Backend (Route Handlers, App Router)
- `app/api/nodes/route.ts` — `export async function GET()` / `POST()`
- Файловый I/O через встроенный Node.js `fs`
- Web Request/Response API (не NextApiRequest/NextApiResponse — это Pages Router)

### Валидация данных
- **`zod`** — валидация JSON на входе API (`POST`); TypeScript-типы выводятся из zod-схем

### Хранение данных
- **JSON-файл на диске** (`data/mindmap.json`)
- Автосохранение при каждом изменении
- **Принятое ограничение:** конкурентная запись не поддерживается — приложение рассчитано на одного пользователя

### npm-зависимости проекта

| Пакет | Назначение |
|-------|-----------|
| `next`, `react`, `react-dom` | основной фреймворк |
| `typescript` | типизация |
| `zod` | валидация схемы данных на API |
| `adm-zip` | распаковка `.mmap` (ZIP-архив) при импорте |
| `fast-xml-parser` | парсинг `Document.xml` при импорте |
| `uuid` | генерация UUID для новых узлов |

### Почему Next.js App Router, а не Pages Router
- App Router — актуальный стандарт Next.js 13+
- Route Handlers с именованными экспортами `GET`/`POST` вместо `export default handler`
- Совместим со скиллами и best practices

### Почему Next.js, а не React + Vite
- Не нужен отдельный Express-сервер — API встроено
- Меньше конфигурации (`concurrently`, proxy, CORS)
- Один `npm run dev` запускает всё

---

## 3. Формат хранения данных

**Решение:** JSON-файл с вложенной структурой

**Почему не SQLite:** дерево с произвольной вложенностью удобнее хранить как вложенный JSON, а не в реляционных таблицах. JSON читается глазами, легко бэкапить и версионировать в git.

**Почему не localStorage браузера:** данные теряются при очистке браузера, нет нормального бэкапа.

### TypeScript-типы (выводятся из zod-схем)

```typescript
// types/node.ts

type Status = 'New' | 'Done' | 'Cancelled';

interface MindNode {
  id: string;           // UUID v4
  name: string;
  description: string | null;   // макс. 2000 символов
  responsible: string | null;
  status: Status | null;
  deadline: string | null;      // ISO 8601: "2026-06-30"
  children: MindNode[];         // [] для листовых узлов
}

interface MindMapDocument {
  version: string;      // "1.0"
  updatedAt: string;    // ISO 8601 datetime
  root: MindNode;
}
```

### Схема JSON (пример)

```json
{
  "version": "1.0",
  "updatedAt": "2026-06-23T09:00:00Z",
  "root": {
    "id": "uuid-v4",
    "name": "задачи RULI",
    "description": null,
    "responsible": null,
    "status": null,
    "deadline": null,
    "children": [
      {
        "id": "uuid-v4",
        "name": "Проекты",
        "description": null,
        "responsible": null,
        "status": null,
        "deadline": null,
        "children": []
      }
    ]
  }
}
```

**Ключевые решения по схеме:**
- `id` — UUID, генерируется при создании узла, не меняется никогда
- Номер (`1.1.2`) — **не хранится**, вычисляется из позиции в дереве при рендеринге
- `children: []` — пустой массив для листовых узлов (не `null`)
- `status` — одно из значений: `"New"` | `"Done"` | `"Cancelled"` | `null`
- `deadline` — строка ISO 8601: `"2026-06-30"` | `null`

---

## 4. Структура проекта

```
MindMap/
├── requirements/
│   ├── BRD.md
│   └── Decision.md
├── plans/
│   ├── DevPlan.md
│   ├── TestCases.md
│   └── Review.md
├── data/
│   └── mindmap.json              ← данные приложения
├── TasksRULI_23062026.mmap       ← исходный файл для импорта (103 узла)
├── app/
│   ├── layout.tsx                ← корневой layout
│   ├── page.tsx                  ← главная страница
│   └── api/
│       └── nodes/
│           └── route.ts          ← GET (читать) / POST (записать) JSON
├── components/
│   ├── TreeOutline/              ← дерево с отступами ('use client')
│   ├── NodeCard/                 ← карточка атрибутов узла ('use client')
│   └── FilterBar/                ← фильтры ('use client')
├── hooks/
│   └── useKeyboard.ts            ← горячие клавиши
├── hooks/
│   └── useTree.ts                ← логика дерева: добавление, удаление, нумерация
├── types/
│   └── node.ts                   ← TypeScript-типы (MindNode, MindMapDocument)
├── scripts/
│   └── import-mmap.ts            ← разовый скрипт импорта из .mmap
├── package.json
└── next.config.ts
```

---

## 5. Импорт из .mmap

**Решение:** разовый скрипт `scripts/import-mmap.ts`

- Источник: `TasksRULI_23062026.mmap` из корня проекта `MindMap/` (103 узла)
- Читает файл как ZIP-архив (`adm-zip`)
- Распаковывает `Document.xml`
- Парсит XML (`fast-xml-parser`), обходит теги `<ap:Topic>` → `<ap:Text PlainText="...">`
- Строит вложенное дерево `MindNode[]`, генерирует UUID для каждого узла (`uuid`)
- Записывает в `data/mindmap.json`
- Атрибуты (Ответственный, Статус, Срок) при импорте остаются `null` — заполняются вручную

**Запуск:** `npm run import`  
**Повторный запуск:** перезаписывает `mindmap.json` (не дублирует узлы)

---

## 6. Горячие клавиши — реализация

Обрабатываются через `keydown` на уровне компонента дерева (`hooks/useKeyboard.ts`). При редактировании названия (inline input) глобальные клавиши отключаются, активны только `Enter` (сохранить) и `Escape` (отменить). `Tab` перехватывается с `event.preventDefault()` только когда фокус на узле дерева.

| Клавиша | Действие в коде | На корне |
|---------|-----------------|----------|
| `Enter` | `addSiblingAfter(selectedId)` | `startEditInline(rootId)` |
| `Shift+Enter` | `addSiblingBefore(selectedId)` | игнорируется |
| `Tab` | `addChild(selectedId)` | разрешено |
| `Delete` | `removeNode(selectedId)` | запрещено |
| `F2` | `startEditInline(selectedId)` | разрешено |
| `Escape` | `cancelEdit(selectedId)` | разрешено |
| `→` | `expand(selectedId)` | разрешено |
| `←` | `collapse(selectedId)` | разрешено |

---

## 7. Что отложено на следующие версии

- Drag-and-drop перемещение узлов
- Визуальная радиальная карта (mind map)
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- Синхронизация с Yandex Tracker
- Дополнительные атрибуты узлов
- Поиск по тексту
