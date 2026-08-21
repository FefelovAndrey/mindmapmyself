'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MindNode, MindMapDocument } from '@/types/node';
import {
  addChild,
  addSiblingAfter,
  addSiblingBefore,
  removeNode,
  updateNode,
  flatIds,
  collectResponsibles,
  filterTree,
  calcNumbers,
  findNode,
  EMPTY_FILTERS,
  hasActiveFilters,
  type FilterState,
} from '@/hooks/useTree';
import { useKeyboard } from '@/hooks/useKeyboard';
import TreeOutline from '@/components/TreeOutline/TreeOutline';
import MapView from '@/components/MapView/MapView';
import NodeCard from '@/components/NodeCard/NodeCard';
import FilterBar from '@/components/FilterBar/FilterBar';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle';
import styles from './page.module.css';

type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';
type SnapshotStatus = 'idle' | 'saving' | 'saved' | 'error';
type ViewMode = 'outline' | 'map';
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

function collectLinkedNodes(node: MindNode): Array<{
  id: string;
  calendarUid: string;
  calendarSyncStopped: boolean;
}> {
  const out: Array<{
    id: string;
    calendarUid: string;
    calendarSyncStopped: boolean;
  }> = [];
  function walk(n: MindNode) {
    if (n.calendarUid) {
      out.push({
        id: n.id,
        calendarUid: n.calendarUid,
        calendarSyncStopped: Boolean(n.calendarSyncStopped),
      });
    }
    n.children.forEach(walk);
  }
  walk(node);
  return out;
}

function applyPatches(
  root: MindNode,
  patches: Array<{ id: string; patch: Partial<Omit<MindNode, 'id' | 'children'>> }>
): MindNode {
  let next = root;
  for (const { id, patch } of patches) {
    next = updateNode(next, id, patch);
  }
  return next;
}

export default function HomePage() {
  const [doc, setDoc] = useState<MindMapDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginal, setEditingOriginal] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('outline');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef<MindMapDocument | null>(null);
  docRef.current = doc;

  // Загрузка данных при старте
  useEffect(() => {
    fetch('/api/nodes')
      .then(async (r) => {
        const data = await r.json();
        // #region agent log
        fetch('http://127.0.0.1:7610/ingest/96800b1d-f0c3-453c-8102-93c2a2a52b11',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'70051d'},body:JSON.stringify({sessionId:'70051d',location:'app/page.tsx:fetch',message:'GET /api/nodes response',data:{ok:r.ok,status:r.status,hasRoot:Boolean(data?.root),keys:Object.keys(data??{}),runId:'post-fix'},timestamp:Date.now(),hypothesisId:'A-B'})}).catch(()=>{});
        // #endregion
        if (!r.ok || !data?.root?.id) {
          setSaveStatus('error');
          return;
        }
        setDoc(data as MindMapDocument);
        setSelectedId(data.root.id);
      })
      .catch(() => setSaveStatus('error'));
  }, []);

  const saveDocument = useCallback(async (document: MindMapDocument) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  // Автосохранение с дебаунсом 500мс
  const scheduleSave = useCallback((document: MindMapDocument) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      void saveDocument(document);
    }, 500);
  }, [saveDocument]);

  const handleSaveClick = useCallback(async () => {
    if (snapshotStatus === 'saving') return;

    // Сначала сбрасываем отложенное автосохранение, чтобы снимок был актуальным
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const pending = docRef.current;
      if (pending) {
        await saveDocument(pending);
      }
    }

    setSnapshotStatus('saving');
    try {
      const res = await fetch('/api/snapshot', { method: 'POST' });
      if (!res.ok) throw new Error('Snapshot failed');
      setSnapshotStatus('saved');
    } catch {
      setSnapshotStatus('error');
    }
  }, [snapshotStatus, saveDocument]);

  function updateTree(newRoot: MindNode) {
    if (!doc) return;
    const newDoc = { ...doc, root: newRoot };
    setDoc(newDoc);
    scheduleSave(newDoc);
  }

  async function syncCalendar() {
    if (!doc) return;
    const linked = collectLinkedNodes(doc.root);
    if (linked.length === 0) {
      setSyncStatus('done');
      setSyncMessage('Нет узлов в календаре');
      return;
    }
    setSyncStatus('syncing');
    setSyncMessage('Синхронизация…');
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: linked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncStatus('error');
        setSyncMessage(data.error || 'Ошибка sync');
        return;
      }
      const patches = (data.results as Array<{
        id: string;
        patch?: Partial<Omit<MindNode, 'id' | 'children'>>;
      }>)
        .filter((r) => r.patch)
        .map((r) => ({ id: r.id, patch: r.patch! }));

      if (patches.length) {
        updateTree(applyPatches(doc.root, patches));
      }

      const { successCount, warningCount, skippedCount, errorCount } = data.summary;
      const skipPart = skippedCount ? `, ${skippedCount} проп.` : '';
      if (errorCount > 0) {
        setSyncStatus('error');
        setSyncMessage(
          `Готово: ${successCount} ок, ${warningCount} предупр.${skipPart}, ${errorCount} ошибок`
        );
      } else if (warningCount > 0 || skippedCount > 0) {
        setSyncStatus('done');
        setSyncMessage(`Готово: ${successCount} ок, ${warningCount} предупр.${skipPart}`);
      } else {
        setSyncStatus('done');
        setSyncMessage(`Синхронизировано: ${successCount}`);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Нет сети или ошибка сервера');
    }
  }

  async function handleStatusDone(node: MindNode) {
    if (!node.calendarUid || node.calendarSyncStopped) return;
    const res = await fetch('/api/calendar/mark-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarUid: node.calendarUid,
        name: node.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ошибка пометки (Done) в календаре');
    }
    const current = docRef.current;
    if (!current) return;
    const patched = updateNode(current.root, node.id, {
      calendarSyncStopped: true,
      calendarSyncedAt: data.calendarSyncedAt ?? new Date().toISOString(),
      ...(data.calendarUid === null ? { calendarUid: null } : {}),
    });
    const newDoc = { ...current, root: patched };
    setDoc(newDoc);
    scheduleSave(newDoc);
  }

  // Навигация по плоскому списку
  const flatList = useMemo(() => {
    if (!doc) return [];
    // #region agent log
    fetch('http://127.0.0.1:7610/ingest/96800b1d-f0c3-453c-8102-93c2a2a52b11',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'70051d'},body:JSON.stringify({sessionId:'70051d',location:'app/page.tsx:flatList',message:'flatList compute',data:{hasDoc:Boolean(doc),hasRoot:Boolean(doc?.root),rootId:doc?.root?.id??null,runId:'post-fix'},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!doc.root) return [];
    return flatIds(doc.root, collapsed);
  }, [doc, collapsed]);

  function selectAdjacentNode(currentId: string, direction: 'prev' | 'next'): string | null {
    const idx = flatList.indexOf(currentId);
    if (idx === -1) return null;
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    return flatList[nextIdx] ?? null;
  }

  // Inline редактирование
  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingValue(name);
    setEditingOriginal(name);
  }

  function commitEdit() {
    if (!editingId || !doc) return;
    const name = editingValue.trim();
    if (name && name !== editingOriginal) {
      updateTree(updateNode(doc.root, editingId, { name }));
    }
    setEditingId(null);
    setEditingValue('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue('');
  }

  // Горячие клавиши
  useKeyboard(editingId === null && viewMode === 'outline', {
    onEnter: () => {
      if (!selectedId || !doc) return;
      if (selectedId === doc.root.id) {
        startEdit(selectedId, doc.root.name);
        return;
      }
      const result = addSiblingAfter(doc.root, selectedId);
      if (result) {
        updateTree(result.tree);
        setSelectedId(result.newId);
        setTimeout(() => startEdit(result.newId, 'Новый узел'), 0);
      }
    },
    onShiftEnter: () => {
      if (!selectedId || !doc) return;
      if (selectedId === doc.root.id) return;
      const result = addSiblingBefore(doc.root, selectedId);
      if (result) {
        updateTree(result.tree);
        setSelectedId(result.newId);
        setTimeout(() => startEdit(result.newId, 'Новый узел'), 0);
      }
    },
    onTab: () => {
      if (!selectedId || !doc) return;
      const result = addChild(doc.root, selectedId);
      updateTree(result.tree);
      setSelectedId(result.newId);
      // Разворачиваем родителя
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(selectedId);
        return next;
      });
      setTimeout(() => startEdit(result.newId, 'Новый узел'), 0);
    },
    onDelete: () => {
      if (!selectedId || !doc) return;
      if (selectedId === doc.root.id) return; // корень не удаляем
      const adjacent = selectAdjacentNode(selectedId, 'prev') ?? selectAdjacentNode(selectedId, 'next');
      updateTree(removeNode(doc.root, selectedId));
      setSelectedId(adjacent);
    },
    onF2: () => {
      if (!selectedId || !doc) return;
      const node = findNode(doc.root, selectedId);
      if (node) startEdit(selectedId, node.name);
    },
    onArrowRight: () => {
      if (!selectedId) return;
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(selectedId);
        return next;
      });
    },
    onArrowLeft: () => {
      if (!selectedId) return;
        setCollapsed((prev) => new Set(Array.from(prev).concat(selectedId)));
    },
  });

  // Фильтрация
  const hasActiveFilter = hasActiveFilters(filters);
  const filterMap = useMemo(() => {
    if (!doc || !hasActiveFilter) return null;
    return filterTree(doc.root, filters);
  }, [doc, filters, hasActiveFilter]);

  const matchCount = useMemo(() => {
    if (!filterMap) return null;
    let count = 0;
    filterMap.forEach((v) => { if (v.matched) count++; });
    return count;
  }, [filterMap]);

  const responsibles = useMemo(() => {
    if (!doc) return [];
    return collectResponsibles(doc.root);
  }, [doc]);

  // Вычисляем номер выбранного узла для NodeCard
  const selectedNumber = useMemo(() => {
    if (!doc || !selectedId) return null;
    const numbered = calcNumbers(doc.root);
    function findNum(n: typeof numbered): string | null {
      if (n.id === selectedId) return n.number;
      for (const c of n.children) {
        const r = findNum(c as typeof numbered);
        if (r) return r;
      }
      return null;
    }
    return findNum(numbered);
  }, [doc, selectedId]);

  const selectedNode = useMemo(() => {
    if (!doc || !selectedId) return null;
    return findNode(doc.root, selectedId);
  }, [doc, selectedId]);

  if (!doc) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  const snapshotLabel =
    snapshotStatus === 'saving' ? 'Сохранение...' :
    snapshotStatus === 'saved' ? 'Сохранить удалось' :
    snapshotStatus === 'error' ? 'Сохранить не удалось, попробуйте позже' :
    '';

  const autosaveLabel =
    snapshotLabel ? '' :
    saveStatus === 'saving' ? 'Сохраняется...' :
    saveStatus === 'saved' ? 'Сохранено' :
    saveStatus === 'error' ? 'Ошибка сохранения' :
    '';

  const statusLabel = snapshotLabel || autosaveLabel;

  const statusLabelClass =
    snapshotStatus === 'saved' ? styles.saveIndicatorSuccess :
    snapshotStatus === 'error' || (!snapshotLabel && saveStatus === 'error')
      ? styles.saveIndicatorError :
    snapshotStatus === 'saving' || (!snapshotLabel && saveStatus === 'saving')
      ? styles.saveIndicatorSaving :
    styles.saveIndicator;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.title}>Mind Map Editor — задачи RULI</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.syncButton}
            disabled={syncStatus === 'syncing'}
            onClick={() => void syncCalendar()}
          >
            {syncStatus === 'syncing' ? 'Синхронизация…' : 'Синхронизировать с календарём'}
          </button>
          {syncMessage && (
            <span className={syncStatus === 'error' ? styles.syncMessageError : styles.syncMessage}>
              {syncMessage}
            </span>
          )}
          <span className={statusLabelClass} role="status" aria-live="polite">
            {statusLabel}
          </span>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSaveClick()}
            disabled={snapshotStatus === 'saving'}
            title="Сохранить"
          >
            Сохранить
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.treePanel}>
          <div className={styles.viewTabs}>
            <button
              type="button"
              className={`${styles.viewTab} ${viewMode === 'outline' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('outline')}
            >
              Outline
            </button>
            <button
              type="button"
              className={`${styles.viewTab} ${viewMode === 'map' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('map')}
            >
              Карта
            </button>
          </div>
          <FilterBar
            responsibles={responsibles}
            filters={filters}
            matchCount={matchCount}
            onChange={setFilters}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
          <div className={styles.treeContent}>
            {hasActiveFilter && matchCount === 0 ? (
              <div className={styles.noResults}>Нет результатов</div>
            ) : viewMode === 'outline' ? (
              <TreeOutline
                root={doc.root}
                selectedId={selectedId}
                editingId={editingId}
                editingValue={editingValue}
                collapsed={collapsed}
                filterMap={filterMap}
                onSelect={setSelectedId}
                onToggleCollapse={(id) => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                onEditStart={startEdit}
                onEditChange={setEditingValue}
                onEditCommit={commitEdit}
                onEditCancel={cancelEdit}
              />
            ) : (
              <MapView
                root={doc.root}
                selectedId={selectedId}
                collapsed={collapsed}
                filterMap={filterMap}
                onSelect={setSelectedId}
                onToggleCollapse={(id) => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              />
            )}
          </div>
        </div>

        <div className={styles.cardPanel}>
          <NodeCard
            node={selectedNode}
            nodeNumber={selectedNumber}
            calendarBusy={syncStatus === 'syncing'}
            onStatusDone={handleStatusDone}
            onChange={(patch) => {
              if (!selectedId || !doc) return;
              updateTree(updateNode(doc.root, selectedId, patch));
            }}
          />
        </div>
      </div>
    </div>
  );
}
