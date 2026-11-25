import QRCode from 'qrcode';

const qrCache = new Map<string, string>();

export const DEFAULT_PUBLIC_SITE_URL = 'https://mwaiz.com';

export function resolvePublicSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  return DEFAULT_PUBLIC_SITE_URL;
}

export async function generateQrDataUrl(url?: string, size = 128): Promise<string> {
  const target = (url && url.trim()) || resolvePublicSiteUrl();
  const cacheKey = `${target}::${size}`;
  const cached = qrCache.get(cacheKey);
  if (cached) return cached;

  try {
    const dataUrl = await QRCode.toDataURL(target, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#006a46',
        light: '#ffffff',
      },
    });
    qrCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}
