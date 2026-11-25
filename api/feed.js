import { BUCKET, db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';

const LIMIT = 40;

export default route('GET', async (req, res, me) => {
  const recent = (cols) => db().from('checkins').select(cols)
    .order('created_at', { ascending: false }).limit(LIMIT);
  let result = await recent('id, day, created_at, photo_path, person_id, added_by_admin');
  // Works even before the added_by_admin column has been added in Supabase.
  if (result.error?.code === '42703') result = await recent('id, day, created_at, photo_path, person_id');
  const rows = must(result);

  const people = must(await db().from('people').select('id, name'));
  const names = new Map(people.map((p) => [p.id, p.name]));

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
      name: names.get(r.person_id) ?? 'Someone',
      personId: r.person_id,
      day: r.day,
      createdAt: r.created_at,
      addedByAdmin: !!r.added_by_admin,
      photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null,
      sus: mine.filter((x) => x.kind === 'sus').length,
      love: mine.filter((x) => x.kind === 'love').length,
      mySus: mine.some((x) => x.kind === 'sus' && x.person_id === me.id),
      myLove: mine.some((x) => x.kind === 'love' && x.person_id === me.id),
    };
  });
  send(res, 200, { posts });
});
