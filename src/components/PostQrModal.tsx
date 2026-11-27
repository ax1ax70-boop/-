import {Copy, Download, ExternalLink, QrCode, RefreshCw, Share2, X} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import type {Post} from '../types';
import {copyTextSafely, triggerBlobDownload} from '../utils/cardShare';
import {useI18n} from '../utils/i18n';
import {generateQrDataUrl} from '../utils/qrCode';
import {getPublicSiteUrl} from '../utils/storage';
import {BrandCircularMark} from './ClassicCardFooter';

function buildCardPreviewSnippet(rawBody: string, rawExcerpt: string, maxChars = 280): {
  previewText: string;
  hasMore: boolean;
} {
  const cleanBody = rawBody.replace(/\s+/g, ' ').trim();
  const cleanExcerpt = rawExcerpt.replace(/\s+/g, ' ').trim();
  const base = cleanBody.length >= cleanExcerpt.length ? cleanBody : cleanExcerpt;
  if (!base) return {previewText: '', hasMore: false};
  if (base.length <= maxChars) return {previewText: base, hasMore: false};
  const sliced = base.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const trimmed = (lastSpace > 120 ? sliced.slice(0, lastSpace) : sliced).trim();
  return {
    previewText: `${trimmed}...`,
    hasMore: true,
  };
}

export function PostQrModal({
  post,
  onClose,
  onNotify,
}: {
  post: Post | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const {tr, isEn} = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const postUrl = post
    ? getPublicSiteUrl(
        post.id === 'daily_wisdom_featured'
          ? '/?tab=home'
          : `/?post=${encodeURIComponent(post.id)}`,
      )
    : '';

  useEffect(() => {
    if (!post || !postUrl) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    setLoading(true);
    generateQrDataUrl(postUrl, 220)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [post, postUrl]);

  const {previewText, hasMore} = useMemo(() => {
    if (!post) return {previewText: '', hasMore: false};
    return buildCardPreviewSnippet(post.body || '', post.excerpt || '', 280);
  }, [post]);

  if (!post) return null;

  const isLongPost =
    hasMore ||
    (post.body || '').trim().length > 260 ||
    post.category === 'قصص وعبر';

  const handleCopyUrl = async () => {
    const ok = await copyTextSafely(postUrl);
    if (ok) {
      onNotify(tr('تم نسخ رابط المنشور للمشاركة', 'Post URL copied to clipboard'));
    } else {
      onNotify(postUrl);
    }
  };

  const handleShareUrl = async () => {
    const shareMsg = `${post.title}\n${previewText}\n\n${tr('للمزيد اضغط على الرابط:', 'Read more:')}\n${postUrl}`;
    const copied = await copyTextSafely(shareMsg);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: post.title,
          text: `${post.title} — ${post.author}\n${previewText}`,
          url: postUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    onNotify(
      copied
        ? tr('تم نسخ نص البطاقة والرابط وجاهز للمشاركة', 'Post preview & link copied and ready to share')
        : postUrl,
    );
  };

  const handleDownloadQr = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      triggerBlobDownload(blob, `qr-${post.id}.png`);
      onNotify(tr('تم حفظ صورة رمز الباركود (QR) بنجاح', 'QR code image downloaded'));
    } catch {
      onNotify(tr('تعذر تنزيل الصورة حالياً، يمكنك نسخ الرابط مباشرة', 'Could not download QR image'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pt-[40px] pb-[40px]"
      onClick={onClose}
    >
      <div
        dir={isEn ? 'ltr' : 'rtl'}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#223a32] text-[#0e1d25] dark:text-[#e3f3fe] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100dvh-96px)] overflow-y-auto border border-slate-200/80 dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#006a46]/12 text-[#006a46] dark:text-[#6cdba6] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold truncate">
                {tr('بطاقة المشاركة والرابط', 'Share Card & Link')}
              </h3>
              <p className="text-[11px] text-[#6e7a71] dark:text-slate-300 truncate">
                {post.sourceLabel || post.category}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close')}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Classic Compact Card Layout: Full Text Preview First + Compact Corner QR */}
        <div className="rounded-2xl bg-[#F8F9FA] dark:bg-[#192d26] border border-slate-200/80 dark:border-white/10 p-4 sm:p-5 space-y-3.5">
          <div className="text-center space-y-1">
            <p className="text-xs font-extrabold text-[#7c5800] dark:text-[#f2be5e]">{post.author}</p>
            <h4 className="text-base font-extrabold leading-snug text-[#111827] dark:text-white">
              {post.title}
            </h4>
          </div>

          {previewText && (
            <p
              dir={isEn ? 'ltr' : 'rtl'}
              className="text-sm leading-[1.8] font-medium text-[#1E3A8A] dark:text-slate-200 text-center"
            >
              {previewText}
            </p>
          )}

          {/* Continuation Notice + Clickable Link */}
          <div className="pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <p className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6]">
                {isLongPost
                  ? tr('للمزيد وتكملة القراءة اضغط على الرابط:', 'Tap the link below to read the full text:')
                  : tr('لفتح المشاركة في الموقع اضغط على الرابط:', 'Tap the link to open directly:')}
              </p>
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#006389] dark:text-[#80cfff] hover:underline break-all"
              >
                <span>{postUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* Compact Corner Logo + Small QR (never fills the page) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <BrandCircularMark size="sm" />
              <div className="w-14 h-14 rounded-lg bg-white p-1 border border-slate-200 flex items-center justify-center shrink-0">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#006a46]" />
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={tr(`رمز باركود للمنشور: ${post.title}`, `QR code for ${post.title}`)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!qrDataUrl}
            onClick={() => void handleDownloadQr()}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{tr('حفظ QR', 'Save QR')}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCopyUrl()}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#f3f6f4] dark:bg-white/10 hover:bg-[#e3ece7] text-[#0e1d25] dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span>{tr('نسخ الرابط', 'Copy URL')}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShareUrl()}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#7c5800] hover:bg-[#614400] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span>{tr('مشاركة', 'Share')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
