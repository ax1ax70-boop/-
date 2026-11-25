import {Copy, Download, MessageCircle, Share2, X} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {Post} from '../types';
import {
  copyTextSafely,
  renderCardPngBlob,
  shareDawahCardSafely,
  triggerBlobDownload,
} from '../utils/cardShare';
import {useI18n} from '../utils/i18n';
import {getItemDownloadCount, useLiveStats} from '../utils/liveStats';
import {generateQrDataUrl} from '../utils/qrCode';
import {getPublicSiteUrl} from '../utils/storage';

const LINE_COLORS: Array<'#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309'> = [
  '#1E3A8A',
  '#111827',
  '#991B1B',
  '#065F46',
  '#B45309',
];

function splitIntoClassicLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [words.join(' ')];
  const lines: string[] = [];
  const perLine = words.length <= 9 ? 3 : 4;
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(' '));
  }
  return lines.slice(0, 5);
}

export function CardShareModal({
  post,
  onClose,
  onNotify,
}: {
  post: Post | null;
  brandHandle?: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const {tr, formatNumber} = useI18n();
  const {stats, recordDownload} = useLiveStats();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!post) return;
    let active = true;
    generateQrDataUrl(getPublicSiteUrl(), 96).then((url) => {
      if (active && url) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [post]);

  const lines = useMemo(() => {
    if (!post) return [];
    const mainQuote = post.title.length > 22 ? post.title : post.excerpt || post.title;
    return splitIntoClassicLines(mainQuote);
  }, [post]);

  if (!post) return null;

  const dlCount = getItemDownloadCount(stats, `post_${post.id}`, 14);
  const fullPlainText = `${post.author}\n\n${post.title}\n${post.excerpt}\n\n[${post.sourceLabel || post.category}]\nموقع مواعظ وعبر — جميع الحقوق محفوظة © 2027`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(fullPlainText)}`;
  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(fullPlainText)}`;

  const fallbackCardData = {
    speakerLine: post.author,
    lines: lines.map((ln, idx) => ({text: ln, color: LINE_COLORS[idx % LINE_COLORS.length]})),
    source: post.sourceLabel || post.category,
    qrDataUrl,
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderCardPngBlob(cardRef.current, fallbackCardData);
      triggerBlobDownload(blob, `mawaedh-${post.id}.png`);
      recordDownload(`post_${post.id}`);
      onNotify(tr('تم حفظ البطاقة الدعوية بصيغة PNG بنجاح', 'Wisdom card saved as PNG'));
    } catch {
      onNotify(tr('تم تجهيز نص البطاقة — يمكنك نسخه ومشاركته مباشرة', 'Card text ready to share'));
    } finally {
      setBusy(false);
    }
  };

  const handleShareCard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareDawahCardSafely({
        element: cardRef.current,
        fallbackData: fallbackCardData,
        fileName: `mawaedh-${post.id}.png`,
        title: post.title,
        plainText: fullPlainText,
        shareUrl: getPublicSiteUrl(`/?post=${encodeURIComponent(post.id)}`),
        onSuccess: () => recordDownload(`post_${post.id}`),
        onNotify,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyText = async () => {
    const ok = await copyTextSafely(fullPlainText);
    if (ok) {
      onNotify(tr('تم نسخ نص البطاقة للمشاركة', 'Card text copied for sharing'));
    } else {
      onNotify(tr('نص البطاقة جاهز للمشاركة', 'Card text ready'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pt-[40px] pb-[40px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0c211a] text-[#0e1d25] dark:text-[#e3f3fe] p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-96px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{tr('البطاقة الدعوية للمشاركة', 'Classic Dawah Share Card')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close')}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Classic Clean White Square Card */}
        <div
          ref={cardRef}
          data-dawah-card="true"
          dir="rtl"
          style={{
            backgroundColor: '#F8F9FA',
            border: '1px solid #E2E8F0',
            color: '#111827',
            fontFamily: '"Cairo", "Tajawal", "Amiri", sans-serif',
          }}
          className="aspect-square w-full rounded-2xl p-6 flex flex-col justify-between text-center"
        >
          <p style={{color: '#111827'}} className="text-base sm:text-lg font-extrabold">
            {post.author}
          </p>

          <div className="my-auto py-2 space-y-1.5 flex flex-col items-center justify-center">
            {lines.map((ln, idx) => (
              <p
                key={`${post.id}_ln_${idx}`}
                style={{color: LINE_COLORS[idx % LINE_COLORS.length]}}
                className="text-xl sm:text-2xl font-extrabold leading-[1.38]"
              >
                {ln}
              </p>
            ))}
          </div>

          <div
            style={{borderTop: '1px solid #E2E8F0'}}
            className="flex items-end justify-between gap-2 pt-2"
          >
            <span style={{color: '#111827'}} className="text-xs font-bold text-right">
              {post.sourceLabel || post.category}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span style={{color: '#4B5563'}} className="text-[10px] font-semibold text-left leading-tight">
                موقع مواعظ وعبر — جميع الحقوق محفوظة © 2027
              </span>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="رمز موقع مواعظ وعبر"
                  style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
                  className="w-9 h-9 rounded-md p-0.5 shrink-0"
                />
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleShareCard()}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#7c5800] hover:bg-[#614400] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>{busy ? 'جاري تجهيز البطاقة...' : 'مشاركة البطاقة (صورة ونص)'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleDownload}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تحميل كصورة (PNG)</span>
          </button>
          <button
            type="button"
            onClick={handleCopyText}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#f3f6f4] dark:bg-white/10 text-[#0e1d25] dark:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>نسخ النص</span>
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>مشاركة واتساب</span>
          </a>
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[42px] px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>مشاركة على منصة X</span>
          </a>
        </div>

        <p className="text-center text-xs text-[#6e7a71] dark:text-slate-400 tabular-nums">
          عدد تحميلات هذه البطاقة: {formatNumber(dlCount)}
        </p>
      </div>
    </div>
  );
}
