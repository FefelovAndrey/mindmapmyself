'use client';

import type { FilterState } from '@/hooks/useTree';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  responsibles: string[];
  filters: FilterState;
  matchCount: number | null;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export default function FilterBar({
  responsibles,
  filters,
  matchCount,
  onChange,
  onReset,
}: FilterBarProps) {
  const hasActive = filters.responsible !== null || filters.status !== null;

  return (
    <div className={styles.bar}>
      <div className={styles.filterGroup}>
        <span className={styles.label}>Ответственный:</span>
        <select
          className={`${styles.select} ${filters.responsible ? styles.active : ''}`}
          value={filters.responsible ?? ''}
          onChange={(e) => onChange({ ...filters, responsible: e.target.value || null })}
        >
          <option value="">Все</option>
          {responsibles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.label}>Статус:</span>
        <select
          className={`${styles.select} ${filters.status ? styles.active : ''}`}
          value={filters.status ?? ''}
          onChange={(e) => onChange({ ...filters, status: e.target.value || null })}
        >
          <option value="">Все</option>
          <option value="New">New</option>
          <option value="Done">Done</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {hasActive && (
        <button className={styles.resetBtn} onClick={onReset}>
          × Сбросить
        </button>
      )}

      {hasActive && matchCount !== null && (
        <span className={styles.resultCount}>
          {matchCount === 0 ? 'Нет результатов' : `Найдено: ${matchCount}`}
        </span>
      )}
    </div>
  );
}
