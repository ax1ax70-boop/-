export interface CustomDhikrAlertRule {
  id: string;
  dhikrId: string;
  dhikrTitle: string;
  dhikrText: string;
  dhikrSource?: string;
  time: string;
  enabled: boolean;
  lastNotifiedDate: string;
}

export interface AdhkarReminderSettings {
  enabled: boolean;
  morningEnabled: boolean;
  morningTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
  lastMorningNotifiedDate: string;
  lastEveningNotifiedDate: string;
  customAlerts: CustomDhikrAlertRule[];
}

const REMINDER_STORAGE_KEY = 'mawaedh_adhkar_reminders_v1';

export const DEFAULT_REMINDER_SETTINGS: AdhkarReminderSettings = {
  enabled: false,
  morningEnabled: true,
  morningTime: '06:00',
  eveningEnabled: true,
  eveningTime: '16:30',
  lastMorningNotifiedDate: '',
  lastEveningNotifiedDate: '',
  customAlerts: [],
};

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeTimeString(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
}

function normalizeCustomAlert(raw: unknown, idx: number): CustomDhikrAlertRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<CustomDhikrAlertRule>;
  const dhikrId = typeof obj.dhikrId === 'string' ? obj.dhikrId.trim() : '';
  const dhikrText = typeof obj.dhikrText === 'string' ? obj.dhikrText.trim() : '';
  if (!dhikrId || !dhikrText) return null;
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : `custom_alert_${dhikrId}_${idx}`;
  const dhikrTitle =
    typeof obj.dhikrTitle === 'string' && obj.dhikrTitle.trim()
      ? obj.dhikrTitle.trim()
      : dhikrText.slice(0, 48);
  return {
    id,
    dhikrId,
    dhikrTitle,
    dhikrText,
    dhikrSource: typeof obj.dhikrSource === 'string' ? obj.dhikrSource.trim() : undefined,
    time: normalizeTimeString(obj.time, '12:00'),
    enabled: obj.enabled !== false,
    lastNotifiedDate: typeof obj.lastNotifiedDate === 'string' ? obj.lastNotifiedDate : '',
  };
}

export function loadReminderSettings(): AdhkarReminderSettings {
  if (typeof window === 'undefined') return DEFAULT_REMINDER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdhkarReminderSettings>;
    const customAlerts = Array.isArray(parsed.customAlerts)
      ? parsed.customAlerts
          .map((item, idx) => normalizeCustomAlert(item, idx))
          .filter((item): item is CustomDhikrAlertRule => item !== null)
      : [];
    return {
      enabled: Boolean(parsed.enabled),
      morningEnabled: parsed.morningEnabled !== false,
      morningTime: normalizeTimeString(parsed.morningTime, DEFAULT_REMINDER_SETTINGS.morningTime),
      eveningEnabled: parsed.eveningEnabled !== false,
      eveningTime: normalizeTimeString(parsed.eveningTime, DEFAULT_REMINDER_SETTINGS.eveningTime),
      lastMorningNotifiedDate:
        typeof parsed.lastMorningNotifiedDate === 'string' ? parsed.lastMorningNotifiedDate : '',
      lastEveningNotifiedDate:
        typeof parsed.lastEveningNotifiedDate === 'string' ? parsed.lastEveningNotifiedDate : '',
      customAlerts,
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function saveReminderSettings(settings: AdhkarReminderSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  if (window.Notification.permission === 'granted') return 'granted';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export async function dispatchLocalNotification({
  title,
  body,
  tag,
  dhikrId,
  onClickNavigate,
}: {
  title: string;
  body: string;
  tag: string;
  dhikrId?: string;
  onClickNavigate?: (dhikrId?: string) => void;
}): Promise<boolean> {
  if (!isNotificationSupported() || window.Notification.permission !== 'granted') {
    return false;
  }

  const targetUrl = dhikrId
    ? `/?tab=adhkar&dhikr=${encodeURIComponent(dhikrId)}`
    : '/?tab=adhkar';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          dir: 'rtl',
          lang: 'ar',
          data: {url: targetUrl},
        });
        return true;
      }
    }
  } catch {
    // Fallback to Notification constructor below
  }

  try {
    const notification = new window.Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
      dir: 'rtl',
      lang: 'ar',
    });
    notification.onclick = () => {
      try {
        window.focus();
        onClickNavigate?.(dhikrId);
        notification.close();
      } catch {
        // Ignore
      }
    };
    return true;
  } catch {
    return false;
  }
}

function parseMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

/**
 * Computes exact milliseconds until the next local scheduled dhikr alert
 * (morning, evening, or custom per-dhikr rules) so browser timers fire on the minute.
 */
export function computeNextScheduledDelayMs(
  settings: AdhkarReminderSettings,
  now = new Date(),
): number | null {
  if (!settings.enabled) return null;
  const times: string[] = [];
  if (settings.morningEnabled) times.push(settings.morningTime);
  if (settings.eveningEnabled) times.push(settings.eveningTime);
  for (const rule of settings.customAlerts || []) {
    if (rule.enabled) times.push(rule.time);
  }
  if (times.length === 0) return null;

  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let minDelaySec = Number.POSITIVE_INFINITY;

  for (const t of times) {
    const mins = parseMinutes(t);
    if (mins < 0) continue;
    const targetSec = mins * 60;
    let deltaSec = targetSec - nowSeconds;
    if (deltaSec <= 0) {
      deltaSec += 24 * 3600;
    }
    if (deltaSec < minDelaySec) {
      minDelaySec = deltaSec;
    }
  }

  if (!Number.isFinite(minDelaySec)) return null;
  return Math.max(1000, minDelaySec * 1000 + 250);
}

export function formatCustomDhikrAlertBody(rule: CustomDhikrAlertRule): string {
  const clean = rule.dhikrText.replace(/\s+/g, ' ').trim();
  const excerpt = clean.length > 150 ? `${clean.slice(0, 147).trim()}...` : clean;
  return rule.dhikrSource ? `${excerpt} — [${rule.dhikrSource}]` : excerpt;
}

export async function triggerCustomDhikrNotificationNow({
  rule,
  isEn,
  appName,
  onOpenAdhkar,
  onInAppNotify,
}: {
  rule: CustomDhikrAlertRule;
  isEn: boolean;
  appName: string;
  onOpenAdhkar: (dhikrId?: string) => void;
  onInAppNotify: (msg: string) => void;
}): Promise<boolean> {
  const title = isEn
    ? `Scheduled Dhikr · ${appName}`
    : `تذكير ذكر مخصص · ${rule.dhikrTitle}`;
  const body = formatCustomDhikrAlertBody(rule);
  const sent = await dispatchLocalNotification({
    title,
    body,
    tag: `mawaedh-custom-test-${rule.id}-${Date.now()}`,
    dhikrId: rule.dhikrId,
    onClickNavigate: onOpenAdhkar,
  });
  onInAppNotify(
    isEn ? `Scheduled Dhikr Reminder: ${body}` : `🔔 تذكير الذكر (${rule.time}): ${body}`,
  );
  return sent;
}

export async function checkAndTriggerScheduledReminders({
  settings,
  isEn,
  appName,
  onUpdateSettings,
  onOpenAdhkar,
  onInAppNotify,
}: {
  settings: AdhkarReminderSettings;
  isEn: boolean;
  appName: string;
  onUpdateSettings: (next: AdhkarReminderSettings) => void;
  onOpenAdhkar: (dhikrId?: string) => void;
  onInAppNotify: (msg: string) => void;
}): Promise<void> {
  if (!settings.enabled) return;

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let updated = settings;
  let changed = false;

  if (settings.morningEnabled && settings.lastMorningNotifiedDate !== todayKey) {
    const targetMinutes = parseMinutes(settings.morningTime);
    if (targetMinutes >= 0 && nowMinutes >= targetMinutes && nowMinutes - targetMinutes <= 15) {
      const title = isEn ? `Morning Adhkar · ${appName}` : `تذكير أذكار الصباح · ${appName}`;
      const body = isEn
        ? 'Time for your Morning Adhkar and comprehensive daily supplications.'
        : 'حان الآن موعد أذكار الصباح والأذكار والأدعية الجامعة؛ حصّن يومك بذكر الله.';
      await dispatchLocalNotification({
        title,
        body,
        tag: `mawaedh-morning-${todayKey}`,
        onClickNavigate: () => onOpenAdhkar(),
      });
      onInAppNotify(body);
      updated = {...updated, lastMorningNotifiedDate: todayKey};
      changed = true;
    }
  }

  if (settings.eveningEnabled && settings.lastEveningNotifiedDate !== todayKey) {
    const targetMinutes = parseMinutes(settings.eveningTime);
    if (targetMinutes >= 0 && nowMinutes >= targetMinutes && nowMinutes - targetMinutes <= 15) {
      const title = isEn ? `Evening Adhkar · ${appName}` : `تذكير أذكار المساء · ${appName}`;
      const body = isEn
        ? 'Time for your Evening Adhkar and protective supplications.'
        : 'حان الآن موعد أذكار المساء والأذكار والأدعية الجامعة؛ بارك الله مساءك بالطاعة والحفظ.';
      await dispatchLocalNotification({
        title,
        body,
        tag: `mawaedh-evening-${todayKey}`,
        onClickNavigate: () => onOpenAdhkar(),
      });
      onInAppNotify(body);
      updated = {...updated, lastEveningNotifiedDate: todayKey};
      changed = true;
    }
  }

  // Custom per-Dhikr locally scheduled browser alerts
  if (Array.isArray(updated.customAlerts) && updated.customAlerts.length > 0) {
    let customChanged = false;
    const nextCustomAlerts: CustomDhikrAlertRule[] = [];
    for (const rule of updated.customAlerts) {
      if (!rule.enabled || rule.lastNotifiedDate === todayKey) {
        nextCustomAlerts.push(rule);
        continue;
      }
      const targetMinutes = parseMinutes(rule.time);
      if (targetMinutes >= 0 && nowMinutes >= targetMinutes && nowMinutes - targetMinutes <= 15) {
        const title = isEn
          ? `Scheduled Dhikr · ${appName}`
          : `تذكير ذكر مجدول · ${rule.dhikrTitle}`;
        const body = formatCustomDhikrAlertBody(rule);
        await dispatchLocalNotification({
          title,
          body,
          tag: `mawaedh-custom-${rule.id}-${todayKey}`,
          dhikrId: rule.dhikrId,
          onClickNavigate: onOpenAdhkar,
        });
        onInAppNotify(
          isEn ? `Scheduled Dhikr: ${body}` : `🔔 ${rule.dhikrTitle}: ${body}`,
        );
        nextCustomAlerts.push({...rule, lastNotifiedDate: todayKey});
        customChanged = true;
      } else {
        nextCustomAlerts.push(rule);
      }
    }
    if (customChanged) {
      updated = {...updated, customAlerts: nextCustomAlerts};
      changed = true;
    }
  }

  if (changed) {
    onUpdateSettings(updated);
  }
}
