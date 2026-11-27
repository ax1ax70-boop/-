export interface SolarCoordinates {
  lat: number;
  lon: number;
  updatedAt: string;
}

export interface SolarWindowInfo {
  isNight: boolean;
  sunriseDate: Date;
  sunsetDate: Date;
  sunriseLabel: string;
  sunsetLabel: string;
  nextTransitionMs: number;
  usingLocation: boolean;
  coords: SolarCoordinates | null;
}

const SOLAR_COORDS_KEY = 'mawaedh_solar_coords_v1';
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function loadSavedSolarCoords(): SolarCoordinates | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SOLAR_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SolarCoordinates>;
    if (
      typeof parsed.lat === 'number' &&
      Number.isFinite(parsed.lat) &&
      typeof parsed.lon === 'number' &&
      Number.isFinite(parsed.lon) &&
      parsed.lat >= -90 &&
      parsed.lat <= 90 &&
      parsed.lon >= -180 &&
      parsed.lon <= 180
    ) {
      return {
        lat: parsed.lat,
        lon: parsed.lon,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSolarCoords(coords: SolarCoordinates): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOLAR_COORDS_KEY, JSON.stringify(coords));
  } catch {
    // Ignore storage quota restrictions
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function requestDeviceSolarCoords(): Promise<SolarCoordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('المتصفح الحالي لا يدعم خدمة تحديد الموقع الجغرافي'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: SolarCoordinates = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4)),
          updatedAt: new Date().toISOString(),
        };
        saveSolarCoords(coords);
        resolve(coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('لم يتم السماح بالوصول إلى الموقع الجغرافي من إعدادات المتصفح'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('انتهت مهلة تحديد الموقع الجغرافي، حاول مرة أخرى'));
        } else {
          reject(new Error('تعذر تحديد الموقع الجغرافي حالياً'));
        }
      },
      {enableHighAccuracy: false, timeout: 10000, maximumAge: 6 * 60 * 60 * 1000},
    );
  });
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff =
    date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60_000;
  return Math.floor(diff / 86_400_000);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * NOAA General Solar Position Equations for local sunrise & sunset (zenith = 90.833°).
 */
function calculateSolarEventDate(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
  isSunrise: boolean,
): Date | null {
  const refDate = new Date(year, month, day, 12, 0, 0, 0);
  const dayOfYear = getDayOfYear(refDate);
  const daysInYear = isLeapYear(year) ? 366 : 365;
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + ((isSunrise ? 6 : 18) - 12) / 24);

  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = lat * DEG_TO_RAD;
  const zenithRad = 90.833 * DEG_TO_RAD;
  const cosHa =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) - Math.tan(latRad) * Math.tan(decl);

  if (cosHa > 1 || cosHa < -1 || Number.isNaN(cosHa)) {
    return null;
  }

  const haDeg = Math.acos(cosHa) * RAD_TO_DEG * (isSunrise ? 1 : -1);
  const utcMinutes = 720 - 4 * (lon + haDeg) - eqtime;

  const midnightUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0);
  return new Date(midnightUtcMs + Math.round(utcMinutes * 60_000));
}

function formatTimeArabic(date: Date, isEn = false): string {
  try {
    return new Intl.DateTimeFormat(isEn ? 'en-US' : 'ar-SA', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export function computeSolarWindow(
  coords: SolarCoordinates | null,
  now = new Date(),
  isEn = false,
): SolarWindowInfo {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const fallbackSunrise = new Date(year, month, day, 6, 0, 0, 0);
  const fallbackSunset = new Date(year, month, day, 18, 0, 0, 0);

  let sunriseDate = fallbackSunrise;
  let sunsetDate = fallbackSunset;
  let usingLocation = false;

  if (coords) {
    const calcRise = calculateSolarEventDate(year, month, day, coords.lat, coords.lon, true);
    const calcSet = calculateSolarEventDate(year, month, day, coords.lat, coords.lon, false);
    if (calcRise && calcSet && calcSet.getTime() > calcRise.getTime()) {
      sunriseDate = calcRise;
      sunsetDate = calcSet;
      usingLocation = true;
    }
  }

  const nowMs = now.getTime();
  const isNight = nowMs < sunriseDate.getTime() || nowMs >= sunsetDate.getTime();

  let nextTransitionMs: number;
  if (nowMs < sunriseDate.getTime()) {
    nextTransitionMs = sunriseDate.getTime() - nowMs;
  } else if (nowMs < sunsetDate.getTime()) {
    nextTransitionMs = sunsetDate.getTime() - nowMs;
  } else {
    const tomorrow = new Date(year, month, day + 1, 12, 0, 0, 0);
    const tomorrowRise =
      (coords &&
        calculateSolarEventDate(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          coords.lat,
          coords.lon,
          true,
        )) ||
      new Date(year, month, day + 1, 6, 0, 0, 0);
    nextTransitionMs = Math.max(60_000, tomorrowRise.getTime() - nowMs);
  }

  return {
    isNight,
    sunriseDate,
    sunsetDate,
    sunriseLabel: formatTimeArabic(sunriseDate, isEn),
    sunsetLabel: formatTimeArabic(sunsetDate, isEn),
    nextTransitionMs: Math.max(15_000, nextTransitionMs),
    usingLocation,
    coords,
  };
}
