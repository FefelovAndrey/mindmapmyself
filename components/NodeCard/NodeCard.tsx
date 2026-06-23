'use client';

import { useState, useEffect } from 'react';
import type { MindNode, Status } from '@/types/node';
import styles from './NodeCard.module.css';

const MAX_DESCRIPTION = 2000;

interface NodeCardProps {
  node: MindNode | null;
  nodeNumber: string | null;
  onChange: (patch: Partial<Omit<MindNode, 'id' | 'children'>>) => void;
}

export default function NodeCard({ node, nodeNumber, onChange }: NodeCardProps) {
  const [localName, setLocalName] = useState('');
  const [localResponsible, setLocalResponsible] = useState('');
  const [localDescription, setLocalDescription] = useState('');

  useEffect(() => {
    if (node) {
      setLocalName(node.name);
      setLocalResponsible(node.responsible ?? '');
      setLocalDescription(node.description ?? '');
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Выберите узел</div>
      </div>
    );
  }

  const descLen = localDescription.length;
  const descWarning = descLen > MAX_DESCRIPTION * 0.9;

  function commitName() {
    const name = localName.trim();
    if (name && name !== node!.name) onChange({ name });
    else setLocalName(node!.name);
  }

  function commitResponsible() {
    const responsible = localResponsible.trim() || null;
    if (responsible !== node!.responsible) onChange({ responsible });
  }

  function commitDescription() {
    const description = localDescription.trim() || null;
    if (description !== node!.description) onChange({ description });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {nodeNumber && <div className={styles.nodeNumber}>{nodeNumber}</div>}
        <input
          className={styles.nameField}
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitName(); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setLocalName(node.name); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder="Название узла"
        />
      </div>

      <div className={styles.fields}>
        <div className={styles.fieldRow}>
          <label className={styles.label}>Ответственный</label>
          <input
            className={styles.input}
            value={localResponsible}
            onChange={(e) => setLocalResponsible(e.target.value)}
            onBlur={commitResponsible}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitResponsible(); }
            }}
            placeholder="Не указан"
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label}>Статус</label>
          <select
            className={styles.select}
            value={node.status ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ status: val ? (val as Status) : null });
            }}
          >
            <option value="">— не указан —</option>
            <option value="New">New</option>
            <option value="Done">Done</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.label}>Срок выполнения</label>
          <input
            className={styles.input}
            type="date"
            value={node.deadline ?? ''}
            onChange={(e) => {
              onChange({ deadline: e.target.value || null });
            }}
          />
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.descriptionSection}>
        <div className={styles.descriptionLabel}>
          <span>Описание</span>
          <span className={descWarning ? styles.charCountWarning : styles.charCount}>
            {descLen}/{MAX_DESCRIPTION}
          </span>
        </div>
        <textarea
          className={styles.textarea}
          value={localDescription}
          onChange={(e) => {
            if (e.target.value.length <= MAX_DESCRIPTION) {
              setLocalDescription(e.target.value);
            }
          }}
          onBlur={commitDescription}
          placeholder="Описание узла..."
        />
      </div>
    </div>
  );
}
