/**
 * Rank people by gym days in a period.
 * Ties go to whoever reached that number of days first.
 * People with 0 days are listed last, alphabetically.
 */
export function rankPeople(people, checkins) {
  const stats = new Map(people.map((p) => [p.id, { id: p.id, name: p.name, days: 0, reachedAt: 0 }]));
  for (const c of checkins) {
    const s = stats.get(c.person_id);
    if (!s) continue;
    s.days += 1;
    s.reachedAt = Math.max(s.reachedAt, Date.parse(c.created_at));
  }
  const rows = [...stats.values()].sort((a, b) => {
    if (b.days !== a.days) return b.days - a.days;
    if (a.days === 0) return a.name.localeCompare(b.name);
    return a.reachedAt - b.reachedAt;
  });
  return rows.map(({ reachedAt, ...r }, i) => ({ ...r, rank: i + 1 }));
}

export function inRange(day, { start, end }) {
  return day >= start && day <= end;
}
