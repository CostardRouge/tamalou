import { createContext, useContext } from 'react';
import { classicTheme } from './classic.tsx';
import type { CardTheme } from './theme.ts';

export const CardThemeContext = createContext<CardTheme>(classicTheme);
export const useCardTheme = () => useContext(CardThemeContext);
