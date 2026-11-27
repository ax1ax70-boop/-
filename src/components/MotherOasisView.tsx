import {
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Feather,
  FileText,
  Heart,
  QrCode,
  Sparkles,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {MOTHER_OASIS_SIGNATURE} from '../data/seed';
import type {MotherOasisChapter, MotherOasisItem, NavTab, Post} from '../types';
import {useI18n} from '../utils/i18n';
import {resolveFontFamilyCss, resolveFontSizeSpec, useReadingPrefs} from '../utils/readingPrefs';
import {getPublicSiteUrl} from '../utils/storage';
import {BrandCircularMark} from './ClassicCardFooter';
import {ComingSoonState} from './ComingSoonState';
import {InlineQrImg} from './InlineQrImg';

const MOTHER_CHAPTERS: Array<{
  id: 'all' | MotherOasisChapter;
  label: string;
  desc: string;
}> = [
  {id: 'all', label: 'جميع الأبواب', desc: 'عرض كافة المؤلفات والمحاضرات المفرغة وقصص أم محمد'},
  {
    id: 'books',
    label: 'باب المؤلفات والكتب الدعوية والتربوية',
    desc: 'رسائل وكتب ومقالات تربوية وإيمانية محررة',
  },
  {
    id: 'lectures',
    label: 'باب المحاضرات والدروس المفرغة',
    desc: 'توجيهات ودروس مفرغة نصياً للقراءة والتأمل',
  },
  {
    id: 'stories',
    label: 'قصص أم محمد (قصص وعبر)',
    desc: 'مواقف وعبر تربوية صادقة ومختارة من واقع الحياة',
  },
];

function buildTeaserExcerpt(text: string, maxLen = 320): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 120 ? slice.slice(0, lastSpace) : slice).trim()}...`;
}

export function MotherOasisView({
  items,
  onNavigate,
  onShareCard,
  isAdmin = false,
  onAdminQuickAdd,
  highlightedStoryId,
}: {
  items: MotherOasisItem[];
  motherPrayersCount?: number;
  hasPrayedForMother?: boolean;
  onAmenMother?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onShareCard?: (post: Post) => void;
  isAdmin?: boolean;
  onAdminQuickAdd?: () => void;
  highlightedStoryId?: string | null;
}) {
  const {formatNumber} = useI18n();
  const {prefs} = useReadingPrefs();
  const fontSpec = resolveFontSizeSpec(prefs.fontSize);
  const [chapter, setChapter] = useState<'all' | MotherOasisChapter>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!highlightedStoryId) return;
    setExpandedIds((prev) => ({...prev, [highlightedStoryId]: true}));
    const timer = setTimeout(() => {
      const el = document.getElementById(`mother-story-${highlightedStoryId}`);
      el?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 180);
    return () => clearTimeout(timer);
  }, [highlightedStoryId]);

  const safeItems = useMemo(
    () => (Array.isArray(items) ? items.filter((it) => Boolean(it && typeof it === 'object')) : []),
    [items],
  );

  const filteredItems = useMemo(
    () => (chapter === 'all' ? safeItems : safeItems.filter((it) => it.chapter === chapter)),
    [chapter, safeItems],
  );

  const formatCreatedAt = (value?: string) => {
    try {
      const d = value ? new Date(value) : new Date();
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const chapterMeta = (ch: MotherOasisChapter) => {
    if (ch === 'books') return {label: 'المؤلفات والكتب الدعوية والتربوية', Icon: BookOpen};
    if (ch === 'lectures') return {label: 'المحاضرات والدروس المفرغة', Icon: FileText};
    return {label: 'قصص أم محمد · قصص وعبر', Icon: BookMarked};
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Quiet Warm Introduction Card (Privacy-Safe: Kunya Only) */}
      <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#fffaf2] via-[#fdfbf7] to-[#f4f7f5] dark:from-[#1b1710] dark:via-[#141916] dark:to-[#0c211a] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>واحة دعوية وتربوية هادئة · محتوى نصي محرر فقط</span>
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100/95 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-extrabold border border-amber-500/30">
              <Clock className="w-3.5 h-3.5" />
              <span>تحديث مستمر بالذكاء الاصطناعي ويدوياً</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0e1d25] dark:text-white leading-snug">
            واحة وقصص الوالدة: أم محمد
          </h1>
          <p className="text-sm sm:text-base text-[#3e4a42] dark:text-slate-300 max-w-3xl leading-relaxed">
            صفحة مخصصة هادئة ودافئة تجمع بفضل الله ما تيسّر من كتب ورسائل ومواعظ مفرغة وقصص وعبر تربوية بقلم الوالدة الفاضلة أم محمد حفظها الله، لتكون علماً نافعاً وأثراً طيباً باقياً.
          </p>
        </div>

        <div className="rounded-2xl bg-white/85 dark:bg-[#223a32]/90 border border-amber-500/30 p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#7c5800] dark:text-[#ffdea8]">
            <QrCode className="w-4 h-4 shrink-0" />
            <span>قصص أم محمد مزودة بباركود ذكي مباشر لقراءة القصة كاملة</span>
          </div>
          <p className="text-xs sm:text-sm text-[#3e4a42] dark:text-slate-300 leading-relaxed">
            تظهر بجانب كل قصة فقرة تشويقية مختصرة مع رمز الاستجابة السريعة (QR) الخاص بها لفتح باقي القصة ومشاركتها بسهولة تامة مع الحفاظ على خصوصية الكنية المباركة فقط.
          </p>
          <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-1">
            <Feather className="w-3.5 h-3.5 shrink-0" />
            <span>{MOTHER_OASIS_SIGNATURE}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-amber-500/20">
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && onAdminQuickAdd && (
              <button
                type="button"
                onClick={onAdminQuickAdd}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-xs font-extrabold transition-colors"
              >
                + إضافة مادة لواحة الوالدة
              </button>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('adhkar')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/35 text-amber-900 dark:text-amber-200 text-xs font-bold hover:brightness-95 transition-colors"
              >
                الانتقال إلى «وقفة بر ووفاء» في الأذكار ←
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Organized 3 Chapters Filter */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {MOTHER_CHAPTERS.map((ch) => {
          const active = chapter === ch.id;
          const count =
            ch.id === 'all' ? safeItems.length : safeItems.filter((it) => it.chapter === ch.id).length;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => setChapter(ch.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-[#006a46] text-white shadow-sm'
                  : 'bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 text-[#3e4a42] dark:text-slate-300 hover:border-[#006a46]/40'
              }`}
            >
              <span>{ch.label}</span>
              {count === 0 ? (
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${
                    active ? 'bg-white/20 text-[#ffdea8]' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  }`}
                >
                  قريباً
                </span>
              ) : (
                <span
                  className={`text-xs tabular-nums ${
                    active ? 'text-[#ffdea8]' : 'text-[#006a46] dark:text-[#6cdba6]'
                  }`}
                >
                  ({formatNumber(count)})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Articles / Works / Stories Feed */}
      {filteredItems.length === 0 ? (
        <ComingSoonState
          badgeText="قريباً بإذن الله"
          title="سيتم تنزيل القصص والمحاضرات والدروس في هذا الباب قريباً جداً"
          description="العمل جارٍ على تطوير وتفريغ ومراجعة المحتوى العلمي والتربوي ليُعرض هنا بصفاء ووضوح. ندعوكم للتحلي بالصبر والترقب ريثما تكتمل الإضافات."
          encouragementText="تبقى إضافات المشرف متاحة في كل وقت وتُحفظ وتُعتمد تلقائياً في قاعدة البيانات السحابية."
          signature={MOTHER_OASIS_SIGNATURE}
          isAdmin={isAdmin}
          onAdminQuickAdd={onAdminQuickAdd}
          adminAddLabel="+ إضافة مقالة أو درس لهذا الباب"
        />
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const meta = chapterMeta(item.chapter);
            const Icon = meta.Icon;
            const dateText = formatCreatedAt(item.createdAt);
            const storyQrUrl = getPublicSiteUrl(`/?tab=mother-oasis&story=${encodeURIComponent(item.id)}`);
            const isStory = item.chapter === 'stories' || item.body.trim().length > 340;
            const isExpanded = Boolean(expandedIds[item.id] || highlightedStoryId === item.id);
            const displaySignature =
              item.signature && !/إكرام|عبده علي/.test(item.signature)
                ? item.signature
                : MOTHER_OASIS_SIGNATURE;

            return (
              <article
                id={`mother-story-${item.id}`}
                key={item.id}
                className={`rounded-3xl border bg-white dark:bg-[#223a32] p-5 sm:p-7 shadow-xs space-y-4 ${
                  highlightedStoryId === item.id
                    ? 'border-[#006a46] ring-2 ring-[#006a46]/25'
                    : 'border-amber-500/20'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-[#006a46] dark:text-[#6cdba6]">
                    <Icon className="w-4 h-4" />
                    <span>{meta.label}</span>
                  </span>
                  {dateText && (
                    <span className="text-[#6e7a71] dark:text-slate-400 tabular-nums">
                      {dateText}
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-[#0e1d25] dark:text-white">
                  {item.title}
                </h2>

                {isStory && !isExpanded ? (
                  <div className="rounded-2xl bg-[#F8F9FA] dark:bg-[#1b3029] border border-slate-200/80 dark:border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <p
                        dir="rtl"
                        style={{fontFamily: resolveFontFamilyCss(prefs.fontFamily)}}
                        className={`${fontSpec.bodyClass} text-[#1d2a22] dark:text-slate-200 leading-relaxed`}
                      >
                        {buildTeaserExcerpt(item.body, 320)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>اقرأ باقي القصة كاملة</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {onShareCard && (
                          <button
                            type="button"
                            onClick={() =>
                              onShareCard({
                                id: `mother_${item.id}`,
                                title: item.title,
                                excerpt: buildTeaserExcerpt(item.body, 320),
                                body: item.body,
                                author: displaySignature,
                                sourceLabel: meta.label,
                                category: 'قصص أم محمد',
                                mediaType: 'quote',
                                cardTheme: 'emerald',
                                likes: 0,
                                commentsCount: 0,
                                publishedAtLabel: dateText || 'واحة أم محمد',
                                createdAt: item.createdAt,
                                shareUrl: storyQrUrl,
                              })
                            }
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#fffbf2] dark:bg-white/10 border border-[#f2be5e]/45 text-[#7c5800] dark:text-[#f2be5e] text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>مشاركة كبطاقة + باركود</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Story QR Side Card beside Teaser */}
                    <div
                      style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
                      className="rounded-2xl p-3 flex flex-col items-center gap-2 shrink-0 self-center sm:self-auto"
                    >
                      <InlineQrImg
                        url={storyQrUrl}
                        size={200}
                        alt={`باركود ${item.title}`}
                        className="w-24 h-24 rounded-lg p-1 bg-white border border-[#E2E8F0]"
                      />
                      <span style={{color: '#006a46'}} className="text-[10px] font-extrabold text-center leading-tight">
                        امسح لفتح باقي القصة
                      </span>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <BrandCircularMark size="sm" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p
                      dir="rtl"
                      style={{fontFamily: resolveFontFamilyCss(prefs.fontFamily)}}
                      className={`${fontSpec.bodyClass} text-[#1d2a22] dark:text-slate-200 whitespace-pre-line`}
                    >
                      {item.body}
                    </p>
                    {isStory && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#1b3029] border border-slate-200/80 dark:border-white/10 p-3.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-[#0e1d25] dark:text-white inline-flex items-center gap-1.5"
                        >
                          <ChevronUp className="w-4 h-4" />
                          <span>عرض الجزء المختصر فقط</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <BrandCircularMark size="sm" />
                          <InlineQrImg
                            url={storyQrUrl}
                            size={180}
                            alt={`باركود ${item.title}`}
                            className="w-14 h-14 rounded-lg p-1 bg-white border border-[#E2E8F0]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-amber-500/15 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <Feather className="w-4 h-4 shrink-0" />
                    <span>{displaySignature}</span>
                  </div>
                  {onShareCard && (
                    <button
                      type="button"
                      onClick={() =>
                        onShareCard({
                          id: `mother_${item.id}`,
                          title: item.title,
                          excerpt: buildTeaserExcerpt(item.body, 320),
                          body: item.body,
                          author: displaySignature,
                          sourceLabel: meta.label,
                          category: 'قصص أم محمد',
                          mediaType: 'quote',
                          cardTheme: 'emerald',
                          likes: 0,
                          commentsCount: 0,
                          publishedAtLabel: dateText || 'واحة أم محمد',
                          createdAt: item.createdAt,
                          shareUrl: storyQrUrl,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-[#fffbf2] dark:bg-white/10 text-[#7c5800] dark:text-[#f2be5e] text-xs font-extrabold inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>بطاقة + باركود</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
