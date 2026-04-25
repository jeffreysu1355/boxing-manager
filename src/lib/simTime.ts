import type { CalendarEvent } from '../db/db';

export interface SimResult {
  newDate: string;
  stoppedAt: CalendarEvent | null;
}

/**
 * Returns the ISO date string that is `days` days after `isoDate`.
 * Uses local calendar arithmetic to avoid timezone issues.
 */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Finds the earliest CalendarEvent date strictly after `currentDate`
 * that belongs to at least one gym boxer.
 * Returns undefined if no such event exists.
 */
export function nextEventDate(
  currentDate: string,
  events: CalendarEvent[],
  gymBoxerIds: Set<number>
): string | undefined {
  let earliest: string | undefined;
  for (const event of events) {
    if (event.date <= currentDate) continue;
    if (!event.boxerIds.some(id => gymBoxerIds.has(id))) continue;
    if (earliest === undefined || event.date < earliest) {
      earliest = event.date;
    }
  }
  return earliest;
}

/**
 * Simulates time forward by `days` days from `currentDate`.
 *
 * If a CalendarEvent for a gym boxer falls within (currentDate, targetDate],
 * stops at that event's date instead of the full target.
 *
 * Returns { newDate, stoppedAt } where stoppedAt is the CalendarEvent that
 * caused the stop, or null if the full sim window was traversed.
 */
export function simForward(
  currentDate: string,
  days: number,
  events: CalendarEvent[],
  gymBoxerIds: Set<number>
): SimResult {
  const targetDate = addDays(currentDate, days);

  let stoppedAt: CalendarEvent | null = null;
  let stoppedDate: string | null = null;

  for (const event of events) {
    if (event.date <= currentDate) continue;
    if (event.date > targetDate) continue;
    if (!event.boxerIds.some(id => gymBoxerIds.has(id))) continue;

    if (stoppedDate === null || event.date < stoppedDate) {
      stoppedDate = event.date;
      stoppedAt = event;
    }
  }

  return {
    newDate: stoppedDate ?? targetDate,
    stoppedAt,
  };
}
