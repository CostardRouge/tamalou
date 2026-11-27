import type { ReadyLang } from '@tamalou/shared';
import en from './en.ts';
import fr, { type LandingText } from './fr.ts';

export type { LandingText } from './fr.ts';

/**
 * The home page's texts of every language that has pages, for the build (src/landing/markup.ts, build/) and the tests;
 * the browser never imports this file but its own language's (src/landing/main.tsx). A language made ready without
 * its texts fails the typecheck here.
 */
export const LANDING: Record<ReadyLang, LandingText> = { fr, en };
