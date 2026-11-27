import { describe, expect, it } from 'vitest';
import {
  detectLang,
  isLang,
  isReadyLang,
  LANG_CODES,
  LANGUAGES,
  langOfTag,
  language,
  legalDir,
  READY_LANGS,
  UsageContextSchema,
} from '../src/index.ts';

// The one list of languages (ADR-0028): what a browser's tags map to, what the site's addresses are.

describe('languages', () => {
  it('lists the nine languages once each, French first and ready, with English', () => {
    expect(LANG_CODES).toEqual(['fr', 'en', 'es', 'it', 'pt', 'de', 'ja', 'zh-Hans', 'zh-Hant']);
    expect(READY_LANGS.slice(0, 2)).toEqual(['fr', 'en']);
    expect(new Set(LANGUAGES.map((l) => l.dir)).size).toBe(LANGUAGES.length);
    expect(language('pt').html).toBe('pt-BR');
    expect(language('zh-Hant').ogLocale).toBe('zh_TW');
    for (const l of LANGUAGES) expect(() => new Intl.PluralRules(l.locale)).not.toThrow();
  });

  it('reads a browser’s tag: Chinese by script or region, Portuguese of any country, the rest by its language', () => {
    expect(langOfTag('zh-TW')).toBe('zh-Hant');
    expect(langOfTag('zh-HK')).toBe('zh-Hant');
    expect(langOfTag('zh-Hant-MO')).toBe('zh-Hant');
    expect(langOfTag('zh')).toBe('zh-Hans');
    expect(langOfTag('zh-CN')).toBe('zh-Hans');
    expect(langOfTag('zh_SG')).toBe('zh-Hans');
    expect(langOfTag('pt-PT')).toBe('pt');
    expect(langOfTag('pt-BR')).toBe('pt');
    expect(langOfTag('de-CH')).toBe('de');
    expect(langOfTag('EN-us')).toBe('en');
    expect(langOfTag('ko')).toBeNull();
    expect(langOfTag('')).toBeNull();
  });

  it('detects the first offered language of a browser, or none', () => {
    const all = LANG_CODES;
    expect(detectLang(['zh-TW', 'en'], all)).toBe('zh-Hant');
    expect(detectLang(['ko', 'pt-PT'], all)).toBe('pt');
    expect(detectLang(['ko'], all)).toBeNull();
    expect(detectLang(['ja', 'en-US'], ['fr', 'en'])).toBe('en');
    expect(detectLang(['en-US'])).toBe('en');
  });

  it('checks codes and gives each language its legal notice’s address', () => {
    expect(isLang('zh-Hans')).toBe(true);
    expect(isLang('zh')).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isReadyLang('fr')).toBe(true);
    expect(legalDir('fr')).toBe('mentions-legales/');
    expect(legalDir('en')).toBe('en/legal/');
    expect(legalDir('zh-Hans')).toBe('zh-hans/legal/');
  });

  it('lets the usage statistics carry any language of the list, and nothing else', () => {
    const ctx = {
      device: 'phone',
      orientation: 'portrait',
      connection: '4g',
      installed: false,
      sound: true,
      haptics: true,
      hand: 'row',
      drawView: 'held',
      botPace: 'normal',
      cardSpeed: 'normal',
    };
    for (const lang of LANG_CODES) expect(UsageContextSchema.safeParse({ ...ctx, lang }).success, lang).toBe(true);
    expect(UsageContextSchema.safeParse({ ...ctx, lang: 'xx-long' }).success).toBe(false);
  });
});
