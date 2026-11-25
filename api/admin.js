import { BUCKET, db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { safeEqual } from '../lib/auth.js';
import { localDay } from '../lib/time.js';

// POST with header "x-admin-key: <ADMIN_KEY>" and body { action, ... }
//   list                         -> everyone
//   add     { name }             -> add a friend
//   rename  { personId, name }
//   resetPin { personId }        -> they pick a new PIN next time (logs them out)
//   remove  { personId }         -> deletes them and their check-ins
//   addCheckin    { personId, day } -> count a day someone forgot to log (no photo)
//   removeCheckin { personId, day } -> delete that day's check-in
export default route('POST', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 8) return send(res, 500, { error: 'ADMIN_KEY is not set up' });
  if (!safeEqual(req.headers['x-admin-key'] || '', adminKey)) return send(res, 403, { error: 'Wrong admin key' });

  const { action, personId } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 30) : '';
  const day = req.body?.day;
  let message = '';

  if (action === 'addCheckin' || action === 'removeCheckin') {
    if (!personId) return send(res, 400, { error: 'Pick a person' });
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) {
      return send(res, 400, { error: 'Pick a date' });
    }
    if (day > localDay()) return send(res, 400, { error: "Can't add a day in the future" });
  }

  switch (action) {
    case 'list':
      break;
    case 'add':
      if (!name) return send(res, 400, { error: 'Name required' });
      {
        const { error } = await db().from('people').insert({ name });
        if (error?.code === '23505') return send(res, 409, { error: 'That name already exists' });
        if (error) throw error;
      }
      break;
    case 'rename':
      if (!name || !personId) return send(res, 400, { error: 'Name required' });
      must(await db().from('people').update({ name }).eq('id', personId));
      break;
    case 'resetPin':
      must(await db().from('people').update({ pin_hash: null }).eq('id', personId));
      break;
    case 'remove':
      must(await db().from('people').delete().eq('id', personId));
      break;
    case 'addCheckin': {
      // Noon in Central Europe on that day, so it sorts into the right place in the feed.
      const { error } = await db().from('checkins').insert({
        person_id: personId, day, photo_path: null, added_by_admin: true, created_at: `${day}T11:00:00Z`,
      });
      if (error?.code === '23505') return send(res, 409, { error: 'They already have a check-in on that day' });
      if (error?.code === '23503') return send(res, 404, { error: 'Unknown person' });
      if (error) throw error;
      message = `Added ${day}`;
      break;
    }
    case 'removeCheckin': {
      const gone = must(await db().from('checkins').delete().eq('person_id', personId).eq('day', day).select('photo_path'));
      if (gone.length === 0) return send(res, 404, { error: 'No check-in on that day' });
      const paths = gone.map((c) => c.photo_path).filter(Boolean);
      if (paths.length) await db().storage.from(BUCKET).remove(paths);
      message = `Removed ${day}`;
      break;
    }
    default:
      return send(res, 400, { error: 'Unknown action' });
  }

  const people = must(await db().from('people').select('id, name, pin_hash, created_at').order('name'));
  send(res, 200, { message, people: people.map((p) => ({ id: p.id, name: p.name, hasPin: !!p.pin_hash })) });
}, { auth: false });
