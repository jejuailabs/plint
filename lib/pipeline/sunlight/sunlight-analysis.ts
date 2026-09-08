/**
 * Sunlight analysis using SunCalc.
 *
 * Computes solar position at key times throughout the year
 * to estimate shadow direction and sunlight hours.
 * This is a preliminary estimate — not for permit-level review.
 */

import * as SunCalc from 'suncalc';

export type SolarPosition = {
  date: string;
  time: string;
  altitude: number;
  azimuth: number;
};

export type ShadowVector = {
  date: string;
  time: string;
  directionDeg: number;
  lengthFactor: number;
};

export type SunlightAnalysisResult = {
  winterSolstice: {
    sunrise: string;
    sunset: string;
    daylightHours: number;
    positions: SolarPosition[];
    shadows: ShadowVector[];
  };
  summerSolstice: {
    sunrise: string;
    sunset: string;
    daylightHours: number;
    positions: SolarPosition[];
    shadows: ShadowVector[];
  };
  equinox: {
    sunrise: string;
    sunset: string;
    daylightHours: number;
    positions: SolarPosition[];
    shadows: ShadowVector[];
  };
  annualSunlightHoursEstimate: number;
  disclaimer: string;
};

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function diffHours(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 10) / 10;
}

function analyzeDay(
  date: Date,
  lat: number,
  lon: number,
): {
  sunrise: string;
  sunset: string;
  daylightHours: number;
  positions: SolarPosition[];
  shadows: ShadowVector[];
} {
  const times = SunCalc.getTimes(date, lat, lon);
  const sunrise =
    times.sunrise ??
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6, 0);
  const sunset =
    times.sunset ??
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0);
  const daylightHours = diffHours(sunrise, sunset);
  const dateStr = date.toISOString().slice(0, 10);

  const positions: SolarPosition[] = [];
  const shadows: ShadowVector[] = [];

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  for (const hour of hours) {
    const checkTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      0,
      0,
    );
    const pos = SunCalc.getPosition(checkTime, lat, lon);
    const altDeg = toDeg(pos.altitude);
    const azDeg = toDeg(pos.azimuth) + 180;

    if (altDeg <= 0) continue;

    positions.push({
      date: dateStr,
      time: `${String(hour).padStart(2, '0')}:00`,
      altitude: Math.round(altDeg * 10) / 10,
      azimuth: Math.round(azDeg * 10) / 10,
    });

    const shadowLength = 1 / Math.tan(pos.altitude);
    const shadowDir = (azDeg + 180) % 360;

    shadows.push({
      date: dateStr,
      time: `${String(hour).padStart(2, '0')}:00`,
      directionDeg: Math.round(shadowDir * 10) / 10,
      lengthFactor: Math.round(shadowLength * 100) / 100,
    });
  }

  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    daylightHours,
    positions,
    shadows,
  };
}

export function analyzeSunlight(
  latitude: number,
  longitude: number,
  year?: number,
): SunlightAnalysisResult {
  const y = year ?? new Date().getFullYear();

  const winterSolstice = analyzeDay(new Date(y, 11, 22), latitude, longitude);
  const summerSolstice = analyzeDay(new Date(y, 5, 21), latitude, longitude);
  const equinox = analyzeDay(new Date(y, 2, 20), latitude, longitude);

  const avgDaylight =
    (winterSolstice.daylightHours +
      summerSolstice.daylightHours +
      equinox.daylightHours * 2) /
    4;
  const annualSunlightHoursEstimate = Math.round(avgDaylight * 365 * 0.45);

  return {
    winterSolstice,
    summerSolstice,
    equinox,
    annualSunlightHoursEstimate,
    disclaimer:
      '본 일조 분석은 SunCalc 기반 개략 추정이며, 주변 건물·지형 차폐를 반영하지 않습니다. 인허가용 정밀 일조권 분석을 대체하지 않습니다.',
  };
}
