import {generateQrDataUrl} from './qrCode';

export interface CardRenderFallbackData {
  speakerLine: string;
  lines: Array<{text: string; color?: string}>;
  source: string;
  qrDataUrl?: string;
  qrUrl?: string;
  continuationNote?: string;
}

const LOGO_ASSET_PATH = '/assets/aistudio/d06af555-5476-4554-8f8c-0a58b8fa265e_c58761e4.webp';
const FONT_FAMILY = '"Cairo", "Tajawal", "Amiri", sans-serif';

async function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      if (!src.startsWith('data:')) {
        i.crossOrigin = 'anonymous';
      }
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image load failed'));
      i.src = src;
    });
    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        // Ignore decode warning if already loaded
      }
    }
    return img;
  } catch {
    return null;
  }
}

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      wrapped.push(current);
      current = word;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function renderHighResCardCanvas(data: CardRenderFallbackData): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness warning
    }
  }

  const width = 1080;
  const maxTextWidth = width - 160; // 920px safe content width

  // Offscreen measurement context
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 400;
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) throw new Error('Canvas 2D unavailable');
  mCtx.direction = 'rtl';

  // Determine total text length to pick crisp readable typography
  const rawTotalChars = data.lines.reduce((sum, l) => sum + (l.text || '').trim().length, 0);
  const quoteFontSize = rawTotalChars <= 140 ? 50 : rawTotalChars <= 260 ? 42 : 36;
  const quoteLineHeight = rawTotalChars <= 140 ? 80 : rawTotalChars <= 260 ? 68 : 60;

  mCtx.font = `800 34px ${FONT_FAMILY}`;
  const speakerLines = wrapArabicText(mCtx, data.speakerLine || '', maxTextWidth);
  const speakerLineHeight = 52;

  mCtx.font = `800 ${quoteFontSize}px ${FONT_FAMILY}`;
  const wrappedQuoteLines: Array<{text: string; color: string}> = [];
  for (const ln of data.lines) {
    const subLines = wrapArabicText(mCtx, ln.text || '', maxTextWidth);
    for (const sub of subLines) {
      wrappedQuoteLines.push({text: sub, color: ln.color || '#111827'});
    }
  }

  mCtx.font = `700 24px ${FONT_FAMILY}`;
  const noteLines = data.continuationNote
    ? wrapArabicText(mCtx, data.continuationNote, maxTextWidth)
    : [];

  mCtx.font = `700 25px ${FONT_FAMILY}`;
  const sourceLines = wrapArabicText(mCtx, data.source || '', 500).slice(0, 2);

  // Calculate dynamic non-clipping height (at least 1080px)
  const topPad = 86;
  const speakerBlockHeight = Math.max(1, speakerLines.length) * speakerLineHeight;
  const gapAfterSpeaker = 58;
  const quoteBlockHeight = Math.max(1, wrappedQuoteLines.length) * quoteLineHeight;
  const noteBlockHeight = noteLines.length > 0 ? noteLines.length * 36 + 34 : 0;
  const gapBeforeFooter = 58;
  const footerHeight = 200;

  const contentRequiredHeight =
    topPad +
    speakerBlockHeight +
    gapAfterSpeaker +
    quoteBlockHeight +
    noteBlockHeight +
    gapBeforeFooter +
    footerHeight;

  const height = Math.max(1080, Math.ceil(contentRequiredHeight));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Card background & crisp outer border
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, width, height);

  drawRoundedRectPath(ctx, 24, 24, width - 48, height - 48, 28);
  ctx.fillStyle = '#F8F9FA';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // Top Speaker Lines
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.font = `800 34px ${FONT_FAMILY}`;
  speakerLines.forEach((line, idx) => {
    ctx.fillText(line, width / 2, topPad + speakerLineHeight / 2 + idx * speakerLineHeight, maxTextWidth);
  });

  // Vertically center Quote + Note inside the area between Speaker and Footer
  const quoteAreaTop = topPad + speakerBlockHeight + gapAfterSpeaker;
  const quoteAreaBottom = height - footerHeight - 28;
  const totalInnerHeight = quoteBlockHeight + noteBlockHeight;
  const innerStartY = Math.max(
    quoteAreaTop,
    quoteAreaTop + (quoteAreaBottom - quoteAreaTop - totalInnerHeight) / 2,
  );

  ctx.font = `800 ${quoteFontSize}px ${FONT_FAMILY}`;
  wrappedQuoteLines.forEach((ln, idx) => {
    ctx.fillStyle = ln.color;
    ctx.fillText(
      ln.text,
      width / 2,
      innerStartY + quoteLineHeight / 2 + idx * quoteLineHeight,
      maxTextWidth,
    );
  });

  if (noteLines.length > 0) {
    ctx.fillStyle = '#006a46';
    ctx.font = `700 24px ${FONT_FAMILY}`;
    const noteStartY = innerStartY + quoteBlockHeight + 28;
    noteLines.forEach((nl, idx) => {
      ctx.fillText(nl, width / 2, noteStartY + idx * 34, maxTextWidth);
    });
  }

  // Footer divider
  const dividerY = height - footerHeight;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, dividerY);
  ctx.lineTo(width - 64, dividerY);
  ctx.stroke();

  // Right corner: Source label (clean, no clipping)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#111827';
  ctx.font = `700 25px ${FONT_FAMILY}`;
  const sourceBaseY = sourceLines.length > 1 ? dividerY + 76 : dividerY + 96;
  sourceLines.forEach((sl, idx) => {
    ctx.fillText(sl, width - 64, sourceBaseY + idx * 38, 500);
  });

  // Resolve QR Code image (use supplied qrDataUrl or generate from qrUrl)
  let resolvedQrUrl = data.qrDataUrl || '';
  if (!resolvedQrUrl && data.qrUrl) {
    try {
      resolvedQrUrl = await generateQrDataUrl(data.qrUrl, 240);
    } catch {
      resolvedQrUrl = '';
    }
  }

  // Left corner: ONE single QR Code + FULL uncropped Logo (NO copyright box)
  const qrSize = 122;
  const qrX = 64;
  const qrY = dividerY + 34;

  const [qrImg, logoImg] = await Promise.all([
    loadImageSafe(resolvedQrUrl),
    loadImageSafe(LOGO_ASSET_PATH),
  ]);

  if (qrImg) {
    drawRoundedRectPath(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // Logo frame next to QR — draw FULL image aspect-ratio contained without cropping edges
  const logoBoxSize = 96;
  const logoBoxX = qrX + qrSize + 28;
  const logoBoxY = qrY;

  drawRoundedRectPath(ctx, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (logoImg) {
    const natW = logoImg.naturalWidth || logoImg.width;
    const natH = logoImg.naturalHeight || logoImg.height;
    if (natW > 0 && natH > 0) {
      const innerPad = 8;
      const avail = logoBoxSize - innerPad * 2;
      const scale = Math.min(avail / natW, avail / natH);
      const drawW = natW * scale;
      const drawH = natH * scale;
      const drawX = logoBoxX + (logoBoxSize - drawW) / 2;
      const drawY = logoBoxY + (logoBoxSize - drawH) / 2;
      ctx.drawImage(logoImg, 0, 0, natW, natH, drawX, drawY, drawW, drawH);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#006a46';
  ctx.font = `800 20px ${FONT_FAMILY}`;
  ctx.fillText('مَواعِظ وَعِبَر', logoBoxX + logoBoxSize / 2, logoBoxY + logoBoxSize + 22, 140);

  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const [header, base64] = dataUrl.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
          const bin = atob(base64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], {type: mime}));
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Renders the Dawah Card directly on a high-DPI HTML5 2D Canvas so downloaded/shared
 * PNG images are never fragmented, clipped, or affected by responsive DOM CSS / Tailwind oklch.
 */
export async function renderCardPngBlob(
  _element: HTMLElement | null,
  fallbackData: CardRenderFallbackData,
): Promise<Blob> {
  const canvas = await renderHighResCardCanvas(fallbackData);
  return await canvasToPngBlob(canvas);
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
}

export async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareDawahCardSafely(params: {
  element: HTMLElement | null;
  fallbackData: CardRenderFallbackData;
  fileName: string;
  title: string;
  plainText: string;
  shareUrl?: string;
  onSuccess?: () => void;
  onNotify: (msg: string) => void;
}): Promise<void> {
  const {element, fallbackData, fileName, title, plainText, shareUrl, onSuccess, onNotify} = params;

  const copied = await copyTextSafely(shareUrl ? `${plainText}\n🔗 ${shareUrl}` : plainText);
  let blob: Blob | null = null;
  try {
    blob = await renderCardPngBlob(element, fallbackData);
  } catch {
    blob = null;
  }

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    if (blob && typeof File !== 'undefined') {
      try {
        const file = new File([blob], fileName, {type: 'image/png'});
        if (typeof nav.canShare === 'function' && nav.canShare({files: [file]})) {
          await nav.share({title, text: plainText, files: [file]});
          onSuccess?.();
          onNotify('تمت مشاركة البطاقة الدعوية بنجاح');
          return;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fall through to text share / local download+copy fallback
      }
    }

    try {
      await nav.share(shareUrl ? {title, text: plainText, url: shareUrl} : {title, text: plainText});
      onSuccess?.();
      onNotify('تمت مشاركة البطاقة بنجاح');
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Browser/iframe blocked Web Share API — fall back cleanly
    }
  }

  if (blob) {
    triggerBlobDownload(blob, fileName);
    onSuccess?.();
    onNotify(
      copied
        ? 'تم حفظ صورة البطاقة ونسخ النص تلقائياً — يمكنك مشاركتها مباشرة في واتساب أو تيليجرام'
        : 'تم حفظ صورة البطاقة الدعوية بصيغة PNG لمشاركتها مباشرة',
    );
    return;
  }

  if (copied) {
    onSuccess?.();
    onNotify('تم نسخ نص البطاقة ورابطها بنجاح للمشاركة المباشرة');
  } else {
    onNotify('تم تجهيز البطاقة الدعوية للمشاركة');
  }
}
