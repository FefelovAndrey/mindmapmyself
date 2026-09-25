'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { MapNodeData } from './mapLayout';
import styles from './MapNode.module.css';

function MapNodeComponent({ data, selected }: NodeProps<Node<MapNodeData>>) {
  const statusClass =
    data.status === 'New'
      ? styles.statusNew
      : data.status === 'Done'
        ? styles.statusDone
        : data.status === 'Cancelled'
          ? styles.statusCancelled
          : null;

  const cardClass = [
    styles.card,
    selected ? styles.selected : '',
    data.dimmed ? styles.dimmed : '',
    data.parentContext ? styles.parentContext : '',
    data.status === 'Done' ? styles.done : '',
    data.status === 'Cancelled' ? styles.cancelled : '',
    data.priority === 1 ? styles.priority1 : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={cardClass} data-priority={data.priority ?? ''}>
        <div className={styles.header}>
          <div className={styles.number}>{data.number}</div>
          {data.priority != null && (
            <span
              className={`${styles.priorityBadge} ${
                data.priority === 1 ? styles.priorityHigh : styles.priorityQuiet
              }`}
              aria-label={`Приоритет ${data.priority}`}
            >
              {data.priority}
            </span>
          )}
        </div>
        <div className={styles.name}>{data.name}</div>
        {data.responsible && (
          <div className={styles.responsible}>{data.responsible}</div>
        )}
        {data.status && statusClass && (
          <span className={`${styles.statusBadge} ${statusClass}`}>{data.status}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </>
  );
}

export default memo(MapNodeComponent);
