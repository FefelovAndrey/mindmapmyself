'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CollapseHandleData } from './mapLayout';
import styles from './CollapseHandle.module.css';

function CollapseHandleComponent({ data }: NodeProps<Node<CollapseHandleData>>) {
  const label = data.isCollapsed ? String(data.descendantCount) : '−';
  const ariaLabel = data.isCollapsed
    ? `Развернуть ${data.descendantCount} задач`
    : 'Свернуть ветку';

  return (
    <>
      <Handle type="target" position={Position.Left} className={styles.handlePort} />
      <button
        type="button"
        className={styles.button}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {label}
      </button>
      {!data.isCollapsed && (
        <Handle type="source" position={Position.Right} className={styles.handlePort} />
      )}
    </>
  );
}

export default memo(CollapseHandleComponent);
