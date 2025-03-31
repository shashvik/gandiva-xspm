import { useState, useEffect } from 'react';

interface ThemeHook {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const useTheme = (): ThemeHook => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check local storage first
    const stored = localStorage.getItem('theme');
    if (stored) {
      return stored === 'dark';
    }
    // Otherwise check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Update local storage when theme changes
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    // Update document class
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return {
    isDarkMode,
    toggleTheme,
  };
}; 