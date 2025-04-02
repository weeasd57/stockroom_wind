'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import '@/styles/mode-toggle.css';

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button 
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle theme"
    >
      <Sun 
        className={`sun-icon ${
          resolvedTheme === 'dark' ? 'icon-hidden' : 'icon-visible'
        }`}
      />
      <Moon 
        className={`moon-icon ${
          resolvedTheme === 'dark' ? 'icon-visible' : 'icon-hidden'
        }`}
      />
    </button>
  );
}