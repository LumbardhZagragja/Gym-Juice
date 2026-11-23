import { db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';

// Public: names for the "who are you?" screen.
export default route('GET', async (req, res) => {
  const people = must(await db().from('people').select('id, name, pin_hash').order('name'));
  send(res, 200, {
    people: people.map((p) => ({ id: p.id, name: p.name, hasPin: !!p.pin_hash })),
  });
}, { auth: false });
