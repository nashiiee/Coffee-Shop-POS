// The shop operates in a single fixed timezone — Asia/Manila (UTC+8), the
// same locale implied by the PHP currency used throughout this app. Manila
// observes no DST, so a fixed offset is exact (not an approximation) and
// avoids pulling in a timezone library for a single-location POS. If this
// app ever needs to support shops in other timezones, this constant (and
// the SQL equivalent in reports.service.ts) is the one place to change.
export const SHOP_UTC_OFFSET_MINUTES = 8 * 60

function toShopLocal(at: Date): Date {
  return new Date(at.getTime() + SHOP_UTC_OFFSET_MINUTES * 60_000)
}

function shopLocalMidnightUtcMs(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day, 0, 0, 0, 0) - SHOP_UTC_OFFSET_MINUTES * 60_000
}

export interface DateRange {
  start: Date
  end: Date
}

// [start, end) — end is exclusive, so callers filter with `createdAt >=
// start AND createdAt < end`, never `<=` (which would double-count an
// order landing exactly on the boundary).
export function shopDayRange(at: Date): DateRange {
  const local = toShopLocal(at)
  const startMs = shopLocalMidnightUtcMs(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return { start: new Date(startMs), end: new Date(startMs + 24 * 60 * 60 * 1000) }
}

// Monday-start week, shop-local — matches Postgres's date_trunc('week', ...)
// convention used for the SQL-side bucketing in reports.service.ts.
export function shopWeekRange(at: Date): DateRange {
  const { start: todayStart } = shopDayRange(at)
  const localDow = toShopLocal(todayStart).getUTCDay() // 0=Sun..6=Sat
  const daysSinceMonday = (localDow + 6) % 7
  const start = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000)
  return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) }
}

export function shopMonthRange(at: Date): DateRange {
  const local = toShopLocal(at)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth()
  const start = shopLocalMidnightUtcMs(year, month, 1)
  const end = shopLocalMidnightUtcMs(year, month + 1, 1)
  return { start: new Date(start), end: new Date(end) }
}
