'use client';

import { useRef, useEffect } from 'react';
import type { MindNode } from '@/types/node';
import { calcNumbers, type NumberedNode } from '@/hooks/useTree';
import styles from './TreeOutline.module.css';

interface TreeOutlineProps {
  root: MindNode;
  selectedId: string | null;
  editingId: string | null;
  editingValue: string;
  collapsed: Set<string>;
  filterMap: Map<string, { matched: boolean; hasMatchingDescendant: boolean }> | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onEditStart: (id: string, name: string) => void;
  onEditChange: (value: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}

export default function TreeOutline({
  root,
  selectedId,
  editingId,
  editingValue,
  collapsed,
  filterMap,
  onSelect,
  onToggleCollapse,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
}: TreeOutlineProps) {
  const numbered = calcNumbers(root);

  return (
    <div className={styles.container}>
      <NodeRow
        node={numbered}
        depth={0}
        selectedId={selectedId}
        editingId={editingId}
        editingValue={editingValue}
        collapsed={collapsed}
        filterMap={filterMap}
        onSelect={onSelect}
        onToggleCollapse={onToggleCollapse}
        onEditStart={onEditStart}
        onEditChange={onEditChange}
        onEditCommit={onEditCommit}
        onEditCancel={onEditCancel}
      />
    </div>
  );
}

interface NodeRowProps {
  node: NumberedNode;
  depth: number;
  selectedId: string | null;
  editingId: string | null;
  editingValue: string;
  collapsed: Set<string>;
  filterMap: Map<string, { matched: boolean; hasMatchingDescendant: boolean }> | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onEditStart: (id: string, name: string) => void;
  onEditChange: (value: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}

function NodeRow({
  node,
  depth,
  selectedId,
  editingId,
  editingValue,
  collapsed,
  filterMap,
  onSelect,
  onToggleCollapse,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
}: NodeRowProps) {
  const isCollapsed = collapsed.has(node.id);
  const isSelected = selectedId === node.id;
  const isEditing = editingId === node.id;
  const inputRef = useRef<HTMLInputElement>(null);

  const filterInfo = filterMap?.get(node.id);
  const isDimmed = filterMap !== null && filterInfo !== undefined
    ? !filterInfo.matched && !filterInfo.hasMatchingDescendant
    : false;
  const isParentContext = filterMap !== null && filterInfo !== undefined
    ? !filterInfo.matched && filterInfo.hasMatchingDescendant
    : false;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const statusClass = node.status === 'New'
    ? styles.statusNew
    : node.status === 'Done'
    ? styles.statusDone
    : node.status === 'Cancelled'
    ? styles.statusCancelled
    : null;

  const rowClass = [
    styles.node,
    isSelected ? styles.selected : '',
    (isDimmed && !isParentContext) ? styles.dimmed : '',
    node.status === 'Done' ? styles.done : '',
    node.status === 'Cancelled' ? styles.cancelled : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={rowClass}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => !isDimmed && onSelect(node.id)}
        onDoubleClick={() => !isDimmed && onEditStart(node.id, node.name)}
        data-node-id={node.id}
      >
        {/* Кнопка сворачивания */}
        {node.children.length > 0 ? (
          <button
            className={styles.toggleBtn}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
            tabIndex={-1}
            aria-label={isCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className={styles.togglePlaceholder} />
        )}

        <div className={styles.content}>
          <span className={styles.number}>{node.number}</span>

          {isEditing ? (
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={editingValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onEditCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); }
              }}
              onBlur={onEditCommit}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={styles.name}
              style={{ opacity: isParentContext ? 0.5 : 1 }}
            >
              {node.name}
            </span>
          )}

          <div className={styles.badges}>
            {node.status && statusClass && (
              <span className={`${styles.statusBadge} ${statusClass}`}>
                {node.status}
              </span>
            )}
            {node.responsible && (
              <span className={styles.responsible}>{node.responsible}</span>
            )}
            {node.deadline && (
              <span className={styles.deadline}>{node.deadline}</span>
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && (node.children as NumberedNode[]).map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          editingId={editingId}
          editingValue={editingValue}
          collapsed={collapsed}
          filterMap={filterMap}
          onSelect={onSelect}
          onToggleCollapse={onToggleCollapse}
          onEditStart={onEditStart}
          onEditChange={onEditChange}
          onEditCommit={onEditCommit}
          onEditCancel={onEditCancel}
        />
      ))}
    </>
  );
}
