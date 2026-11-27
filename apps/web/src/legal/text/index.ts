import type { ReadyLang } from '@tamalou/shared';
import en from './en.ts';
import fr, { type LegalText } from './fr.ts';

export type { LegalText } from './fr.ts';

/** The legal notice of every language that has pages, for the build (src/legal/markup.ts) and the tests. */
export const LEGAL: Record<ReadyLang, LegalText> = { fr, en };
