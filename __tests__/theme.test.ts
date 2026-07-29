import {
  getOppositeTheme,
  getStoredTheme,
  isTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
} from '../lib/theme';

describe('theme helpers', () => {
  test('isTheme accepts only light/dark', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  test('getStoredTheme reads valid value from storage', () => {
    const storage = {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'dark' : null),
    };
    expect(getStoredTheme(storage)).toBe('dark');
  });

  test('getStoredTheme ignores invalid value', () => {
    const storage = {
      getItem: () => 'blue',
    };
    expect(getStoredTheme(storage)).toBeNull();
  });

  test('getStoredTheme returns null when storage is unavailable', () => {
    expect(getStoredTheme(null)).toBeNull();
    expect(getStoredTheme(undefined)).toBeNull();
  });

  test('getStoredTheme swallows storage errors', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(getStoredTheme(storage)).toBeNull();
  });

  test('resolveInitialTheme prefers stored theme over system', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  test('resolveInitialTheme falls back to system preference', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  test('getOppositeTheme toggles between themes', () => {
    expect(getOppositeTheme('light')).toBe('dark');
    expect(getOppositeTheme('dark')).toBe('light');
  });
});
