import {Copy, Download, Flame, MessageCircle, RefreshCw, Share2, Sparkles} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {appendOnlyMergeById} from '../data/contentRepository';
import {CLASSIC_DAWAH_CARDS} from '../data/dawahCards';
import type {ClassicDawahCard} from '../types';
import {cloudUpsertAiDawahCard} from '../utils/cloudSync';
import {useI18n} from '../utils/i18n';
import {
  copyTextSafely,
  renderCardPngBlob,
  shareDawahCardSafely,
  triggerBlobDownload,
} from '../utils/cardShare';
import {getItemDownloadCount, useLiveStats} from '../utils/liveStats';
import {generateQrDataUrl} from '../utils/qrCode';
import {getPublicSiteUrl} from '../utils/storage';

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

export function DawahCardsView({
  onNotify,
  aiCards = [],
  cardEngagement = {},
  onAiCardsChange,
  onCardEngaged,
  visitorId,
}: {
  onNotify: (msg: string) => void;
  aiCards?: ClassicDawahCard[];
  cardEngagement?: Record<string, number>;
  onAiCardsChange?: (cards: ClassicDawahCard[]) => void;
  onCardEngaged?: (id: string, nextCount: number) => void;
  visitorId?: string;
}) {
  const {formatNumber} = useI18n();
  const {stats, recordDownload} = useLiveStats();
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [usedToday, setUsedToday] = useState<number>(() => readLocalRegenUsedToday());
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;
    generateQrDataUrl(getPublicSiteUrl(), 96).then((url) => {
      if (active && url) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  const allCards = useMemo(
    () => appendOnlyMergeById(aiCards, CLASSIC_DAWAH_CARDS),
    [aiCards],
  );

  const categories = useMemo(
    () => ['الكل', ...Array.from(new Set(allCards.map((c) => c.category)))],
    [allCards],
  );

  const visibleCards = useMemo(() => {
    if (selectedCategory === 'الكل') return allCards;
    return allCards.filter((c) => c.category === selectedCategory);
  }, [allCards, selectedCategory]);

  const remainingToday = Math.max(0, DAILY_REGEN_LIMIT - usedToday);

  const buildPlainText = (card: ClassicDawahCard) =>
    `${card.speakerLine}\n\n${card.lines.map((l) => l.text).join(' ')}\n\n[${card.source}]\nموقع مواعظ وعبر — جميع الحقوق محفوظة © 2027`;

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

  const handleDownloadPng = async (card: ClassicDawahCard) => {
    const el = cardRefs.current[card.id];
    if (busyCardId) return;
    setBusyCardId(card.id);
    try {
      const blob = await renderCardPngBlob(el, {
        speakerLine: card.speakerLine,
        lines: card.lines,
        source: card.source,
        qrDataUrl,
      });
      triggerBlobDownload(blob, `mawaedh-${card.id}.png`);
      recordDownload(`card_${card.id}`);
      void trackCardEngagement(card.id);
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
    try {
      await shareDawahCardSafely({
        element: cardRefs.current[card.id],
        fallbackData: {
          speakerLine: card.speakerLine,
          lines: card.lines,
          source: card.source,
          qrDataUrl,
        },
        fileName: `mawaedh-${card.id}.png`,
        title: card.speakerLine,
        plainText: buildPlainText(card),
        shareUrl: getPublicSiteUrl('/?tab=cards'),
        onSuccess: () => {
          recordDownload(`card_${card.id}`);
          void trackCardEngagement(card.id);
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
        body: JSON.stringify({visitorKey}),
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
        onAiCardsChange?.(data.aiDawahCards);
      } else if (data.card) {
        onAiCardsChange?.([data.card, ...aiCards]);
      }
      setSelectedCategory('الكل');
      onNotify('تم توليد بطاقة دعوية سلفية جديدة وحفظها في الأرشيف الدائم');
    } catch {
      onNotify('تعذر الاتصال بالخادم لتجديد البطاقة حالياً');
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0c211a] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e1d25] dark:text-white">
              البطاقات الدعوية بالتصميم الكلاسيكي الدقيق
            </h1>
            <p className="text-sm text-[#3e4a42] dark:text-slate-300 mt-1">
              بطاقات سلفية نقية بخلفية بيضاء صافية وخطوط عربية واضحة بالتشكيل الكامل وباركود ذكي مدمج
            </p>
          </div>
          <span className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] tabular-nums">
            {formatNumber(allCards.length)} بطاقة دعوية معتمدة
          </span>
        </div>

        {/* Instant AI Regeneration Bar (3 attempts/day) */}
        <div className="rounded-2xl bg-[#f3faf6] dark:bg-[#112921] border border-[#006a46]/20 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6]" />
              <span>توليد وتجديد فوري للبطاقات بالذكاء الاصطناعي</span>
            </p>
            <p className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 tabular-nums">
              {remainingToday > 0
                ? `المحاولات المتبقية لك اليوم: ${formatNumber(remainingToday)} من ${formatNumber(DAILY_REGEN_LIMIT)}`
                : 'انتهت المحاولات الثلاث المتاحة لهذا اليوم — يتجدد الرصيد غداً بإذن الله'}
            </p>
          </div>
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
                  ? 'تجديد بطاقة جديدة الآن'
                  : 'استُنفدت محاولات اليوم'}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleCards.map((card) => {
          const dlCount = getItemDownloadCount(stats, `card_${card.id}`, 18);
          const engScore = cardEngagement[card.id] || 0;
          const isTrending = Boolean(card.isTrending || engScore >= 3);
          const waHref = `https://wa.me/?text=${encodeURIComponent(buildPlainText(card))}`;
          const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(buildPlainText(card))}`;

          return (
            <div
              key={card.id}
              className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0c211a] p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  {isTrending && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px] font-extrabold">
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                      <span>هذه البطاقة رائجة</span>
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

              {/* Pure #F8F9FA Classic Square Card */}
              <div
                ref={(el) => {
                  cardRefs.current[card.id] = el;
                }}
                data-dawah-card="true"
                dir="rtl"
                style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #E2E8F0',
                  color: '#111827',
                  fontFamily: '"Cairo", "Tajawal", "Amiri", sans-serif',
                }}
                className="aspect-square w-full rounded-2xl p-6 sm:p-8 flex flex-col justify-between text-center select-text"
              >
                {/* Top: Speaker + Tarahhum/Taraddi */}
                <p
                  style={{color: '#111827'}}
                  className="text-base sm:text-xl font-extrabold tracking-normal"
                >
                  {card.speakerLine}
                </p>

                {/* Center: Large Bold Multi-Line Quote with Alternating Sober Colors */}
                <div className="my-auto py-3 space-y-1.5 sm:space-y-2.5 flex flex-col items-center justify-center">
                  {card.lines.map((line, i) => (
                    <p
                      key={`${card.id}_line_${i}`}
                      style={{color: line.color}}
                      className="text-2xl sm:text-[32px] font-extrabold leading-[1.35]"
                    >
                      {line.text}
                    </p>
                  ))}
                </div>

                {/* Bottom Corners: Source, Copyright & Compact QR Code */}
                <div
                  style={{borderTop: '1px solid #E2E8F0'}}
                  className="flex items-end justify-between gap-3 pt-2.5"
                >
                  <span
                    style={{color: '#111827'}}
                    className="text-xs sm:text-sm font-bold text-right"
                  >
                    {card.source}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      style={{color: '#4B5563'}}
                      className="text-[10px] sm:text-[11px] font-semibold text-left leading-tight"
                    >
                      موقع مواعظ وعبر — جميع الحقوق محفوظة © 2027
                    </span>
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="رمز موقع مواعظ وعبر"
                        style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
                        className="w-10 h-10 rounded-md p-0.5 shrink-0"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Card Actions Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyCardId === card.id}
                  onClick={() => void handleShareCard(card)}
                  className="col-span-2 sm:col-span-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#7c5800] hover:bg-[#614400] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>مشاركة البطاقة</span>
                </button>
                <button
                  type="button"
                  disabled={busyCardId === card.id}
                  onClick={() => handleDownloadPng(card)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>تحميل (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(card)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#f3f6f4] dark:bg-white/10 hover:bg-[#e4ece7] text-[#0e1d25] dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>نسخ النص</span>
                </button>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void trackCardEngagement(card.id)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>واتساب</span>
                </a>
                <a
                  href={xHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void trackCardEngagement(card.id)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 text-sky-900 dark:text-sky-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>منصة X</span>
                </a>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6e7a71] dark:text-slate-400 px-1 pt-0.5">
                <span>التصنيف: {card.category}</span>
                <span className="tabular-nums font-semibold">
                  مرات تحميل البطاقة: {formatNumber(dlCount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
