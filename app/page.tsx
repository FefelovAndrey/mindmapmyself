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
  type FilterState,
} from '@/hooks/useTree';
import { useKeyboard } from '@/hooks/useKeyboard';
import TreeOutline from '@/components/TreeOutline/TreeOutline';
import NodeCard from '@/components/NodeCard/NodeCard';
import FilterBar from '@/components/FilterBar/FilterBar';
import styles from './page.module.css';

type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

export default function HomePage() {
  const [doc, setDoc] = useState<MindMapDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginal, setEditingOriginal] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({ responsible: null, status: null });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загрузка данных при старте
  useEffect(() => {
    fetch('/api/nodes')
      .then((r) => r.json())
      .then((data: MindMapDocument) => {
        setDoc(data);
        setSelectedId(data.root.id);
      })
      .catch(() => setSaveStatus('error'));
  }, []);

  // Автосохранение с дебаунсом 500мс
  const scheduleSave = useCallback((document: MindMapDocument) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
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
    }, 500);
  }, []);

  function updateTree(newRoot: MindNode) {
    if (!doc) return;
    const newDoc = { ...doc, root: newRoot };
    setDoc(newDoc);
    scheduleSave(newDoc);
  }

  // Навигация по плоскому списку
  const flatList = useMemo(() => {
    if (!doc) return [];
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
  useKeyboard(editingId === null, {
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
  const hasActiveFilter = filters.responsible !== null || filters.status !== null;
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

  const saveLabel =
    saveStatus === 'saving' ? 'Сохраняется...' :
    saveStatus === 'saved' ? 'Сохранено' :
    saveStatus === 'error' ? 'Ошибка сохранения' :
    '';

  const saveLabelClass =
    saveStatus === 'saving' ? styles.saveIndicatorSaving :
    saveStatus === 'error' ? styles.saveIndicatorError :
    styles.saveIndicator;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.title}>Mind Map Editor — задачи RULI</span>
        <span className={saveLabelClass}>{saveLabel}</span>
      </header>

      <div className={styles.body}>
        <div className={styles.treePanel}>
          <FilterBar
            responsibles={responsibles}
            filters={filters}
            matchCount={matchCount}
            onChange={setFilters}
            onReset={() => setFilters({ responsible: null, status: null })}
          />
          <div className={styles.treeContent}>
            {hasActiveFilter && matchCount === 0 ? (
              <div className={styles.noResults}>Нет результатов</div>
            ) : (
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
            )}
          </div>
        </div>

        <div className={styles.cardPanel}>
          <NodeCard
            node={selectedNode}
            nodeNumber={selectedNumber}
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
