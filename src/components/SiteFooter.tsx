import {ExternalLink, Eye, MousePointerClick, Radio, Shield, Users} from 'lucide-react';
import type {SocialLink} from '../types';
import {useAdminShieldTrigger} from '../utils/adminShield';
import {useI18n} from '../utils/i18n';
import {resolveIcon} from './BrandEmblem';

export function SiteFooter({
  socialLinks = [],
  visitorsCount,
  clicksCount,
  onlineVisitorsCount,
  onNavigateChannels,
  onAdminTrigger,
}: {
  socialLinks?: SocialLink[];
  visitorsCount?: number;
  clicksCount?: number;
  onlineVisitorsCount?: number;
  onNavigateChannels?: () => void;
  onAdminTrigger?: () => void;
}) {
  const {tr, isEn, formatNumber} = useI18n();
  const shieldHandlers = useAdminShieldTrigger(onAdminTrigger);

  const broadcastLinks = socialLinks
    .filter((l) => l.enabled && (l.id === 'whatsapp' || l.id === 'telegram' || l.id === 'x'))
    .slice(0, 3);

  const fallbackBroadcast =
    broadcastLinks.length > 0
      ? broadcastLinks
      : socialLinks.filter((l) => l.enabled).slice(0, 3);

  const shortPlatformLabel = (link: SocialLink): string => {
    if (link.id === 'whatsapp' || link.url.includes('whatsapp')) return tr('واتساب', 'WhatsApp');
    if (link.id === 'telegram' || link.url.includes('t.me')) return tr('تيليجرام', 'Telegram');
    if (link.id === 'x' || link.url.includes('x.com') || link.url.includes('twitter.com')) {
      return tr('إكس (X)', 'X');
    }
    return link.name;
  };

  return (
    <footer
      dir={isEn ? 'ltr' : 'rtl'}
      className="mt-4 border-t border-slate-200/80 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] text-[#28352e] dark:text-slate-200 rounded-2xl"
    >
      <div className="px-3 sm:px-5 py-2.5 space-y-2 text-center">
        {/* Broadcast Platforms Bar (WhatsApp, Telegram, X) + Clear Cumulative Visitor Log */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
            <span className="text-[11px] font-bold text-[#6e7a71] dark:text-slate-400 flex items-center gap-1 me-1">
              <Radio className="w-3.5 h-3.5 text-[#006a46] dark:text-[#6cdba6]" />
              <span>{tr('منصات البث:', 'Channels:')}</span>
            </span>
            {fallbackBroadcast.map((ch) => {
              const Icon = resolveIcon(ch.iconId, 'globe');
              return (
                <a
                  key={ch.id}
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 hover:border-[#006a46] text-[11px] font-bold text-[#0e1d25] dark:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <Icon className="w-3 h-3 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
                  <span>{shortPlatformLabel(ch)}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                </a>
              );
            })}
            {onNavigateChannels && (
              <button
                type="button"
                onClick={onNavigateChannels}
                className="min-h-[30px] px-2 py-1 rounded-lg text-[11px] font-bold text-[#006a46] dark:text-[#6cdba6] hover:underline"
              >
                {tr('المزيد', 'More')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
            {typeof visitorsCount === 'number' && (
              <span className="inline-flex items-center gap-1 text-[#0e1d25] dark:text-slate-100 font-bold tabular-nums">
                <Eye className="w-3.5 h-3.5 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
                <span>
                  {tr(
                    `سجل الزوار (الإجمالي التراكمي): ${formatNumber(visitorsCount)}`,
                    `Cumulative Visits: ${formatNumber(visitorsCount)}`,
                  )}
                </span>
              </span>
            )}
            {typeof clicksCount === 'number' && (
              <span className="inline-flex items-center gap-1 text-[#3e4a42] dark:text-slate-300 font-semibold tabular-nums">
                <MousePointerClick className="w-3.5 h-3.5 text-[#006389] dark:text-[#80cfff] shrink-0" />
                <span>
                  {tr(`التفاعلات: ${formatNumber(clicksCount)}`, `Interactions: ${formatNumber(clicksCount)}`)}
                </span>
              </span>
            )}
            {typeof onlineVisitorsCount === 'number' && (
              <span className="inline-flex items-center gap-1 text-[#006a46] dark:text-[#6cdba6] font-bold tabular-nums">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {tr(
                    `المتواجدون الآن: ${formatNumber(onlineVisitorsCount)}`,
                    `Online: ${formatNumber(onlineVisitorsCount)}`,
                  )}
                </span>
              </span>
            )}
            <span className="font-bold text-[#006a46] dark:text-[#6cdba6]">
              © 2027 مواعظ وعبر
            </span>
            {onAdminTrigger && (
              <button
                type="button"
                {...shieldHandlers}
                aria-label="بوابة الإدارة"
                className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[#006a46]/55 hover:text-[#006a46] dark:text-[#6cdba6]/55 dark:hover:text-[#6cdba6] hover:bg-emerald-500/10 transition-colors shrink-0 select-none"
              >
                <Shield className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <p className="text-[10px] sm:text-[11px] text-[#6e7a71] dark:text-slate-400 leading-snug">
          تنويه علمي: المحتوى المُولّد عبر المساعد الذكي أداة تقنية مساعدة؛ نرجو دائماً الرجوع إلى الكتب والمصادر العلمية الأصلية الموثقة قبل الاعتماد والنقل.
        </p>
      </div>
    </footer>
  );
}
