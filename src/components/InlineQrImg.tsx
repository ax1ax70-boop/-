import {useEffect, useState} from 'react';
import {generateQrDataUrl} from '../utils/qrCode';

export function InlineQrImg({
  url,
  size = 180,
  className = 'w-14 h-14 rounded-lg bg-white p-1 border border-[#E2E8F0] shrink-0',
  alt = 'رمز الاستجابة السريعة (QR)',
}: {
  url: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    generateQrDataUrl(url, size).then((dataUrl) => {
      if (active && dataUrl) setSrc(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [url, size]);

  if (!src) {
    return (
      <div
        aria-hidden="true"
        style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
        className={className}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
      className={className}
    />
  );
}
