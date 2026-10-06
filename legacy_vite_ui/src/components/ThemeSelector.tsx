import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Waves,
  TreePine,
  BookOpen,
  Palette,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useTheme, ThemeMode, ThemeOption } from '../context/ThemeContext';

interface ThemeSelectorProps {
  variant?: 'compact' | 'full' | 'pill';
  showLabel?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  variant = 'pill',
  showLabel = true,
}) => {
  const { theme, setTheme, availableThemes, currentThemeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getThemeIcon = (themeId: ThemeMode, className = 'w-4 h-4') => {
    switch (themeId) {
      case 'light':
        return <Sun className={className} />;
      case 'ocean':
        return <Waves className={className} />;
      case 'forest':
        return <TreePine className={className} />;
      case 'sepia':
        return <BookOpen className={className} />;
      case 'dark':
      default:
        return <Moon className={className} />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="theme-selector-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change Color Theme"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm ${
          variant === 'pill'
            ? 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 hover:border-slate-600'
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700'
        }`}
        title={`Current Theme: ${currentThemeConfig.name}. Click to switch theme.`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
            style={{ backgroundColor: currentThemeConfig.primaryColor }}
          />
          {getThemeIcon(theme, 'w-3.5 h-3.5')}
        </span>

        {showLabel && (
          <span className="hidden sm:inline font-medium text-xs">
            {currentThemeConfig.name}
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          id="theme-selector-dropdown-menu"
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-2.5 z-50 animate-fadeIn backdrop-blur-xl"
          style={{
            backgroundColor: 'var(--theme-menu-bg, #0f172a)',
            borderColor: 'var(--theme-menu-border, #334155)',
            color: 'var(--theme-menu-text, #f8fafc)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-800 mb-1.5">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Select Visual Theme
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
              {availableThemes.length} Themes
            </span>
          </div>

          {/* Theme List */}
          <div className="space-y-1 max-h-80 overflow-y-auto pr-0.5">
            {availableThemes.map((option: ThemeOption) => {
              const isSelected = option.id === theme;

              return (
                <button
                  key={option.id}
                  type="button"
                  id={`theme-option-${option.id}`}
                  onClick={() => {
                    setTheme(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all text-xs ${
                    isSelected
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-white shadow-sm'
                      : 'hover:bg-slate-800/70 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Swatch Icon */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5"
                      style={{
                        backgroundColor: option.bgColor,
                        borderColor: option.primaryColor,
                        color: option.primaryColor,
                      }}
                    >
                      {getThemeIcon(option.id, 'w-4 h-4')}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">{option.name}</span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full uppercase ${
                            option.category === 'Light'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {option.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Status */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: option.primaryColor }}
                        title="Primary Color"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: option.bgColor }}
                        title="Background Base"
                      />
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 px-2 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Theme auto-persists in your browser</span>
            </span>
            <button
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
                setIsOpen(false);
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2"
            >
              Toggle {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
