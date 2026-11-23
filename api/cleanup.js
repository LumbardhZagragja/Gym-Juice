import { BUCKET, db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { safeEqual } from '../lib/auth.js';

const KEEP_DAYS = 90;

// Runs daily from Vercel Cron (see vercel.json). Deletes photos older than
// 90 days; the check-ins themselves stay, so scores never change.
export default route('GET', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.authorization || '', `Bearer ${secret}`)) {
    return send(res, 401, { error: 'Unauthorized' });
  }
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const old = must(await db().from('checkins')
    .select('id, photo_path')
    .not('photo_path', 'is', null)
    .lt('created_at', cutoff)
    .limit(500));

  if (old.length) {
    must(await db().storage.from(BUCKET).remove(old.map((r) => r.photo_path)));
    must(await db().from('checkins').update({ photo_path: null }).in('id', old.map((r) => r.id)));
  }
  send(res, 200, { deleted: old.length });
}, { auth: false });
