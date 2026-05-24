import React, { createContext, useContext, useMemo, useState } from 'react';
import { palettes, type Palette, type ThemeName, radii, spacing, typography, motion } from '@soulsync/shared';

interface ThemeContextValue {
  name: ThemeName;
  palette: Palette;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  motion: typeof motion;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initial = 'romantic-dark',
}: {
  children: React.ReactNode;
  initial?: ThemeName;
}) {
  const [name, setTheme] = useState<ThemeName>(initial);
  const palette = palettes[name];
  const value = useMemo<ThemeContextValue>(
    () => ({ name, palette, radii, spacing, typography, motion, setTheme }),
    [name, palette],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
