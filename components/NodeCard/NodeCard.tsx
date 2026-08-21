'use client';

import { useState, useEffect } from 'react';
import type { MindNode, Status } from '@/types/node';
import {
  isoToDeadlineDate,
  isoToLocalTime,
  validateTimeRange,
} from '@/lib/yandexCalendar/helpers';
import styles from './NodeCard.module.css';

const MAX_DESCRIPTION = 2000;

interface NodeCardProps {
  node: MindNode | null;
  nodeNumber: string | null;
  onChange: (patch: Partial<Omit<MindNode, 'id' | 'children'>>) => void;
  calendarBusy?: boolean;
}

export default function NodeCard({
  node,
  nodeNumber,
  onChange,
  calendarBusy = false,
}: NodeCardProps) {
  const [localName, setLocalName] = useState('');
  const [localResponsible, setLocalResponsible] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [calDate, setCalDate] = useState('');
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setLocalName(node.name);
      setLocalResponsible(node.responsible ?? '');
      setLocalDescription(node.description ?? '');
      setCalDate(node.deadline ?? '');
      setSendError(null);
      if (node.calendarUid) {
        if (node.calendarStartAt) setCalStart(isoToLocalTime(node.calendarStartAt));
        if (node.calendarEndAt) setCalEnd(isoToLocalTime(node.calendarEndAt));
      } else {
        // OQ-4: дату предзаполняем из deadline; время пользователь указывает сам
        setCalStart('');
        setCalEnd('');
      }
    }
  }, [node?.id, node?.calendarUid, node?.deadline, node?.calendarStartAt, node?.calendarEndAt, node?.description, node?.name, node?.responsible]);

  if (!node) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Выберите узел</div>
      </div>
    );
  }

  const linked = Boolean(node.calendarUid);
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

  async function sendToCalendar() {
    setSendError(null);
    if (!calDate || !calStart || !calEnd) {
      setSendError('Укажите дату и время');
      return;
    }
    const rangeError = validateTimeRange(calStart, calEnd);
    if (rangeError) {
      setSendError(rangeError);
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/calendar/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: node!.name,
          description: node!.description,
          date: calDate,
          startTime: calStart,
          endTime: calEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || 'Ошибка отправки');
        return;
      }
      onChange({
        calendarUid: data.calendarUid,
        calendarStartAt: data.calendarStartAt,
        calendarEndAt: data.calendarEndAt,
        deadline: data.deadline ?? isoToDeadlineDate(data.calendarStartAt),
        calendarSyncedAt: new Date().toISOString(),
      });
    } catch {
      setSendError('Нет сети или ошибка сервера');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {nodeNumber && <div className={styles.nodeNumber}>{nodeNumber}</div>}
        <div className={styles.headerRow}>
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
          {linked && <span className={styles.calendarBadge}>В календаре</span>}
        </div>
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
            disabled={linked}
            onChange={(e) => {
              if (!linked) onChange({ deadline: e.target.value || null });
            }}
          />
          {linked && (
            <span className={styles.hint}>Срок берётся из календаря (только чтение)</span>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.calendarSection}>
          <div className={styles.label}>Яндекс Календарь</div>
          {linked ? (
            <div className={styles.linkedInfo}>
              <div className={styles.linkedStatus}>Уже в календаре</div>
              <div>
                Начало:{' '}
                {node.calendarStartAt
                  ? `${isoToDeadlineDate(node.calendarStartAt)} ${isoToLocalTime(node.calendarStartAt)}`
                  : '—'}
              </div>
              <div>
                Окончание:{' '}
                {node.calendarEndAt
                  ? `${isoToDeadlineDate(node.calendarEndAt)} ${isoToLocalTime(node.calendarEndAt)}`
                  : '—'}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.fieldRow}>
                <label className={styles.subLabel}>Дата</label>
                <input
                  className={styles.input}
                  type="date"
                  value={calDate}
                  onChange={(e) => setCalDate(e.target.value)}
                />
              </div>
              <div className={styles.timeRow}>
                <div className={styles.fieldRow}>
                  <label className={styles.subLabel}>Начало</label>
                  <input
                    className={styles.input}
                    type="time"
                    value={calStart}
                    onChange={(e) => setCalStart(e.target.value)}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.subLabel}>Окончание</label>
                  <input
                    className={styles.input}
                    type="time"
                    value={calEnd}
                    onChange={(e) => setCalEnd(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.sendButton}
                disabled={sending || calendarBusy}
                onClick={sendToCalendar}
              >
                {sending ? 'Отправка…' : 'Отправить в календарь'}
              </button>
              {sendError && <div className={styles.errorText}>{sendError}</div>}
            </>
          )}
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
