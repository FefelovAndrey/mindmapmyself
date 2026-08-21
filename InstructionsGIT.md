# Запуск скрипта снимка данных

**Из корня проекта:**

```bash
cd /home/fefelovandrey/MindMap
./scripts/snapshot-data.sh
```

Если «Permission denied»:

```bash
chmod +x scripts/snapshot-data.sh
./scripts/snapshot-data.sh
```

**Что делает скрипт:**
1. Проверяет, что есть `data/mindmap.json`
2. Переключается на ветку `data/snapshots`
3. Коммитит изменения (если они есть)
4. Пушит на GitLab
5. Возвращает вас на прежнюю ветку (например `feature/map-view`)

Если за день данные не менялись, увидите: `Нет изменений в data/mindmap.json — коммит не нужен`.

**Автоматически раз в день** (например в 23:00):

```bash
crontab -e
```

Добавьте строку:

```cron
0 23 * * * cd /home/fefelovandrey/MindMap && ./scripts/snapshot-data.sh >> /tmp/mindmap-snapshot.log 2>&1
```

---

## Как восстановить данные

Полный снимок есть в ветке `data/snapshots` (коммит `f94438f`, ~1000 строк):

```bash
git show f94438f:data/mindmap.json > data/mindmap.json
```

Или из истории main до merge:

```bash
git show cb71566:data/mindmap.json > data/mindmap.json
```

После этого перезапустите `npm run dev` — дерево должно вернуться.

---

## Как избежать этого в будущем

1. **Перед merge** — снимок: `./scripts/snapshot-data.sh`
2. **После merge** — если файл пропал, восстановить из `data/snapshots`
3. **Перед merge** — скопировать файл вручную: `cp data/mindmap.json data/mindmap.json.bak`


При merge данные пропали из‑за **удаления `data/mindmap.json` из git**, а не из‑за бага в коде карты.

## Что произошло

### 1. Файл данных убрали из репозитория

В ветке `feature/map-view` есть коммит `9d8da48`:

> **chore: не отслеживать рабочие данные mindmap.json на main**

Он делает две вещи:
- добавляет `data/mindmap.json` в `.gitignore`;
- **удаляет файл из git** (~1000 строк дерева задач).

При merge в `main` (коммит `78ca5e4`) git применил это удаление: файл перестал быть в репозитории и **исчез с диска** в рабочей копии.

### 2. Приложение создало пустой файл заново

В `app/api/nodes/route.ts` есть логика `ensureDataFile()`:

```25:38:app/api/nodes/route.ts
async function ensureDataFile(): Promise<MindMapDocument> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = MindMapDocumentSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    const isMissing = err instanceof Error && 'code' in err && err.code === 'ENOENT';
    if (!isMissing) throw err;
  }

  const document = createDefaultDocument();
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(document, null, 2), 'utf-8');
  return document;
}
```

Если файла нет — создаётся **новый пустой документ** с одним корнем «задачи RULI» и `children: []`.

Сейчас у вас именно такой файл (13 строк, пустое дерево). В логах видно смену `rootId` — каждый раз создавался новый пустой документ.

### 3. Почему merge «съел» данные

| До merge | После merge |
|----------|-------------|
| `data/mindmap.json` был в git (~1000 строк) | Файл удалён из git и с диска |
| Данные версионировались | Файл в `.gitignore`, git его не трогает |
| — | При первом запуске API записал пустой шаблон |

Идея была правильная: **рабочие данные не хранить в main**, а делать снимки в ветке `data/snapshots`. Но при merge git **физически удалил** локальный файл, а восстановление из снимка не было сделано автоматически.

---

## Как восстановить данные

Полный снимок есть в ветке `data/snapshots` (коммит `f94438f`, ~1000 строк):

```bash
git show f94438f:data/mindmap.json > data/mindmap.json
```

Или из истории main до merge:

```bash
git show cb71566:data/mindmap.json > data/mindmap.json
```

После этого перезапустите `npm run dev` — дерево должно вернуться.

---

## Как избежать этого в будущде

1. **Перед merge** — снимок: `./scripts/snapshot-data.sh`
2. **После merge** — если файл пропал, восстановить из `data/snapshots`
3. **Перед merge** — скопировать файл вручную: `cp data/mindmap.json data/mindmap.json.bak`

Могу восстановить `data/mindmap.json` из ветки `data/snapshots` прямо сейчас — напишите, если нужно.
