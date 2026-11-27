import {BarChart3, RefreshCw} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {NavTab, SectionStatsMap} from '../types';
import {useI18n} from '../utils/i18n';
import {
  TELEMETRY_UPDATED_EVENT,
  fetchSectionTelemetrySummary,
  mergeSectionStatsMonotonic,
  readLocalTelemetryFloors,
} from '../utils/telemetry';

export interface SectionTelemetryDescriptor {
  id: NavTab;
  label: string;
  onClick: () => void;
}

export function SectionTelemetryPanel({
  sectionStats,
  sections,
}: {
  sectionStats: SectionStatsMap;
  sections: SectionTelemetryDescriptor[];
}) {
  const {isEn, tr, formatNumber} = useI18n();
  const [telemetryMap, setTelemetryMap] = useState<SectionStatsMap>(() =>
    mergeSectionStatsMonotonic(readLocalTelemetryFloors().sectionStats, sectionStats),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Sync whenever parent telemetry prop updates
  useEffect(() => {
    setTelemetryMap((prev) => mergeSectionStatsMonotonic(prev, sectionStats));
  }, [sectionStats]);

  // Listen for live Telemetry updates from any section or share action
  useEffect(() => {
    const handleTelemetryEvent = (event: Event) => {
      const detail = (event as CustomEvent<SectionStatsMap>).detail;
      if (detail && typeof detail === 'object') {
        setTelemetryMap((prev) => mergeSectionStatsMonotonic(prev, detail));
      }
    };
    window.addEventListener(TELEMETRY_UPDATED_EVENT, handleTelemetryEvent);
    return () => window.removeEventListener(TELEMETRY_UPDATED_EVENT, handleTelemetryEvent);
  }, []);

  const refreshFromTelemetry = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const remoteStats = await fetchSectionTelemetrySummary();
      setTelemetryMap((prev) => mergeSectionStatsMonotonic(prev, remoteStats));
      setHasLoadedRemote(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Retrieve fresh data from the Telemetry registry on initial mount
  useEffect(() => {
    void refreshFromTelemetry();
  }, [refreshFromTelemetry]);

  const rows = useMemo(() => {
    const mapped = sections.map((sec) => {
      const entry = telemetryMap[sec.id] || {visits: 0, interactions: 0, shares: 0};
      const visits = Math.max(0, entry.visits || 0);
      const shares = Math.max(0, entry.shares || 0);
      return {
        ...sec,
        visits,
        shares,
      };
    });
    return mapped.sort((a, b) => b.visits + b.shares * 2 - (a.visits + a.shares * 2));
  }, [sections, telemetryMap]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, item) => ({
          visits: acc.visits + item.visits,
          shares: acc.shares + item.shares,
        }),
        {visits: 0, shares: 0},
      ),
    [rows],
  );

  const maxVisits = useMemo(() => Math.max(1, ...rows.map((r) => r.visits)), [rows]);
  const maxShares = useMemo(() => Math.max(1, ...rows.map((r) => r.shares)), [rows]);

  const visibleRows = showAll ? rows : rows.slice(0, 6);
  const hasAnyData = totals.visits > 0 || totals.shares > 0;

  return (
    <section
      aria-label={tr('إحصائيات تفاعل الأقسام', 'Section Telemetry Statistics')}
      dir={isEn ? 'ltr' : 'rtl'}
      className="rounded-2xl bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 p-4 sm:p-5 space-y-3"
    >
      {/* Clean single-row header with unboxed summary metadata & working refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm sm:text-base font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
            <span>{tr('إحصائيات الزيارات والمشاركات للأقسام', 'Section Visits & Shares (Telemetry)')}</span>
          </h2>
          <p className="text-xs text-[#6e7a71] dark:text-slate-400 tabular-nums">
            <span>
              {tr(
                `إجمالي زيارات الأقسام: ${formatNumber(totals.visits)}`,
                `Total Section Visits: ${totals.visits}`,
              )}
            </span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>
              {tr(
                `إجمالي المشاركات: ${formatNumber(totals.shares)}`,
                `Total Shares: ${totals.shares}`,
              )}
            </span>
            {hasLoadedRemote && (
              <>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>{tr('مُحدّث من سجل Telemetry', 'Synced from Telemetry')}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rows.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/15 hover:border-[#006a46] text-xs font-bold text-[#0e1d25] dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a46]"
            >
              {showAll
                ? tr('عرض الأبرز', 'Show Top 6')
                : tr(`عرض الكل (${formatNumber(rows.length)})`, `Show All (${rows.length})`)}
            </button>
          )}
          <button
            type="button"
            onClick={() => void refreshFromTelemetry()}
            disabled={isRefreshing}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#f4f7f5] dark:bg-white/10 hover:bg-[#e8efe9] dark:hover:bg-white/15 text-xs font-bold text-[#006a46] dark:text-[#6cdba6] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a46]"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? tr('جاري التحديث...', 'Refreshing...') : tr('تحديث', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Legend (unboxed inline labels with color swatches) */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#3e4a42] dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#006a46] dark:bg-[#6cdba6] inline-block" aria-hidden="true" />
          <span>{tr('عدد الزيارات', 'Visits')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#006389] dark:bg-[#7cc4fa] inline-block" aria-hidden="true" />
          <span>{tr('عدد المشاركات', 'Shares')}</span>
        </span>
      </div>

      {/* Clean hairline-divided visual rows (zero nested cards) */}
      {!hasAnyData && isRefreshing ? (
        <div className="space-y-2.5 py-2" aria-busy="true">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-10 rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : !hasAnyData ? (
        <div className="py-5 text-center space-y-2 border-t border-slate-100 dark:border-white/10">
          <p className="text-xs sm:text-sm text-[#6e7a71] dark:text-slate-400">
            {tr(
              'لم تُسجّل زيارات أو مشاركات للأقسام بعد؛ افتح أي قسم أو شارك محتواه ليظهر هنا تلقائياً.',
              'No section visits or shares recorded yet. Open or share any section to see live telemetry.',
            )}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/10 border-t border-slate-100 dark:border-white/10">
          {visibleRows.map((item) => {
            const visitPct = item.visits > 0 ? Math.max(6, Math.round((item.visits / maxVisits) * 100)) : 0;
            const sharePct = item.shares > 0 ? Math.max(6, Math.round((item.shares / maxShares) * 100)) : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="w-full py-2.5 px-1.5 -mx-1.5 rounded-lg hover:bg-[#f4f7f5] dark:hover:bg-white/5 transition-colors text-start grid grid-cols-1 sm:grid-cols-[minmax(140px,180px)_1fr_auto] items-center gap-2 sm:gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a46]"
              >
                <span className="text-xs sm:text-[13px] font-bold text-[#0e1d25] dark:text-white truncate">
                  {item.label}
                </span>

                {/* Dual proportional visual bars */}
                <div className="space-y-1 w-full">
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#006a46] dark:bg-[#6cdba6] transition-all duration-300"
                      style={{width: `${visitPct}%`}}
                    />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#006389] dark:bg-[#7cc4fa] transition-all duration-300"
                      style={{width: `${sharePct}%`}}
                    />
                  </div>
                </div>

                {/* Tabular numeric values */}
                <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px] sm:text-xs font-bold tabular-nums shrink-0">
                  <span className="text-[#006a46] dark:text-[#6cdba6]">
                    {tr(`الزيارات: ${formatNumber(item.visits)}`, `Visits: ${item.visits}`)}
                  </span>
                  <span className="text-[#006389] dark:text-[#7cc4fa]">
                    {tr(`المشاركات: ${formatNumber(item.shares)}`, `Shares: ${item.shares}`)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
