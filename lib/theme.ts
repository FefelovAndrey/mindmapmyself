export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'mindmap-theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function getStoredTheme(storage: Pick<Storage, 'getItem'> | null | undefined): Theme | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(
  stored: Theme | null,
  prefersDark: boolean
): Theme {
  if (stored) return stored;
  return prefersDark ? 'dark' : 'light';
}

export function getOppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
