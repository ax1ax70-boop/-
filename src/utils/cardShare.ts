export interface CardRenderFallbackData {
  speakerLine: string;
  lines: Array<{text: string; color?: string}>;
  source: string;
  qrDataUrl?: string;
}

async function renderFallbackCardCanvas(data: CardRenderFallbackData): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness warning
    }
  }
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top Speaker Line
  ctx.fillStyle = '#111827';
  ctx.font = '800 38px "Cairo", "Tajawal", "Amiri", sans-serif';
  ctx.fillText(data.speakerLine, size / 2, 120, size - 140);

  // Center Quote Lines
  const lines = data.lines.slice(0, 6);
  const lineSpacing = lines.length <= 3 ? 105 : 88;
  const blockHeight = (lines.length - 1) * lineSpacing;
  const startY = size / 2 - blockHeight / 2;

  ctx.font = '800 58px "Cairo", "Tajawal", "Amiri", sans-serif';
  lines.forEach((ln, idx) => {
    ctx.fillStyle = ln.color || '#111827';
    ctx.fillText(ln.text, size / 2, startY + idx * lineSpacing, size - 140);
  });

  // Footer divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, size - 150);
  ctx.lineTo(size - 64, size - 150);
  ctx.stroke();

  // Right corner: Source
  ctx.textAlign = 'right';
  ctx.fillStyle = '#111827';
  ctx.font = '700 26px "Cairo", "Tajawal", "Amiri", sans-serif';
  ctx.fillText(data.source, size - 64, size - 95, size - 420);

  // Left corner: Copyright + QR
  const qrOffset = data.qrDataUrl ? 148 : 64;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4B5563';
  ctx.font = '600 21px "Cairo", "Tajawal", "Amiri", sans-serif';
  ctx.fillText('موقع مواعظ وعبر — جميع الحقوق محفوظة © 2027', qrOffset, size - 95, 420);

  if (data.qrDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('QR image load failed'));
        i.src = data.qrDataUrl!;
      });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(60, size - 134, 76, 76);
      ctx.drawImage(img, 64, size - 130, 68, 68);
    } catch {
      // Proceed cleanly without QR if blocked
    }
  }

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

export async function renderCardPngBlob(
  element: HTMLElement | null,
  fallbackData: CardRenderFallbackData,
): Promise<Blob> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font load errors
    }
  }

  if (element) {
    try {
      const {default: html2canvas} = await import('html2canvas');
      const canvas = await html2canvas(element, {
        backgroundColor: '#F8F9FA',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Strip Tailwind oklch/color-mix styles from cloned root stylesheets if needed;
          // elements inside the card use explicit inline hex colors.
          const cardNodes = clonedDoc.querySelectorAll('[data-dawah-card="true"]');
          cardNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.style.backgroundColor = '#F8F9FA';
              node.style.borderColor = '#E2E8F0';
              node.style.color = '#111827';
            }
          });
        },
      });
      return await canvasToPngBlob(canvas);
    } catch {
      // Automatic fallback to pure HTML5 2D Canvas renderer (100% immune to CSS oklch)
    }
  }

  const fallbackCanvas = await renderFallbackCardCanvas(fallbackData);
  return await canvasToPngBlob(fallbackCanvas);
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
      // Browser/iframe blocked Web Share API — do NOT throw or show error; fall back cleanly!
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
