import { useEffect } from 'react';

export interface KeyboardHandlers {
  onEnter: () => void;
  onShiftEnter: () => void;
  onTab: () => void;
  onDelete: () => void;
  onF2: () => void;
  onArrowRight: () => void;
  onArrowLeft: () => void;
}

/**
 * Перехватывает горячие клавиши для дерева узлов.
 * Не срабатывает когда фокус находится внутри textarea, input[type!=button] или select,
 * кроме явно разрешённых клавиш (Escape/Enter в inline-редакторе обрабатываются там же).
 */
export function useKeyboard(
  enabled: boolean,
  handlers: KeyboardHandlers
) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInField =
        tag === 'textarea' ||
        tag === 'select' ||
        (tag === 'input' && (target as HTMLInputElement).type !== 'button');

      if (isInField) return;

      switch (true) {
        case e.key === 'Enter' && !e.shiftKey:
          e.preventDefault();
          handlers.onEnter();
          break;
        case e.key === 'Enter' && e.shiftKey:
          e.preventDefault();
          handlers.onShiftEnter();
          break;
        case e.key === 'Tab':
          e.preventDefault();
          handlers.onTab();
          break;
        case e.key === 'Delete':
          e.preventDefault();
          handlers.onDelete();
          break;
        case e.key === 'F2':
          e.preventDefault();
          handlers.onF2();
          break;
        case e.key === 'ArrowRight':
          e.preventDefault();
          handlers.onArrowRight();
          break;
        case e.key === 'ArrowLeft':
          e.preventDefault();
          handlers.onArrowLeft();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}
