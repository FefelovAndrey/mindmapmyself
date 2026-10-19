'use client';

import { useEffect, useState } from 'react';
import type { ResponsibleEntry } from '@/types/node';
import type { DirectoryError } from '@/lib/responsibles';
import styles from './ResponsiblesScreen.module.css';

const ERROR_TEXT: Record<DirectoryError, string> = {
  empty: 'Введите имя',
  duplicate: 'Такое имя уже есть',
};

interface ResponsiblesScreenProps {
  entries: ResponsibleEntry[];
  onAdd: (name: string) => DirectoryError | null;
  onRename: (from: string, name: string) => DirectoryError | null;
  onSetActive: (name: string, active: boolean) => void;
}

export default function ResponsiblesScreen({
  entries,
  onAdd,
  onRename,
  onSetActive,
}: ResponsiblesScreenProps) {
  const [draft, setDraft] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  function submitAdd() {
    const error = onAdd(draft);
    if (error) {
      setAddError(ERROR_TEXT[error]);
      return;
    }
    setDraft('');
    setAddError(null);
  }

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>Ответственные</h2>
      <form
        className={styles.addForm}
        onSubmit={(event) => {
          event.preventDefault();
          submitAdd();
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setAddError(null);
          }}
          placeholder="Новое имя"
          aria-label="Новое имя"
        />
        <button type="submit" className={styles.button}>
          Добавить
        </button>
      </form>
      {addError && <p className={styles.error}>{addError}</p>}

      {entries.length === 0 ? (
        <p className={styles.empty}>Список пуст. Введите имя и нажмите «Добавить».</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <ResponsibleRow
              key={entry.name}
              entry={entry}
              onRename={onRename}
              onSetActive={onSetActive}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResponsibleRow({
  entry,
  onRename,
  onSetActive,
}: {
  entry: ResponsibleEntry;
  onRename: (from: string, name: string) => DirectoryError | null;
  onSetActive: (name: string, active: boolean) => void;
}) {
  const [value, setValue] = useState(entry.name);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(entry.name);
    setError(null);
  }, [entry.name]);

  function commit() {
    const result = onRename(entry.name, value);
    if (result) {
      setError(ERROR_TEXT[result]);
      setValue(entry.name);
      return;
    }
    setError(null);
  }

  return (
    <li className={entry.active ? styles.row : styles.rowInactive}>
      <input
        className={styles.input}
        value={value}
        aria-label={`Имя ${entry.name}`}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            setValue(entry.name);
            setError(null);
          }
        }}
      />
      {!entry.active && <span className={styles.badge}>неактивен</span>}
      <button
        type="button"
        className={styles.button}
        onClick={() => onSetActive(entry.name, !entry.active)}
      >
        {entry.active ? 'Сделать неактивным' : 'Сделать активным'}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </li>
  );
}
