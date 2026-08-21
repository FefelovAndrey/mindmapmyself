# Mind Map Editor — задачи RULI

Локальный веб-редактор иерархических задач (mind map / outline) для команды RULI.  
Стек: **Next.js 15**, **React 19**, **TypeScript**. Данные хранятся в `data/mindmap.json` (без БД).

Репозиторий: [github.com/FefelovAndrey/mindmapmyself](https://github.com/FefelovAndrey/mindmapmyself)

## Возможности

- Дерево задач (Outline) с горячими клавишами в стиле MindManager
- Вид **Карта** (схема слева направо)
- Карточка узла: название, описание, ответственный, статус, срок
- Фильтры по ответственному и статусу
- Автосохранение в локальный JSON

## Требования

- Node.js 22+
- npm

## Быстрый старт

```bash
git clone git@github.com:FefelovAndrey/mindmapmyself.git
cd mindmapmyself
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Либо: `./launch.sh` (dev-сервер + браузер).

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер на порту 3000 |
| `npm run build` | Production-сборка (+ проверка типов) |
| `npm start` | Запуск production-сборки |
| `npm test` | Jest-тесты |
| `npm run import` | Импорт `.mmap` → `data/mindmap.json` |
| `npm run migrate-status` | Миграция статусов в данных |

## Данные

- Рабочий файл: `data/mindmap.json` (в `.gitignore`)
- Снимки данных — ветка `data/snapshots`
- Секреты (например, OAuth Яндекс Календаря) — только в `.env.local`, не в git

## Документация

- `requirements/BRD.md` — основные требования
- `requirements/map-view/` — требования к виду «Карта»
- `requirements/фичи yandex-calendar-integration-8811/` — интеграция с Яндекс Календарём
- `Plans/yandex-calendar-api.md` — CalDAV / OAuth
- `AGENTS.md` — заметки для AI-агентов в Cursor

## Ветки

Основная ветка: `main`. Фичи — в отдельных ветках / PR в GitHub.
