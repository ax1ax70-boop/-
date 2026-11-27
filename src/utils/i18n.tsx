import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {
  getLanguageMeta,
  SUPPORTED_LANGUAGES,
  translateUiString,
  type SupportedLanguageMeta,
} from '../data/uiTranslations';
import type {Language} from '../types';

const LANG_STORAGE_KEY = 'mawaedh_lang_v1';

interface I18nContextValue {
  lang: Language;
  langMeta: SupportedLanguageMeta;
  isRtl: boolean;
  isEn: boolean;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  tr: (ar: string, en: string) => string;
  formatNumber: (n: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const VALID_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

function loadInitialLang(): Language {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && VALID_CODES.has(saved)) {
      return saved as Language;
    }
    return 'ar';
  } catch {
    return 'ar';
  }
}

export function I18nProvider({children}: {children: ReactNode}) {
  const [lang, setLangState] = useState<Language>(() => loadInitialLang());
  const langMeta = useMemo(() => getLanguageMeta(lang), [lang]);
  const isRtl = langMeta.dir === 'rtl';

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage error
    }
    document.documentElement.lang = langMeta.code;
    document.documentElement.dir = langMeta.dir;
  }, [lang, langMeta]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const tr = useCallback(
    (ar: string, en: string) => translateUiString(lang, ar, en),
    [lang],
  );

  const formatNumber = useCallback(
    (n: number) => {
      try {
        return n.toLocaleString(langMeta.locale);
      } catch {
        return n.toLocaleString('en-US');
      }
    },
    [langMeta.locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      langMeta,
      isRtl,
      isEn: !isRtl,
      setLang,
      toggleLang,
      tr,
      formatNumber,
    }),
    [lang, langMeta, isRtl, setLang, toggleLang, tr, formatNumber],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'ar',
      langMeta: getLanguageMeta('ar'),
      isRtl: true,
      isEn: false,
      setLang: () => undefined,
      toggleLang: () => undefined,
      tr: (ar) => ar,
      formatNumber: (n) => n.toLocaleString('ar-SA'),
    };
  }
  return ctx;
}

export const LanguageProvider = I18nProvider;

