import {Check, Globe, X} from 'lucide-react';
import {SUPPORTED_LANGUAGES} from '../data/uiTranslations';
import type {Language} from '../types';
import {useI18n} from '../utils/i18n';

export function LanguagePickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (lang: Language) => void;
}) {
  const {lang, tr} = useI18n();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-3xl bg-white dark:bg-[#223a32] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006a46] text-white flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0e1d25] dark:text-white">
                {tr('لغات الموقع والتطبيق', 'Switch Site Language')}
              </h2>
              <p className="text-xs text-[#6e7a71] dark:text-slate-400">
                {tr(
                  'اللغة الرئيسية في المملكة العربية السعودية واللغات العالمية',
                  'Principal Arabic language of Saudi Arabia & community languages',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close')}
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SUPPORTED_LANGUAGES.map((item) => {
            const active = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  onSelect(item.code);
                  onClose();
                }}
                className={`rounded-2xl border p-3 text-start flex items-center justify-between gap-2.5 transition-all ${
                  active
                    ? 'bg-[#eefaf3] dark:bg-[#006a46]/30 border-[#006a46] ring-1 ring-[#006a46]'
                    : 'bg-[#f8faf9] dark:bg-[#1b3029] border-slate-200/80 dark:border-white/10 hover:border-[#006a46]/45'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#0e1d25] dark:text-white">
                      {item.nativeName}
                    </span>
                    <span className="text-[11px] font-bold text-[#006a46] dark:text-[#6cdba6]">
                      ({item.arabicLabel})
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6e7a71] dark:text-slate-400 truncate mt-0.5">
                    {item.regionHintAr}
                  </p>
                </div>
                {active && (
                  <span className="w-6 h-6 rounded-full bg-[#006a46] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
