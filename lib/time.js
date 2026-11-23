// All "what day is it" logic lives here, in the group's timezone.
export const TZ = process.env.APP_TIMEZONE || 'Europe/Berlin';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Local calendar day as YYYY-MM-DD. */
export function localDay(date = new Date()) {
  return dayFormat.format(date);
}

const parse = (s) => new Date(s + 'T00:00:00Z');
const fmt = (d) => d.toISOString().slice(0, 10);

export function addDays(day, n) {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Monday..Sunday week containing `day`. */
export function weekRange(day) {
  const mondayOffset = (parse(day).getUTCDay() + 6) % 7;
  const start = addDays(day, -mondayOffset);
  return { start, end: addDays(start, 6) };
}

/** Calendar month containing `day`, shifted by `offset` months. */
export function monthRange(day, offset = 0) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { start: fmt(first), end: fmt(last) };
}
