"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import safeStorage from "@/utils/safeStorage";

type Theme = "light" | "dark";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
  disableTransitionOnChange?: boolean;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const THEME_STORAGE_KEY = "sharkszone-theme";
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage only after component is mounted
  useEffect(() => {
    setMounted(true);
    try {
      // Migrate old key if exists to preserve user preference
      const legacyKey = "firestocks-theme";
      const legacy = safeStorage.getItem(legacyKey) as Theme | null;
      if (legacy && !safeStorage.getItem(THEME_STORAGE_KEY)) {
        safeStorage.setItem(THEME_STORAGE_KEY, legacy);
        safeStorage.removeItem(legacyKey);
      }

      const storedTheme = safeStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (storedTheme) {
        setTheme(storedTheme);
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }
  }, []);

  // Save theme to localStorage whenever it changes, but only after mounted
  useEffect(() => {
    if (!mounted) return;

    safeStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, mounted]);

  // Resolve and apply theme
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;

    // Update resolved theme state
    setResolvedTheme(theme);

    // Apply theme class
    root.classList.remove("light", "dark");
    root.classList.add(theme);

    // Handle transitions
    if (disableTransitionOnChange) {
      root.classList.add("disable-transitions");
      window.setTimeout(() => {
        root.classList.remove("disable-transitions");
      }, 0);
    }
  }, [theme, mounted, disableTransitionOnChange]);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
