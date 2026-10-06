import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'ocean' | 'forest' | 'sepia';

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  category: 'Dark' | 'Light';
  badge: string;
  description: string;
  primaryColor: string;
  bgColor: string;
  accentColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    name: 'Midnight Obsidian',
    category: 'Dark',
    badge: 'Default',
    description: 'High-contrast dark mode with emerald & slate accents',
    primaryColor: '#10b981',
    bgColor: '#080c14',
    accentColor: '#38bdf8',
  },
  {
    id: 'light',
    name: 'Daylight Tiranga',
    category: 'Light',
    badge: 'Govt Clean',
    description: 'Crisp white official portal theme with high readability',
    primaryColor: '#059669',
    bgColor: '#f8fafc',
    accentColor: '#ea580c',
  },
  {
    id: 'ocean',
    name: 'Nordic Sapphire',
    category: 'Dark',
    badge: 'Deep Blue',
    description: 'Royal navy & electric cyan maritime executive theme',
    primaryColor: '#38bdf8',
    bgColor: '#050e1d',
    accentColor: '#6366f1',
  },
  {
    id: 'forest',
    name: 'Bharat Emerald',
    category: 'Dark',
    badge: 'Eco Jade',
    description: 'Deep pine forest with lush green & gold accents',
    primaryColor: '#10b981',
    bgColor: '#05130e',
    accentColor: '#f59e0b',
  },
  {
    id: 'sepia',
    name: 'Parchment Warm',
    category: 'Light',
    badge: 'Soft Paper',
    description: 'Warm cream & amber tones for gentle daylight reading',
    primaryColor: '#d97706',
    bgColor: '#faf6ee',
    accentColor: '#475569',
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  availableThemes: ThemeOption[];
  currentThemeConfig: ThemeOption;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('msme_procurement_theme') as ThemeMode;
      if (saved && ['dark', 'light', 'ocean', 'forest', 'sepia'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'dark';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('msme_procurement_theme', newTheme);
    } catch (e) {
      // ignore
    }
  };

  const toggleTheme = () => {
    // Quick toggle between dark and light
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Set theme class on body as well
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const currentThemeConfig = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        availableThemes: THEME_OPTIONS,
        currentThemeConfig,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
