import { BUCKET, db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';

const LIMIT = 40;

export default route('GET', async (req, res, me) => {
  const rows = must(await db().from('checkins')
    .select('id, day, created_at, photo_path, person_id, people(name)')
    .order('created_at', { ascending: false })
    .limit(LIMIT));

  const ids = rows.map((r) => r.id);
  const reactions = ids.length
    ? must(await db().from('reactions').select('checkin_id, person_id, kind').in('checkin_id', ids))
    : [];

  const paths = rows.map((r) => r.photo_path).filter(Boolean);
  const urls = new Map();
  if (paths.length) {
    const signed = must(await db().storage.from(BUCKET).createSignedUrls(paths, 60 * 60));
    for (const s of signed) if (s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const posts = rows.map((r) => {
    const mine = reactions.filter((x) => x.checkin_id === r.id);
    return {
      id: r.id,
      name: r.people?.name ?? 'Someone',
      personId: r.person_id,
      day: r.day,
      createdAt: r.created_at,
      photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null,
      sus: mine.filter((x) => x.kind === 'sus').length,
      love: mine.filter((x) => x.kind === 'love').length,
      mySus: mine.some((x) => x.kind === 'sus' && x.person_id === me.id),
      myLove: mine.some((x) => x.kind === 'love' && x.person_id === me.id),
    };
  });
  send(res, 200, { posts });
});
