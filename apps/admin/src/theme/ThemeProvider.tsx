import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTheme, spacing, radii, typography, palette, type ThemeName, type SemanticColorRoles } from '@shopsphere/config';

type ThemePreference = ThemeName | 'system';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ThemeName;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'shopsphere-admin-theme-preference';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Converts the shared `SemanticColorRoles` object into `--color-*` custom properties — the single place color tokens become CSS. */
function applyThemeVars(roles: SemanticColorRoles): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(roles)) {
    root.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
  }
}

/**
 * The nav/sidebar is a fixed brand surface — midnight navy with ivory text —
 * independent of the light/dark content theme (Prompt 5's "midnight-navy
 * nav / warm-ivory background" spec describes the nav as a constant, not a
 * themeable surface the way the page background is).
 */
function applyNavVars(): void {
  const root = document.documentElement;
  root.style.setProperty('--color-nav-background', palette.grey[900]);
  root.style.setProperty('--color-nav-surface-active', palette.grey[700]);
  root.style.setProperty('--color-nav-text', palette.grey[0]);
  root.style.setProperty('--color-nav-text-muted', palette.grey[400]);
  root.style.setProperty('--color-nav-border', palette.grey[700]);
  root.style.setProperty('--color-nav-accent', palette.grey[0]);
  root.style.setProperty('--color-nav-on-accent', palette.grey[1000]);
}

function applyStaticVars(): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(spacing)) root.style.setProperty(`--spacing-${key}`, `${value}px`);
  for (const [key, value] of Object.entries(radii)) root.style.setProperty(`--radius-${key}`, `${value}px`);
  root.style.setProperty('--font-size-xs', `${typography.fontSize.xs}px`);
  root.style.setProperty('--font-size-sm', `${typography.fontSize.sm}px`);
  root.style.setProperty('--font-size-base', `${typography.fontSize.base}px`);
  root.style.setProperty('--font-size-md', `${typography.fontSize.md}px`);
  root.style.setProperty('--font-size-lg', `${typography.fontSize.lg}px`);
  root.style.setProperty('--font-size-xl', `${typography.fontSize.xl}px`);
  root.style.setProperty('--font-size-2xl', `${typography.fontSize['2xl']}px`);
  root.style.setProperty('--font-size-3xl', `${typography.fontSize['3xl']}px`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });

  const resolvedTheme: ThemeName = preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference;

  useEffect(() => {
    applyStaticVars();
    applyNavVars();
    applyThemeVars(getTheme(resolvedTheme));
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeVars(getTheme(systemPrefersDark() ? 'dark' : 'light'));
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
