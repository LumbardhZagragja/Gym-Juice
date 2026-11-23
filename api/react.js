import { db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';

// POST { checkinId, kind: 'sus' | 'love' } -> toggles your reaction.
export default route('POST', async (req, res, me) => {
  const { checkinId, kind } = req.body || {};
  if (typeof checkinId !== 'string' || !/^[0-9a-f-]{36}$/i.test(checkinId) || !['sus', 'love'].includes(kind)) {
    return send(res, 400, { error: 'Bad reaction' });
  }
  const key = { checkin_id: checkinId, person_id: me.id, kind };
  const existing = must(await db().from('reactions').select('kind').match(key).maybeSingle());
  if (existing) {
    must(await db().from('reactions').delete().match(key));
  } else {
    const { error } = await db().from('reactions').insert(key);
    if (error && error.code !== '23505') {
      if (error.code === '23503') return send(res, 404, { error: 'That check-in is gone' });
      throw error;
    }
  }
  const all = must(await db().from('reactions').select('person_id').eq('checkin_id', checkinId).eq('kind', kind));
  send(res, 200, { kind, count: all.length, mine: !existing });
});
