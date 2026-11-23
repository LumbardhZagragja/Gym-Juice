import { db, must } from '../lib/db.js';
import { route, send } from '../lib/http.js';
import { checkPin, hashPin, makeToken, validPin } from '../lib/auth.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// POST { personId, pin }
// First login for a person sets their PIN; after that the PIN must match.
export default route('POST', async (req, res) => {
  const { personId, pin } = req.body || {};
  if (typeof personId !== 'string' || !validPin(pin)) {
    return send(res, 400, { error: 'Pick your name and enter a 4-digit PIN' });
  }
  const person = must(await db().from('people').select('id, name, pin_hash').eq('id', personId).maybeSingle());
  if (!person) return send(res, 404, { error: 'Unknown person' });

  if (!person.pin_hash) {
    const pin_hash = hashPin(pin);
    // Only set it if nobody else set it in the meantime.
    const updated = must(await db().from('people').update({ pin_hash }).eq('id', person.id).is('pin_hash', null).select('id'));
    if (updated.length === 0) return send(res, 409, { error: 'A PIN was just set for this name. Try logging in.' });
    return send(res, 200, { token: makeToken({ ...person, pin_hash }), me: { id: person.id, name: person.name }, created: true });
  }

  if (!checkPin(pin, person.pin_hash)) {
    await pause(800); // slows down guessing
    return send(res, 401, { error: 'Wrong PIN' });
  }
  send(res, 200, { token: makeToken(person), me: { id: person.id, name: person.name }, created: false });
}, { auth: false });
