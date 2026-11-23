import { db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { localDay, monthRange, weekRange } from '../lib/time.js';
import { inRange, rankPeople } from '../lib/rank.js';

export default route('GET', async (req, res, me) => {
  const today = localDay();
  const week = weekRange(today);
  const month = monthRange(today);
  const lastMonth = monthRange(today, -1);
  const from = week.start < lastMonth.start ? week.start : lastMonth.start;

  const people = must(await db().from('people').select('id, name'));
  const checkins = must(await db().from('checkins')
    .select('person_id, day, created_at')
    .gte('day', from)
    .lte('day', today));

  const board = (range) => rankPeople(people, checkins.filter((c) => inRange(c.day, range)));
  const lastMonthTop = board(lastMonth)[0];

  send(res, 200, {
    today,
    me: {
      ...me,
      checkedInToday: checkins.some((c) => c.person_id === me.id && c.day === today),
    },
    week: { ...week, rows: board(week) },
    month: { ...month, rows: board(month) },
    lastMonthWinner: lastMonthTop && lastMonthTop.days > 0
      ? { name: lastMonthTop.name, days: lastMonthTop.days, month: lastMonth.start.slice(0, 7) }
      : null,
  });
});
