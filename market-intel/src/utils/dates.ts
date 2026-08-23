import { addDays, differenceInCalendarDays, format, parse } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Everything in the database is stored as an absolute instant (timestamptz)
 * plus the local wall time we actually typed into the competitor's form.
 * Both matter: the wall time is what was searched, the instant is what makes
 * observations comparable across markets and DST boundaries.
 */
export interface LocalisedInstant {
  /** absolute instant */
  utc: Date;
  /** 'YYYY-MM-DD HH:mm:ss' as seen at the location */
  local: string;
}

const LOCAL_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/** 'HH:mm' -> minutes since midnight. Throws on malformed input. */
export function parseTimeOfDay(value: string): { hours: number; minutes: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time of day "${value}", expected HH:mm`);
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/** Build an instant from a local date + local time at a given IANA timezone. */
export function atLocalTime(localDate: Date, timeOfDay: string, timezone: string): LocalisedInstant {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const local = `${format(localDate, 'yyyy-MM-dd')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  return { utc: fromZonedTime(local, timezone), local };
}

/** "now" as a local calendar date at the location. */
export function localToday(timezone: string, now: Date = new Date()): Date {
  return parse(format(toZonedTime(now, timezone), 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date());
}

export function addLocalDays(localDate: Date, days: number): Date {
  return addDays(localDate, days);
}

export function formatLocal(date: Date): string {
  return format(date, LOCAL_FORMAT);
}

export function formatLocalDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Lead time in whole days at the location: how far ahead of pickup we are
 * observing. This is the x-axis of the booking curve, so it is computed on
 * local calendar dates, never on raw millisecond differences.
 */
export function leadTimeDays(observedAt: Date, pickupAt: Date, timezone: string): number {
  return differenceInCalendarDays(toZonedTime(pickupAt, timezone), toZonedTime(observedAt, timezone));
}

/** Rental length in days, to 2dp (a 26h rental is 1.08 days, not 1). */
export function durationDays(pickupAt: Date, returnAt: Date): number {
  const ms = returnAt.getTime() - pickupAt.getTime();
  return Math.round((ms / 86_400_000) * 100) / 100;
}
