"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ theme: "system", setTheme: () => null });

export function ThemeProvider({
  children,
  defaultTheme = "system",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
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
  }, [theme, attribute, enableSystem]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem) return;
    
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
  }, [enableSystem, theme]);

  // Handle transitions when theme changes
  useEffect(() => {
    if (disableTransitionOnChange) {
      document.documentElement.classList.add("disable-transitions");
      window.setTimeout(() => {
        document.documentElement.classList.remove("disable-transitions");
      }, 0);
    }
  }, [theme, disableTransitionOnChange]);

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
