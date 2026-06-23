# Decision — Map View
## Mind Map Editor — вкладка «Карта»

**Версия:** 1.0  
**Дата:** 23.06.2026  
**Связанный BRD:** `requirements/map-view/BRD-MapView.md`

---

## 1. Раскладка и рендер

**Решение:** `@xyflow/react` (React Flow) + `@dagrejs/dagre`

| Критерий | React Flow + dagre |
|----------|-------------------|
| Направление LR | `rankdir: 'LR'` в dagre |
| Zoom | `zoomOnScroll`, `Controls` (+/−) |
| Pan | drag фона (по умолчанию в React Flow) |
| Read-only | `nodesDraggable={false}`, `nodesConnectable={false}` |
| Кастомный блок узла | `nodeTypes.mapNode` — номер, имя, ответственный, статус |

**Альтернативы отклонены:** jsMind/Mind Elixir (радиальная карта, редактирование), чистый CSS (плохо масштабируется на 500 узлов), d3-hierarchy вручную (больше кода на zoom/pan).

---

## 2. Сворачивание веток

**Решение:** **общее** состояние `collapsed` с Outline.

Свернутая в Outline ветка не показывает потомков и на карте (один `Set<string>` в `page.tsx`).

---

## 3. Навигация на карте

**Решение:** zoom обязателен (колёсико + кнопки Controls); pan — drag фона (встроено в React Flow).

`fitView` при первом рендере карты. Отдельная кнопка «вместить на экран» — не в v1.0.

---

## 4. Структура кода

```
components/MapView/
├── MapView.tsx          ← ReactFlow, Controls, Background
├── MapNode.tsx          ← кастомный узел
├── MapNode.module.css
├── mapLayout.ts         ← дерево → nodes/edges, dagre LR
└── MapView.module.css
```

Логика фильтрации переиспользует `filterTree` из `hooks/useTree.ts`.

---

## 5. Зависимости

| Пакет | Назначение |
|-------|------------|
| `@xyflow/react` | canvas, zoom, pan, selection |
| `@dagrejs/dagre` | автоматическая раскладка дерева LR |

---

## 6. Горячие клавиши

На вкладке «Карта» глобальные горячие клавиши Outline **отключены** (`useKeyboard` активен только на вкладке Outline).
