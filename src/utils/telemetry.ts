import type {SectionStatsMap} from '../types';
import {bumpCloudClicks, syncCloudVisitAndReadCounters} from './cloudSync';

type InteractionKind = 'click' | 'sermon_read' | 'sermon_share' | 'adhkar_tap' | 'adhkar_complete';

interface QueuedBucket {
  kind: InteractionKind;
  category?: string;
  section?: string;
  count: number;
}

export interface TelemetryCountersPayload {
  visitorsCount?: number;
  clicksCount?: number;
  onlineVisitorsCount?: number;
  registeredMembersCount?: number;
  sectionStats?: SectionStatsMap;
}

const PRESENCE_SID_KEY = 'mawaedh_presence_sid_v1';
const MONOTONIC_FLOORS_KEY = 'mawaedh_monotonic_telemetry_v1';
const MIN_VISITORS_FLOOR = 4580;
const MIN_CLICKS_FLOOR = 8540;

const queue = new Map<string, QueuedBucket>();
let flushTimer: number | null = null;
let fallbackSessionId: string | null = null;
let visitRecordedThisLoad = false;
let inFlightVisitPromise: Promise<TelemetryCountersPayload | null> | null = null;
let currentActiveSection = 'home';

export const TELEMETRY_UPDATED_EVENT = 'mawaedh:telemetry-updated';

function emitTelemetryUpdated(sectionStats: SectionStatsMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<SectionStatsMap>(TELEMETRY_UPDATED_EVENT, {detail: sectionStats}));
  } catch {
    // Ignore event dispatch failure
  }
}

export function setCurrentTelemetrySection(section: string): void {
  const normalized = section.trim().slice(0, 40);
  if (normalized) {
    currentActiveSection = normalized;
  }
}

export function mergeSectionStatsMonotonic(
  prev: SectionStatsMap | undefined,
  next: SectionStatsMap | undefined,
): SectionStatsMap {
  const merged: SectionStatsMap = {};
  if (prev && typeof prev === 'object') {
    for (const [key, val] of Object.entries(prev)) {
      if (!val || typeof val !== 'object') continue;
      merged[key] = {
        visits: Math.max(0, Math.floor(Number(val.visits) || 0)),
        interactions: Math.max(0, Math.floor(Number(val.interactions) || 0)),
        shares: Math.max(0, Math.floor(Number(val.shares) || 0)),
      };
    }
  }
  if (next && typeof next === 'object') {
    for (const [key, val] of Object.entries(next)) {
      if (!val || typeof val !== 'object') continue;
      const existing = merged[key] || {visits: 0, interactions: 0, shares: 0};
      merged[key] = {
        visits: Math.max(existing.visits, Math.floor(Number(val.visits) || 0)),
        interactions: Math.max(existing.interactions, Math.floor(Number(val.interactions) || 0)),
        shares: Math.max(existing.shares || 0, Math.floor(Number(val.shares) || 0)),
      };
    }
  }
  return merged;
}

export function readLocalTelemetryFloors(): {
  visitorsCount: number;
  clicksCount: number;
  registeredMembersCount: number;
  sectionStats: SectionStatsMap;
} {
  if (typeof window === 'undefined') {
    return {
      visitorsCount: MIN_VISITORS_FLOOR,
      clicksCount: MIN_CLICKS_FLOOR,
      registeredMembersCount: 0,
      sectionStats: {},
    };
  }
  try {
    const raw = window.localStorage.getItem(MONOTONIC_FLOORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{
        visitorsCount: number;
        clicksCount: number;
        registeredMembersCount: number;
        sectionStats: SectionStatsMap;
      }>;
      return {
        visitorsCount: Math.max(MIN_VISITORS_FLOOR, Number(parsed.visitorsCount) || MIN_VISITORS_FLOOR),
        clicksCount: Math.max(MIN_CLICKS_FLOOR, Number(parsed.clicksCount) || MIN_CLICKS_FLOOR),
        registeredMembersCount: Math.max(0, Number(parsed.registeredMembersCount) || 0),
        sectionStats: mergeSectionStatsMonotonic({}, parsed.sectionStats),
      };
    }
  } catch {
    // Ignore storage restriction
  }
  return {
    visitorsCount: MIN_VISITORS_FLOOR,
    clicksCount: MIN_CLICKS_FLOOR,
    registeredMembersCount: 0,
    sectionStats: {},
  };
}

export function saveLocalTelemetryFloors(next: TelemetryCountersPayload): {
  visitorsCount: number;
  clicksCount: number;
  registeredMembersCount: number;
  sectionStats: SectionStatsMap;
} {
  const prev = readLocalTelemetryFloors();
  const merged = {
    visitorsCount: Math.max(prev.visitorsCount, MIN_VISITORS_FLOOR, Number(next.visitorsCount) || 0),
    clicksCount: Math.max(prev.clicksCount, MIN_CLICKS_FLOOR, Number(next.clicksCount) || 0),
    registeredMembersCount: Math.max(
      prev.registeredMembersCount,
      Number(next.registeredMembersCount) || 0,
    ),
    sectionStats: mergeSectionStatsMonotonic(prev.sectionStats, next.sectionStats),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MONOTONIC_FLOORS_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota
    }
  }
  return merged;
}

export function getPresenceSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.sessionStorage.getItem(PRESENCE_SID_KEY);
    if (existing && existing.trim()) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(PRESENCE_SID_KEY, generated);
    return generated;
  } catch {
    if (!fallbackSessionId) {
      fallbackSessionId = `sid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return fallbackSessionId;
  }
}

function flushTelemetry(): void {
  if (typeof window === 'undefined' || queue.size === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const entries = [...queue.values()];
  queue.clear();
  const floors = readLocalTelemetryFloors();
  let totalDelta = 0;

  for (const item of entries) {
    totalDelta += item.count;
    fetch('/api/telemetry/interaction', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...item,
        clientClicksFloor: floors.clicksCount,
        clientSectionStatsFloor: floors.sectionStats,
      }),
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as TelemetryCountersPayload;
        saveLocalTelemetryFloors({
          clicksCount: data.clicksCount,
          sectionStats: data.sectionStats,
        });
      })
      .catch(() => {
        // Silently ignore offline / transient telemetry errors
      });
  }

  if (totalDelta > 0) {
    void bumpCloudClicks(totalDelta, floors.clicksCount)
      .then((cloudClicks) => {
        if (typeof cloudClicks === 'number') {
          saveLocalTelemetryFloors({clicksCount: cloudClicks});
        }
      })
      .catch(() => undefined);
  }
}

export function trackInteraction(
  kind: InteractionKind,
  category?: string,
  sectionOverride?: string,
): SectionStatsMap | undefined {
  if (typeof window === 'undefined') return undefined;
  const section = (sectionOverride || currentActiveSection || 'home').trim().slice(0, 40);
  const prevFloors = readLocalTelemetryFloors();
  const prevSec = prevFloors.sectionStats[section] || {visits: 0, interactions: 0, shares: 0};
  const shareDelta = kind === 'sermon_share' ? 1 : 0;
  const updatedSectionStats: SectionStatsMap = {
    ...prevFloors.sectionStats,
    [section]: {
      visits: prevSec.visits,
      interactions: prevSec.interactions + 1,
      shares: (prevSec.shares || 0) + shareDelta,
    },
  };

  const saved = saveLocalTelemetryFloors({
    clicksCount: prevFloors.clicksCount + 1,
    sectionStats: updatedSectionStats,
  });
  emitTelemetryUpdated(saved.sectionStats);

  const key = `${kind}:${category || ''}:${section}`;
  const existing = queue.get(key);
  if (existing) {
    existing.count = Math.min(200, existing.count + 1);
  } else {
    queue.set(key, {kind, category, section, count: 1});
  }

  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }

  // Batch rapid taps/clicks smoothly
  const delayMs = kind === 'adhkar_tap' || kind === 'click' ? 1200 : 250;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushTelemetry();
  }, delayMs);

  return saved.sectionStats;
}

export async function trackSectionVisit(section: string): Promise<SectionStatsMap | null> {
  if (typeof window === 'undefined') return null;
  const cleanSection = section.trim().slice(0, 40);
  if (!cleanSection || cleanSection === 'splash' || cleanSection === 'admin-studio') {
    return null;
  }
  setCurrentTelemetrySection(cleanSection);

  const prevFloors = readLocalTelemetryFloors();
  const prevEntry = prevFloors.sectionStats[cleanSection] || {visits: 0, interactions: 0, shares: 0};
  const optimistic: SectionStatsMap = {
    ...prevFloors.sectionStats,
    [cleanSection]: {
      visits: prevEntry.visits + 1,
      interactions: prevEntry.interactions,
      shares: prevEntry.shares || 0,
    },
  };
  const savedOptimistic = saveLocalTelemetryFloors({sectionStats: optimistic});
  emitTelemetryUpdated(savedOptimistic.sectionStats);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return savedOptimistic.sectionStats;
  }

  try {
    const res = await fetch('/api/telemetry/section-visit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        section: cleanSection,
        clientSectionStatsFloor: savedOptimistic.sectionStats,
      }),
      keepalive: true,
    });
    if (!res.ok) return savedOptimistic.sectionStats;
    const data = (await res.json()) as {sectionStats?: SectionStatsMap};
    const merged = saveLocalTelemetryFloors({sectionStats: data.sectionStats || savedOptimistic.sectionStats});
    emitTelemetryUpdated(merged.sectionStats);
    return merged.sectionStats;
  } catch {
    return savedOptimistic.sectionStats;
  }
}

export async function fetchSectionTelemetrySummary(): Promise<SectionStatsMap> {
  const local = readLocalTelemetryFloors().sectionStats;
  if (typeof window === 'undefined') return local;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return local;
  try {
    const res = await fetch('/api/telemetry/sections', {cache: 'no-store'});
    if (!res.ok) return local;
    const data = (await res.json()) as {
      sectionStats?: SectionStatsMap;
      totalVisitors?: number;
      totalClicks?: number;
    };
    const merged = saveLocalTelemetryFloors({
      visitorsCount: data.totalVisitors,
      clicksCount: data.totalClicks,
      sectionStats: data.sectionStats,
    });
    emitTelemetryUpdated(merged.sectionStats);
    return merged.sectionStats;
  } catch {
    return local;
  }
}

export async function trackVisitorSession(): Promise<TelemetryCountersPayload | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (visitRecordedThisLoad) {
    return await sendPresenceHeartbeat();
  }
  if (inFlightVisitPromise) {
    return inFlightVisitPromise;
  }
  const sessionId = getPresenceSessionId();
  const localFloors = readLocalTelemetryFloors();
  inFlightVisitPromise = (async () => {
    try {
      const [serverRes, cloudRes] = await Promise.all([
        fetch('/api/telemetry/visit', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            sessionId,
            clientVisitorsFloor: localFloors.visitorsCount,
            clientClicksFloor: localFloors.clicksCount,
            clientMembersFloor: localFloors.registeredMembersCount,
            clientSectionStatsFloor: localFloors.sectionStats,
          }),
        })
          .then(async (r) => (r.ok ? ((await r.json()) as TelemetryCountersPayload) : null))
          .catch(() => null),
        syncCloudVisitAndReadCounters({
          countVisit: true,
          minVisitors: localFloors.visitorsCount,
          minClicks: localFloors.clicksCount,
          minMembers: localFloors.registeredMembersCount,
        }),
      ]);

      visitRecordedThisLoad = true;
      const merged = saveLocalTelemetryFloors({
        visitorsCount: Math.max(
          serverRes?.visitorsCount || MIN_VISITORS_FLOOR,
          cloudRes?.visitorsCount || MIN_VISITORS_FLOOR,
        ),
        clicksCount: Math.max(
          serverRes?.clicksCount || MIN_CLICKS_FLOOR,
          cloudRes?.clicksCount || MIN_CLICKS_FLOOR,
        ),
        registeredMembersCount: Math.max(
          serverRes?.registeredMembersCount || 0,
          cloudRes?.registeredMembersCount || 0,
        ),
        sectionStats: serverRes?.sectionStats,
      });

      // Push cloud high-water mark back to server if cloud exceeded server
      if (
        cloudRes &&
        serverRes &&
        (cloudRes.visitorsCount > (serverRes.visitorsCount || 0) ||
          cloudRes.clicksCount > (serverRes.clicksCount || 0) ||
          cloudRes.registeredMembersCount > (serverRes.registeredMembersCount || 0))
      ) {
        void fetch('/api/telemetry/sync-floor', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            clientVisitorsFloor: merged.visitorsCount,
            clientClicksFloor: merged.clicksCount,
            clientMembersFloor: merged.registeredMembersCount,
            clientSectionStatsFloor: merged.sectionStats,
          }),
        }).catch(() => undefined);
      }

      return {
        visitorsCount: merged.visitorsCount,
        clicksCount: merged.clicksCount,
        registeredMembersCount: merged.registeredMembersCount,
        onlineVisitorsCount: serverRes?.onlineVisitorsCount,
        sectionStats: merged.sectionStats,
      };
    } catch {
      return null;
    } finally {
      inFlightVisitPromise = null;
    }
  })();
  return inFlightVisitPromise;
}

export async function sendPresenceHeartbeat(): Promise<TelemetryCountersPayload | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const localFloors = readLocalTelemetryFloors();
  try {
    const res = await fetch('/api/telemetry/presence', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        sessionId: getPresenceSessionId(),
        clientVisitorsFloor: localFloors.visitorsCount,
        clientClicksFloor: localFloors.clicksCount,
        clientMembersFloor: localFloors.registeredMembersCount,
        clientSectionStatsFloor: localFloors.sectionStats,
      }),
      keepalive: true,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TelemetryCountersPayload;
    const merged = saveLocalTelemetryFloors(data);
    return {
      ...data,
      visitorsCount: merged.visitorsCount,
      clicksCount: merged.clicksCount,
      registeredMembersCount: merged.registeredMembersCount,
      sectionStats: merged.sectionStats,
    };
  } catch {
    return null;
  }
}

export function sendPresenceLeave(): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const payload = JSON.stringify({sessionId: getPresenceSessionId(), leave: true});
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], {type: 'application/json'});
      navigator.sendBeacon('/api/telemetry/presence', blob);
      return;
    }
  } catch {
    // Fallback to keepalive fetch
  }
  fetch('/api/telemetry/presence', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushTelemetry();
    }
  });
}
