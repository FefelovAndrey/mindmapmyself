'use client';

import { useEffect, useRef, useState } from 'react';
import type { Status } from '@/types/node';
import { hasActiveFilters, type FilterState } from '@/hooks/useTree';
import styles from './FilterBar.module.css';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'New', label: 'New' },
  { value: 'Done', label: 'Done' },
  { value: 'Cancelled', label: 'Cancelled' },
];

interface FilterBarProps {
  responsibles: string[];
  filters: FilterState;
  matchCount: number | null;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

interface MultiSelectProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
}

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayText =
    selected.length === 0
      ? 'Все'
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} выбрано`;

  const toggle = (value: T) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className={styles.filterGroup} ref={ref}>
      <span className={styles.label}>{label}</span>
      <div className={styles.dropdown}>
        <button
          type="button"
          className={`${styles.trigger} ${isActive ? styles.active : ''}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className={styles.triggerText}>{displayText}</span>
          <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className={styles.menu} role="listbox">
            {options.map((opt) => (
              <label key={opt.value} className={styles.menuItem}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FilterBar({
  responsibles,
  filters,
  matchCount,
  onChange,
  onReset,
}: FilterBarProps) {
  const hasActive = hasActiveFilters(filters);

  const responsibleOptions = responsibles.map((r) => ({ value: r, label: r }));

  return (
    <div className={styles.bar}>
      <MultiSelect
        label="Ответственный:"
        options={responsibleOptions}
        selected={filters.responsibles}
        onChange={(responsibles) => onChange({ ...filters, responsibles })}
      />

      <MultiSelect
        label="Статус:"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
      />

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
