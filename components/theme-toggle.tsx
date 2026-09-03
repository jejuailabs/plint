'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('plint-theme', theme);
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('plint-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === 'dark';
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-pressed={!isDark}
      onClick={toggleTheme}
      className="theme-toggle size-9 border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
