import {
  Archive,
  BookOpen,
  Clock,
  Copy,
  Feather,
  Flame,
  GraduationCap,
  HandHeart,
  Heart,
  Image as ImageIcon,
  Library,
  Scale,
  Share2,
  Sparkles,
  Star,
  Sun,
  Video,
} from 'lucide-react';
import {useMemo} from 'react';
import type {
  AppIcons,
  LibraryFilterType,
  NafahatMeta,
  NavTab,
  Post,
  SectionStatsMap,
  SiteConfig,
} from '../types';
import {useI18n} from '../utils/i18n';
import {resolveFontFamilyCss} from '../utils/readingPrefs';
import {getPublicSiteUrl} from '../utils/storage';
import {trackInteraction} from '../utils/telemetry';
import {useDailyWird} from '../utils/wirdStorage';
import {resolveIcon} from './BrandEmblem';
import {SectionTelemetryPanel} from './SectionTelemetryPanel';

export function HomeView({
  appIcons,
  siteConfig,
  searchQuery,
  nafahatMeta,
  sectionStats = {},
  onCopySada,
  onShareCard,
  onNavigateTab,
  onNavigateLibrary,
  onNavigateFatawa,
  onNavigateAdhkar,
  onNotify,
}: {
  appIcons: AppIcons;
  siteConfig: SiteConfig;
  searchQuery: string;
  nafahatMeta?: NafahatMeta;
  sectionStats?: SectionStatsMap;
  onCopySada: (post: Post) => void;
  onShareCard: (post: Post) => void;
  onNavigateTab: (tab: NavTab) => void;
  onNavigateLibrary: (filter: LibraryFilterType) => void;
  onNavigateFatawa: () => void;
  onNavigateAdhkar: () => void;
  onNotify: (msg: string) => void;
}) {
  const {isEn, tr, formatNumber} = useI18n();
  const {wird} = useDailyWird();

  const readingFontCss = resolveFontFamilyCss('naskh');
  const DailyIcon = resolveIcon(appIcons.dailyWisdom, 'sparkles');

  const dailyWisdomPost: Post = {
    id: 'daily_wisdom_featured',
    title: siteConfig.heroWisdomText.replace(/^[«"]|[»"]$/g, ''),
    excerpt: siteConfig.heroWisdomText,
    body: siteConfig.heroWisdomText,
    author: siteConfig.heroWisdomAuthor,
    sourceLabel: 'موعظة اليوم',
    category: 'صدى الخير',
    mediaType: 'sada',
    cardTheme: 'emerald',
    likes: 0,
    commentsCount: 0,
    publishedAtLabel: 'اليوم',
    createdAt: new Date().toISOString(),
  };

  const shareDailyWisdom = async () => {
    const siteUrl = getPublicSiteUrl('/?tab=home');
    const payload = `✨ *موعظة اليوم*\n\n${siteConfig.heroWisdomText}\n— ${siteConfig.heroWisdomAuthor}\n\n🌿 ${siteConfig.appName}\n🌐 ${siteUrl}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(payload);
      copied = true;
    } catch {
      // Clipboard fallback
    }
    if (navigator.share) {
      try {
        await navigator.share({title: siteConfig.appName, text: payload, url: siteUrl});
        trackInteraction('sermon_share', 'daily_wisdom', 'home');
        if (copied) onNotify(tr('تم نسخ موعظة اليوم مع رابط الموقع', 'Copied daily wisdom'));
        return;
      } catch {
        // Share cancelled or unavailable
      }
    }
    if (copied) {
      trackInteraction('sermon_share', 'daily_wisdom', 'home');
    }
    onNotify(tr('تم نسخ موعظة اليوم مع رابط الموقع', 'Copied daily wisdom'));
  };

  const quickShortcuts: Array<{
    id: string;
    statKey: NavTab;
    label: string;
    sublabel: string;
    Icon: typeof BookOpen;
    toneClass: string;
    onClick: () => void;
  }> = [
    {
      id: 'quran',
      statKey: 'quran',
      label: tr('المصحف الشريف', 'Noble Quran'),
      sublabel: tr('الصفحات والسور', 'Pages & Surahs'),
      Icon: BookOpen,
      toneClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
      onClick: () => onNavigateTab('quran'),
    },
    {
      id: 'adhkar',
      statKey: 'adhkar',
      label: tr('الأذكار والأدعية', 'Adhkar & Duas'),
      sublabel: tr('الصباح والمساء والبر', 'Morning, Evening & Duas'),
      Icon: Sun,
      toneClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
      onClick: onNavigateAdhkar,
    },
    {
      id: 'fatawa',
      statKey: 'fatawa',
      label: tr('الفتاوى', 'Fatawa'),
      sublabel: tr('الحجوري وكبار العلماء', 'Verified Scholars'),
      Icon: Scale,
      toneClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
      onClick: onNavigateFatawa,
    },
    {
      id: 'library-all',
      statKey: 'library',
      label: tr('المكتبة العلمية', 'Scientific Library'),
      sublabel: tr('المتون وصدى الخير', 'Books & Sada Al-Khair'),
      Icon: Library,
      toneClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
      onClick: () => onNavigateLibrary('all'),
    },
    {
      id: 'cards',
      statKey: 'cards',
      label: tr('البطاقات الدعوية', 'Dawah Cards'),
      sublabel: tr('خواطر وشعر وطرائف', 'Short Diverse Cards'),
      Icon: ImageIcon,
      toneClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300',
      onClick: () => onNavigateTab('cards'),
    },
    {
      id: 'daily-quiz',
      statKey: 'quiz',
      label: tr('الاختبار الدعوي', 'Daily Dawah Quiz'),
      sublabel: tr('أسئلة شرعية ونقاط', 'Questions & Leaderboard'),
      Icon: GraduationCap,
      toneClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
      onClick: () => onNavigateTab('quiz'),
    },
    {
      id: 'wird',
      statKey: 'wird',
      label: tr('الورد اليومي', 'Daily Wird'),
      sublabel: tr(`ص ${formatNumber(wird.currentPage)} / ٦٠٤`, `Page ${wird.currentPage}/604`),
      Icon: Flame,
      toneClass: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300',
      onClick: () => onNavigateTab('wird'),
    },
    {
      id: 'mother-oasis',
      statKey: 'mother-oasis',
      label: tr('واحة وقصص الوالدة', "Mother's Oasis"),
      sublabel: tr('قصص ومؤلفات أم محمد', 'Stories & Works'),
      Icon: Heart,
      toneClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
      onClick: () => onNavigateTab('mother-oasis'),
    },
    {
      id: 'poetry',
      statKey: 'poetry',
      label: tr('واحة الشعر والطرائف', 'Poetry & Anecdotes'),
      sublabel: tr('شعر إسلامي ونوادر', 'Clean Arabic Literature'),
      Icon: Feather,
      toneClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300',
      onClick: () => onNavigateTab('poetry'),
    },
    {
      id: 'archive',
      statKey: 'archive',
      label: tr('الأرشيف الشامل', 'Permanent Archive'),
      sublabel: tr('المواعظ والمنشورات', 'All Saved Content'),
      Icon: Archive,
      toneClass: 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200',
      onClick: () => onNavigateTab('archive'),
    },
    {
      id: 'videos',
      statKey: 'videos',
      label: tr('المقاطع المرئية', 'Video Clips'),
      sublabel: tr('مرئيات دعوية وعلمية', 'Dawah Videos'),
      Icon: Video,
      toneClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
      onClick: () => onNavigateTab('videos'),
    },
    {
      id: 'deaf-mute',
      statKey: 'deaf-mute',
      label: tr('قسم الصم والبكم', 'Deaf & Mute Section'),
      sublabel: tr('بإشراف إدارة القسم', 'Section Team'),
      Icon: HandHeart,
      toneClass: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300',
      onClick: () => onNavigateTab('deaf-mute'),
    },
    {
      id: 'reviews',
      statKey: 'reviews',
      label: tr('آراء وتقييمات الزوار', 'Visitor Reviews'),
      sublabel: tr('انطباعات القراء', 'Community Feedback'),
      Icon: Star,
      toneClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
      onClick: () => onNavigateTab('reviews'),
    },
    {
      id: 'about-support',
      statKey: 'about-support',
      label: tr('الدعم وعن الموقع', 'Support & About'),
      sublabel: tr('التواصل، التطبيق، الإحصائيات', 'Tickets, App & Stats'),
      Icon: Sparkles,
      toneClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
      onClick: () => onNavigateTab('about-support'),
    },
  ];

  const visibleShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return quickShortcuts;
    return quickShortcuts.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q),
    );
  }, [searchQuery, quickShortcuts]);

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-4">
      {/* Row 1: Single Compact Pulsing Daily Wisdom Banner Card */}
      <section className="wisdom-card-pulse rounded-2xl bg-gradient-to-br from-[#006a46] via-[#00583a] to-[#003e29] p-3.5 sm:p-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#ffdea8]/35">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[#ffdea8] text-xs font-bold">
              <DailyIcon className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Wisdom of the Day' : 'موعظة اليوم'}</span>
            </span>
            <span className="text-[11px] font-semibold text-[#ffdea8]/90 whitespace-nowrap shrink-0 flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3" />
              <span>{nafahatMeta?.source === 'ai' ? nafahatMeta.lastUpdatedDate : tr('تحديث يومي', 'Daily')}</span>
            </span>
          </div>

          <p
            dir="rtl"
            className="text-sm sm:text-base font-bold leading-relaxed text-white"
            style={{fontFamily: readingFontCss}}
          >
            {siteConfig.heroWisdomText}
          </p>
          <span className="text-[11px] font-semibold text-[#ffdea8] block truncate">
            — {siteConfig.heroWisdomAuthor}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15">
          <button
            type="button"
            onClick={() => onCopySada(dailyWisdomPost)}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#ffc968] hover:bg-[#f2be5e] text-[#271900] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span>{tr('نسخ', 'Copy')}</span>
          </button>
          <button
            type="button"
            onClick={() => onShareCard(dailyWisdomPost)}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{tr('بطاقة', 'Card')}</span>
          </button>
          <button
            type="button"
            onClick={() => void shareDailyWisdom()}
            aria-label={tr('مشاركة موعظة اليوم', 'Share daily wisdom')}
            className="min-w-[36px] min-h-[36px] rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Row 2: Main & Center Element — بوابة الأقسام (Quick Access Sections Gateway with Live Visits & Interactions) */}
      <section aria-label={tr('بوابة الأقسام', 'Sections Gateway')} className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <h1 className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white">
            {tr('بوابة الأقسام', 'Sections Gateway')}
          </h1>
          <span className="text-[11px] font-bold text-[#6e7a71] dark:text-slate-400">
            {tr('انتقل مباشرة إلى القسم المطلوب', 'Tap any section to open')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {visibleShortcuts.map((item) => {
            const Icon = item.Icon;
            const sec = sectionStats[item.statKey] || {visits: 0, interactions: 0};
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="group min-h-[82px] rounded-2xl bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 hover:border-[#006a46]/60 p-3 shadow-2xs hover:shadow-md transition-all text-start flex items-center gap-2.5"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.toneClass}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-[13px] font-extrabold text-[#0e1d25] dark:text-white leading-snug line-clamp-1 group-hover:text-[#006a46] dark:group-hover:text-[#6cdba6] transition-colors">
                    {item.label}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-[#6e7a71] dark:text-slate-400 truncate mt-0.5">
                    {item.sublabel}
                  </p>
                  <p className="text-[10px] font-semibold text-[#006a46] dark:text-[#6cdba6] tabular-nums truncate mt-0.5">
                    {tr(
                      `الزيارات: ${formatNumber(sec.visits)} · المشاركات: ${formatNumber(sec.shares || 0)}`,
                      `Visits: ${sec.visits} · Shares: ${sec.shares || 0}`,
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Row 3: Simple Visual Section Telemetry Summary (Visits & Shares per Section) */}
      <SectionTelemetryPanel
        sectionStats={sectionStats}
        sections={quickShortcuts.map((item) => ({
          id: item.statKey,
          label: item.label,
          onClick: item.onClick,
        }))}
      />
    </div>
  );
}
