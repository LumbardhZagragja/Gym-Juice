import crypto from 'node:crypto';
import { BUCKET, db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { localDay } from '../lib/time.js';

const MAX_BYTES = 3 * 1024 * 1024;

// POST { photo: "data:image/jpeg;base64,..." }
export default route('POST', async (req, res, me) => {
  const photo = req.body?.photo;
  const match = typeof photo === 'string' && photo.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return send(res, 400, { error: 'A photo is required' });
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return send(res, 400, { error: 'Photo is too large' });

  const day = localDay();
  const existing = must(await db().from('checkins').select('id').eq('person_id', me.id).eq('day', day).maybeSingle());
  if (existing) return send(res, 409, { error: 'Already checked in today' });

  const path = `${me.id}/${day}-${crypto.randomUUID()}.jpg`;
  must(await db().storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' }));

  const { data, error } = await db().from('checkins')
    .insert({ person_id: me.id, day, photo_path: path })
    .select('id, day, created_at').single();
  if (error) {
    await db().storage.from(BUCKET).remove([path]);
    if (error.code === '23505') return send(res, 409, { error: 'Already checked in today' });
    throw error;
  }
  send(res, 201, { checkin: data });
});
