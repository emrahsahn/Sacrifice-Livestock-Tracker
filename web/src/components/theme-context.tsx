"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
type VisualStyle = "premium" | "modern";

const STORAGE_KEY_THEME = "theme";
const STORAGE_KEY_STYLE = "visual-style";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (s: VisualStyle) => void;
  resolvedTheme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyDomTheme(theme: Theme, style: VisualStyle) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  
  // Clear style classes
  root.classList.remove("theme-premium", "theme-modern");
  root.classList.add(`theme-${style}`);
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

function readStoredStyle(): VisualStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_STYLE);
    if (stored === "premium" || stored === "modern") return stored;
  } catch {
    /* ignore */
  }
  return "premium";
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_THEME || e.key === STORAGE_KEY_STYLE || e.key === null) {
      onStoreChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function emitChange() {
  listeners.forEach((l) => l());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    () => "dark" as Theme
  );

  const visualStyle = useSyncExternalStore(
    subscribe,
    readStoredStyle,
    () => "premium" as VisualStyle
  );

  useEffect(() => {
    applyDomTheme(theme, visualStyle);
  }, [theme, visualStyle]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, next);
    } catch {
      /* ignore */
    }
    emitChange();
  }, []);

  const setVisualStyle = useCallback((next: VisualStyle) => {
    try {
      localStorage.setItem(STORAGE_KEY_STYLE, next);
    } catch {
      /* ignore */
    }
    emitChange();
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      visualStyle,
      setVisualStyle,
      resolvedTheme: theme,
    }),
    [theme, setTheme, visualStyle, setVisualStyle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: undefined as Theme | undefined,
      setTheme: () => {},
      visualStyle: undefined as VisualStyle | undefined,
      setVisualStyle: () => {},
      resolvedTheme: undefined as Theme | undefined,
    };
  }
  return ctx;
}
