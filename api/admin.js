import { db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { safeEqual } from '../lib/auth.js';

// POST with header "x-admin-key: <ADMIN_KEY>" and body { action, ... }
//   list                         -> everyone
//   add     { name }             -> add a friend
//   rename  { personId, name }
//   resetPin { personId }        -> they pick a new PIN next time (logs them out)
//   remove  { personId }         -> deletes them and their check-ins
export default route('POST', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 8) return send(res, 500, { error: 'ADMIN_KEY is not set up' });
  if (!safeEqual(req.headers['x-admin-key'] || '', adminKey)) return send(res, 403, { error: 'Wrong admin key' });

  const { action, personId } = req.body || {};
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 30) : '';

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
    default:
      return send(res, 400, { error: 'Unknown action' });
  }

  const people = must(await db().from('people').select('id, name, pin_hash, created_at').order('name'));
  send(res, 200, { people: people.map((p) => ({ id: p.id, name: p.name, hasPin: !!p.pin_hash })) });
}, { auth: false });
