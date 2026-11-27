import {InlineQrImg} from './InlineQrImg';

export const BRAND_LOGO_ASSET = '/assets/aistudio/d06af555-5476-4554-8f8c-0a58b8fa265e_c58761e4.webp';

export function BrandCircularMark({size = 'md'}: {size?: 'sm' | 'md'}) {
  const boxSize = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14 sm:w-16 sm:h-16';

  return (
    <div
      style={{backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0'}}
      className={`${boxSize} rounded-xl p-1 flex items-center justify-center shrink-0`}
    >
      <img
        src={BRAND_LOGO_ASSET}
        alt="شعار مواعظ وعبر"
        className="w-full h-full object-contain block"
      />
    </div>
  );
}

export function CompactCopyrightBox(_props: {compact?: boolean}) {
  return null;
}

export function ClassicCardFooter({
  sourceLabel,
  qrUrl,
  compact = false,
}: {
  sourceLabel: string;
  qrUrl: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{borderTop: '1px solid #E2E8F0'}}
      className="flex items-end justify-between gap-2.5 pt-2.5 w-full"
    >
      <span
        style={{color: '#111827'}}
        className={`${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'} font-bold text-right leading-snug`}
      >
        {sourceLabel}
      </span>

      <div className="flex items-end gap-2 shrink-0">
        <BrandCircularMark size={compact ? 'sm' : 'md'} />
        <InlineQrImg
          url={qrUrl}
          size={220}
          alt="باركود موقع مواعظ وعبر"
          className={`${
            compact ? 'w-12 h-12 sm:w-13 sm:h-13' : 'w-14 h-14 sm:w-[64px] sm:h-[64px]'
          } rounded-lg p-1 shrink-0`}
        />
      </div>
    </div>
  );
}
