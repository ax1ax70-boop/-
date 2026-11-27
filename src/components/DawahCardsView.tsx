import {
  Copy,
  Download,
  Flame,
  Maximize2,
  MessageCircle,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {appendOnlyMergeById} from '../data/contentRepository';
import {
  CLASSIC_DAWAH_CARDS,
  DAWAH_CARDS_RESET_EPOCH,
  isConciseClassicCard,
} from '../data/dawahCards';
import type {ClassicDawahCard, DawahCardsMeta} from '../types';
import {
  copyTextSafely,
  renderCardPngBlob,
  shareDawahCardSafely,
  triggerBlobDownload,
} from '../utils/cardShare';
import {cloudUpsertAiDawahCard} from '../utils/cloudSync';
import {useI18n} from '../utils/i18n';
import {getItemDownloadCount, useLiveStats} from '../utils/liveStats';
import {generateQrDataUrl} from '../utils/qrCode';
import {getPublicSiteUrl} from '../utils/storage';
import {trackInteraction} from '../utils/telemetry';
import {ClassicCardFooter} from './ClassicCardFooter';

const DAILY_REGEN_STORAGE_KEY = 'mawaedh_dawah_regen_v1';
const DAILY_REGEN_LIMIT = 3;

function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readLocalRegenUsedToday(): number {
  try {
    const raw = localStorage.getItem(DAILY_REGEN_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {date?: string; count?: number};
    if (parsed.date === getTodayDateKey() && typeof parsed.count === 'number') {
      return Math.max(0, Math.min(DAILY_REGEN_LIMIT, parsed.count));
    }
    return 0;
  } catch {
    return 0;
  }
}

function saveLocalRegenUsedToday(count: number): void {
  try {
    localStorage.setItem(
      DAILY_REGEN_STORAGE_KEY,
      JSON.stringify({date: getTodayDateKey(), count: Math.max(0, Math.min(DAILY_REGEN_LIMIT, count))}),
    );
  } catch {
    // ignore storage limits
  }
}

function rotateCardsDaily(cards: ClassicDawahCard[]): ClassicDawahCard[] {
  if (cards.length <= 1) return cards;
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diffDays = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const offset = diffDays % cards.length;
  return [...cards.slice(offset), ...cards.slice(0, offset)];
}

export function DawahCardsView({
  onNotify,
  aiCards = [],
  dawahCardsMeta,
  cardEngagement = {},
  onAiCardsChange,
  onDawahCardsMetaChange,
  onCardEngaged,
  visitorId,
  isAdmin = false,
  onAdminRefreshAiCards,
}: {
  onNotify: (msg: string) => void;
  aiCards?: ClassicDawahCard[];
  dawahCardsMeta?: DawahCardsMeta;
  cardEngagement?: Record<string, number>;
  onAiCardsChange?: (cards: ClassicDawahCard[]) => void;
  onDawahCardsMetaChange?: (meta: DawahCardsMeta) => void;
  onCardEngaged?: (id: string, nextCount: number) => void;
  visitorId?: string;
  isAdmin?: boolean;
  onAdminRefreshAiCards?: () => Promise<void>;
}) {
  const {formatNumber} = useI18n();
  const {stats, recordDownload} = useLiveStats();
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [selectedCard, setSelectedCard] = useState<ClassicDawahCard | null>(null);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [adminRefreshLoading, setAdminRefreshLoading] = useState(false);
  const [usedToday, setUsedToday] = useState<number>(() => readLocalRegenUsedToday());
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoSyncedRef = useRef(false);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(getPublicSiteUrl('/?tab=cards'), 220).then((url) => {
      if (active && url) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCard(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCard]);

  // Automatically fetch/trigger today's fresh short Dawah Cards if stale
  useEffect(() => {
    if (autoSyncedRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const todayKey = getTodayDateKey();
    const currentShortCount = aiCards.filter(
      (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
    ).length;
    if (dawahCardsMeta?.lastUpdatedDate === todayKey && currentShortCount > 0) {
      autoSyncedRef.current = true;
      return;
    }
    autoSyncedRef.current = true;
    void fetch('/api/dawah-cards', {cache: 'no-store'})
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {aiDawahCards?: ClassicDawahCard[]; dawahCardsMeta?: DawahCardsMeta} | null) => {
        if (!data) return;
        if (Array.isArray(data.aiDawahCards)) {
          onAiCardsChange?.(
            data.aiDawahCards.filter(
              (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
            ),
          );
        }
        if (data.dawahCardsMeta) {
          onDawahCardsMetaChange?.(data.dawahCardsMeta);
        }
      })
      .catch(() => undefined);
  }, [aiCards, dawahCardsMeta?.lastUpdatedDate, onAiCardsChange, onDawahCardsMetaChange]);

  const sortedAiCards = useMemo(() => {
    return aiCards
      .filter(
        (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
      )
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [aiCards]);

  const allCards = useMemo(
    () =>
      appendOnlyMergeById(
        sortedAiCards,
        rotateCardsDaily(CLASSIC_DAWAH_CARDS.filter((c) => isConciseClassicCard(c))),
      ),
    [sortedAiCards],
  );

  const categories = useMemo(() => {
    const preferredOrder = [
      'خواطر ومواعظ قصيرة',
      'أبيات شعر عربية',
      'طرائف موثقة',
      'أحاديث نبوية صحيحة',
    ];
    const uniqueCats = Array.from(new Set(allCards.map((c) => c.category)));
    const ordered = [
      ...preferredOrder.filter((cat) => uniqueCats.includes(cat)),
      ...uniqueCats.filter((cat) => !preferredOrder.includes(cat)),
    ];
    return ['الكل', ...ordered];
  }, [allCards]);

  const visibleCards = useMemo(() => {
    if (selectedCategory === 'الكل') return allCards;
    return allCards.filter((c) => c.category === selectedCategory);
  }, [allCards, selectedCategory]);

  const remainingToday = Math.max(0, DAILY_REGEN_LIMIT - usedToday);

  const buildPlainText = (card: ClassicDawahCard) =>
    `${card.speakerLine}\n\n${card.lines.map((l) => l.text).join(' ')}\n\n[${card.source}]\nمَواعِظ وَعِبَر`;

  const trackCardEngagement = async (cardId: string) => {
    try {
      const res = await fetch(`/api/dawah-cards/${encodeURIComponent(cardId)}/engage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      });
      if (res.ok) {
        const data = (await res.json()) as {engagement?: number};
        if (typeof data.engagement === 'number') {
          onCardEngaged?.(cardId, data.engagement);
        }
      }
    } catch {
      // ignore offline telemetry
    }
  };

  const handleOpenDetails = (card: ClassicDawahCard) => {
    setSelectedCard(card);
    void trackCardEngagement(card.id);
  };

  const handleDownloadPng = async (card: ClassicDawahCard) => {
    const el = cardRefs.current[card.id] || null;
    if (busyCardId) return;
    setBusyCardId(card.id);
    const cardUrl = card.qrUrl || getPublicSiteUrl('/?tab=cards');
    try {
      const blob = await renderCardPngBlob(el, {
        speakerLine: card.speakerLine,
        lines: card.lines,
        source: card.source,
        qrDataUrl: card.qrUrl ? undefined : qrDataUrl,
        qrUrl: cardUrl,
      });
      triggerBlobDownload(blob, `mawaedh-${card.id}.png`);
      recordDownload(`card_${card.id}`);
      void trackCardEngagement(card.id);
      trackInteraction('sermon_share', 'dawah_card', 'cards');
      onNotify('تم حفظ البطاقة الدعوية بصيغة PNG عالية الجودة');
    } catch {
      onNotify('تم تجهيز نص البطاقة — يمكنك نسخه أو مشاركته مباشرة');
    } finally {
      setBusyCardId(null);
    }
  };

  const handleShareCard = async (card: ClassicDawahCard) => {
    if (busyCardId) return;
    setBusyCardId(card.id);
    const cardUrl = card.qrUrl || getPublicSiteUrl('/?tab=cards');
    try {
      await shareDawahCardSafely({
        element: cardRefs.current[card.id] || null,
        fallbackData: {
          speakerLine: card.speakerLine,
          lines: card.lines,
          source: card.source,
          qrDataUrl: card.qrUrl ? undefined : qrDataUrl,
          qrUrl: cardUrl,
        },
        fileName: `mawaedh-${card.id}.png`,
        title: card.speakerLine,
        plainText: buildPlainText(card),
        shareUrl: cardUrl,
        onSuccess: () => {
          recordDownload(`card_${card.id}`);
          void trackCardEngagement(card.id);
          trackInteraction('sermon_share', 'dawah_card', 'cards');
        },
        onNotify,
      });
    } finally {
      setBusyCardId(null);
    }
  };

  const handleCopy = async (card: ClassicDawahCard) => {
    const ok = await copyTextSafely(buildPlainText(card));
    if (ok) {
      void trackCardEngagement(card.id);
      trackInteraction('sermon_share', 'dawah_card', 'cards');
      onNotify('تم نسخ نص الأثر كاملاً بالتشكيل');
    } else {
      onNotify('نص البطاقة جاهز للتحديد والنسخ');
    }
  };

  const handleAiRegenerate = async () => {
    if (regenLoading) return;
    if (remainingToday <= 0) {
      onNotify('استنفدت محاولاتك الثلاث اليومية لتوليد البطاقات، يتجدد الرصيد غداً بإذن الله.');
      return;
    }
    setRegenLoading(true);
    try {
      const visitorKey =
        visitorId ||
        (() => {
          try {
            const saved = localStorage.getItem('mawaedh_visitor_key_v1');
            if (saved) return saved;
            const created = `vk_${Math.random().toString(36).slice(2, 10)}`;
            localStorage.setItem('mawaedh_visitor_key_v1', created);
            return created;
          } catch {
            return 'visitor_default';
          }
        })();
      const res = await fetch('/api/dawah-cards/regenerate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          visitorKey,
          style: 'light',
          preferredCategory: selectedCategory !== 'الكل' ? selectedCategory : undefined,
        }),
      });
      const data = (await res.json()) as {
        card?: ClassicDawahCard;
        aiDawahCards?: ClassicDawahCard[];
        usedToday?: number;
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 429) {
          saveLocalRegenUsedToday(DAILY_REGEN_LIMIT);
          setUsedToday(DAILY_REGEN_LIMIT);
        }
        onNotify(data.error || 'تعذر توليد بطاقة دعوية جديدة حالياً');
        return;
      }
      const nextUsed =
        typeof data.usedToday === 'number'
          ? Math.min(DAILY_REGEN_LIMIT, data.usedToday)
          : Math.min(DAILY_REGEN_LIMIT, usedToday + 1);
      saveLocalRegenUsedToday(nextUsed);
      setUsedToday(nextUsed);
      if (data.card) {
        void cloudUpsertAiDawahCard(data.card).catch(() => undefined);
      }
      if (Array.isArray(data.aiDawahCards)) {
        onAiCardsChange?.(
          data.aiDawahCards.filter(
            (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
          ),
        );
      } else if (data.card && isConciseClassicCard(data.card)) {
        onAiCardsChange?.([data.card, ...sortedAiCards]);
      }
      setSelectedCategory('الكل');
      if (data.card) {
        setSelectedCard(data.card);
      }
      onNotify('تم توليد بطاقة دعوية قصيرة ومعبّرة جديدة وحفظها في الأرشيف الدائم');
    } catch {
      onNotify('تعذر الاتصال بالخادم لتجديد البطاقة حالياً');
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#223a32] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e1d25] dark:text-white">
              البطاقات الدعوية القصيرة والمعبّرة
            </h1>
            <p className="text-sm text-[#3e4a42] dark:text-slate-300 mt-1">
              مختارات قصيرة وسريعة القراءة تشمل: خواطر ومواعظ، أبيات شعر عربية، طرائف موثقة، وأحاديث صحيحة — اضغط «للمزيد» للتفاصيل والحفظ
            </p>
          </div>
          <span className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] tabular-nums">
            {formatNumber(allCards.length)} بطاقة قصيرة معتمدة
          </span>
        </div>

        {/* Instant AI Regeneration Bar (Short-only daily batches + Visitor regeneration) */}
        <div className="rounded-2xl bg-[#f3faf6] dark:bg-[#28453b] border border-[#006a46]/20 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6]" />
              <span>توليد وتجديد البطاقات القصيرة بالذكاء الاصطناعي (تلقائي يومياً للجميع)</span>
            </p>
            <p className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 tabular-nums">
              {dawahCardsMeta?.lastUpdatedDate
                ? `آخر تحديث آلي: ${dawahCardsMeta.lastUpdatedDate} · `
                : ''}
              {remainingToday > 0
                ? `المحاولات المتبقية لك اليوم: ${formatNumber(remainingToday)} من ${formatNumber(DAILY_REGEN_LIMIT)}`
                : 'انتهت المحاولات الثلاث المتاحة للزائر اليوم — يتجدد الرصيد غداً بإذن الله'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && onAdminRefreshAiCards && (
              <button
                type="button"
                disabled={adminRefreshLoading}
                onClick={async () => {
                  setAdminRefreshLoading(true);
                  try {
                    await onAdminRefreshAiCards();
                  } finally {
                    setAdminRefreshLoading(false);
                  }
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#7c5800] hover:bg-[#614400] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-colors"
              >
                <Sparkles className={`w-4 h-4 ${adminRefreshLoading ? 'animate-spin' : ''}`} />
                <span>
                  {adminRefreshLoading
                    ? 'جاري التحديث للمشرف...'
                    : 'تحديث بطاقات قصيرة الآن (للمشرف)'}
                </span>
              </button>
            )}
            <button
              type="button"
              disabled={regenLoading || remainingToday <= 0}
              onClick={() => void handleAiRegenerate()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:bg-slate-300 dark:disabled:bg-white/10 disabled:text-slate-600 dark:disabled:text-slate-400 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${regenLoading ? 'animate-spin' : ''}`} />
              <span>
                {regenLoading
                  ? 'جاري إعداد البطاقة...'
                  : remainingToday > 0
                    ? 'تجديد بطاقة قصيرة جديدة'
                    : 'استُنفدت محاولات اليوم'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pt-1 pb-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#006a46] text-white'
                  : 'bg-[#f3f6f4] dark:bg-white/10 text-[#0e1d25] dark:text-slate-200 hover:bg-[#e7efe9]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Uncluttered Excerpt Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCards.map((card) => {
          const dlCount = getItemDownloadCount(stats, `card_${card.id}`, 18);
          const engScore = cardEngagement[card.id] || 0;
          const isTrending = Boolean(card.isTrending || engScore >= 3);
          const firstLine = card.lines[0];
          const hasMoreLines = card.lines.length > 1;

          return (
            <article
              key={card.id}
              className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#223a32] p-4 shadow-sm flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  {isTrending && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                      <span>رائجة</span>
                    </span>
                  )}
                  {card.isAiGenerated && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-[#006a46] dark:text-[#6cdba6] text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      <span>متجددة</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#6e7a71] dark:text-slate-400">
                  {card.category}
                </span>
              </div>

              {/* Clean #F8F9FA Excerpt Card Preview */}
              <div
                dir="rtl"
                onClick={() => handleOpenDetails(card)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenDetails(card);
                  }
                }}
                aria-label={`فتح تفاصيل البطاقة الكاملة: ${card.speakerLine}`}
                style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #E2E8F0',
                  color: '#111827',
                  fontFamily: '"Cairo", "Tajawal", "Amiri", sans-serif',
                }}
                className="min-h-[250px] w-full rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-4 text-center cursor-pointer hover:border-[#006a46]/40 transition-colors select-text"
              >
                <p
                  style={{color: '#111827'}}
                  className="text-sm sm:text-lg font-extrabold tracking-normal leading-snug"
                >
                  {card.speakerLine}
                </p>

                <div className="my-auto py-3 space-y-3 flex flex-col items-center justify-center">
                  {firstLine && (
                    <p
                      style={{color: firstLine.color}}
                      className="text-2xl sm:text-[30px] leading-[1.45] font-extrabold"
                    >
                      {firstLine.text}
                      {hasMoreLines ? ' ...' : ''}
                    </p>
                  )}

                  {hasMoreLines && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetails(card);
                      }}
                      className="min-h-[40px] px-4 py-1.5 rounded-xl bg-white hover:bg-[#f3faf6] border border-[#006a46]/30 text-[#006a46] font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>للمزيد</span>
                    </button>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="font-bold truncate">{card.source}</span>
                  <span className="font-extrabold text-[#006a46] shrink-0">مَواعِظ وَعِبَر</span>
                </div>
              </div>

              {/* Minimal Card Actions */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleOpenDetails(card)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>للمزيد</span>
                </button>
                <button
                  type="button"
                  disabled={busyCardId === card.id}
                  onClick={() => handleDownloadPng(card)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#7c5800] hover:bg-[#614400] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>تحميل PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(card)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#f3f6f4] dark:bg-white/10 hover:bg-[#e4ece7] text-[#0e1d25] dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>نسخ النص</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6e7a71] dark:text-slate-400 px-1">
                <span>التصنيف: {card.category}</span>
                <span className="tabular-nums font-semibold">
                  مرات التحميل: {formatNumber(dlCount)}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Full Admonition Card Details Modal */}
      {selectedCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`تفاصيل البطاقة: ${selectedCard.speakerLine}`}
          onClick={() => setSelectedCard(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#223a32] p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-[#006a46] dark:text-[#6cdba6]">
                  {selectedCard.category}
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white">
                  تفاصيل الموعظة الكاملة
                </h2>
              </div>
              <button
                type="button"
                aria-label="إغلاق النافذة"
                onClick={() => setSelectedCard(null)}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[#0e1d25] dark:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Complete 3-line Classic Card inside Modal */}
            <div
              ref={(el) => {
                cardRefs.current[selectedCard.id] = el;
              }}
              data-dawah-card="true"
              dir="rtl"
              style={{
                backgroundColor: '#F8F9FA',
                border: '1px solid #E2E8F0',
                color: '#111827',
                fontFamily: '"Cairo", "Tajawal", "Amiri", sans-serif',
              }}
              className="min-h-[340px] w-full rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-4 text-center select-text"
            >
              <p
                style={{color: '#111827'}}
                className="text-base sm:text-xl font-extrabold tracking-normal leading-snug"
              >
                {selectedCard.speakerLine}
              </p>

              <div className="my-auto py-4 space-y-2 sm:space-y-3 flex flex-col items-center justify-center">
                {selectedCard.lines.map((line, i) => (
                  <p
                    key={`${selectedCard.id}_modal_line_${i}`}
                    style={{color: line.color}}
                    className="text-2xl sm:text-[32px] leading-[1.45] font-extrabold"
                  >
                    {line.text}
                  </p>
                ))}
              </div>

              <ClassicCardFooter
                sourceLabel={selectedCard.source}
                qrUrl={selectedCard.qrUrl || getPublicSiteUrl('/?tab=cards')}
              />
            </div>

            {/* Full Actions Bar inside Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                disabled={busyCardId === selectedCard.id}
                onClick={() => void handleShareCard(selectedCard)}
                className="col-span-2 sm:col-span-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#7c5800] hover:bg-[#614400] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>مشاركة</span>
              </button>
              <button
                type="button"
                disabled={busyCardId === selectedCard.id}
                onClick={() => void handleDownloadPng(selectedCard)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>تحميل PNG</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopy(selectedCard)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#f3f6f4] dark:bg-white/10 hover:bg-[#e4ece7] text-[#0e1d25] dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>نسخ النص</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(buildPlainText(selectedCard))}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void trackCardEngagement(selectedCard.id)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>واتساب</span>
              </a>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(buildPlainText(selectedCard))}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void trackCardEngagement(selectedCard.id)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 text-sky-900 dark:text-sky-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>منصة X</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
