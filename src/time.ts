/** "4 min ago", "2 h ago", "yesterday", "3 days ago", or a date beyond a week. */
export function ago(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  return days < 7 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "12 min", "2 h 5 min", "3 days". */
export function duration(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return mins % 60 ? `${h} h ${mins % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day' : `${d} days`;
}

/** A length of time in the short form charts use: "12 h 40 m", "35 m". */
export function hoursMinutes(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h${mins % 60 ? ` ${mins % 60} m` : ''}` : `${mins} m`;
}

/** Midnight, the middle of today so far (to the hour) — the left and middle labels of a "today" chart. */
export function todayLabels(now = new Date()): [string, string] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const middle = new Date((midnight.getTime() + now.getTime()) / 2);
  middle.setMinutes(0, 0, 0);
  return ['00:00', clock(middle.toISOString(), now)];
}

/** "18:05" today, otherwise "Tue 18:05", or a date beyond a week. */
export function clock(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (now.getTime() - d.getTime() < 7 * 86_400_000) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
