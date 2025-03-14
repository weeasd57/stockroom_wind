"use client";

import { createContext, useContext, useEffect, useState } from "react";

const THEME_STORAGE_KEY = "stockroom-theme";
const ThemeContext = createContext({ theme: "system", setTheme: () => null });

export function ThemeProvider({
  children,
  defaultTheme = "system",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}) {
  // Use a simple initial state to avoid hydration issues
  const [theme, setTheme] = useState(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage only after component is mounted
  useEffect(() => {
    setMounted(true);
    // Try to get the theme from localStorage
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
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
    
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("Error saving theme to localStorage:", error);
    }
  }, [theme, mounted]);

  // Apply theme to document only after component is mounted
  useEffect(() => {
    if (!mounted) return;
    
    const root = window.document.documentElement;
    
    // Remove old data attribute/class
    root.classList.remove("light", "dark");
    
    // Set new data attribute/class based on theme
    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }
    
    root.classList.add(theme);
  }, [theme, attribute, enableSystem, mounted]);

  // Listen for system theme changes only after mounted
  useEffect(() => {
    if (!mounted || !enableSystem) return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system") {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(
          mediaQuery.matches ? "dark" : "light"
        );
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [enableSystem, theme, mounted]);

  // Handle transitions when theme changes
  useEffect(() => {
    if (!mounted || !disableTransitionOnChange) return;
    
    document.documentElement.classList.add("disable-transitions");
    window.setTimeout(() => {
      document.documentElement.classList.remove("disable-transitions");
    }, 0);
  }, [theme, disableTransitionOnChange, mounted]);

  const value = {
    theme,
    setTheme: (newTheme) => {
      setTheme(newTheme);
    },
  };

  return (
    <ThemeContext.Provider value={value}>
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
