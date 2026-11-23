import crypto from 'node:crypto';
import { db } from './db.js';

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is missing or too short');
  return s;
}

export const validPin = (pin) => typeof pin === 'string' && /^\d{4}$/.test(pin);

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPin(pin, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(pin, salt, 32);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// The token is tied to the current PIN, so resetting a PIN logs that person out everywhere.
function mac(personId, pinHash) {
  return crypto.createHmac('sha256', secret()).update(`${personId}|${pinHash}`).digest('base64url');
}

export function makeToken(person) {
  return `${person.id}.${mac(person.id, person.pin_hash)}`;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Returns { id, name } for a valid token, otherwise null. */
export async function currentPerson(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [id, sig] = token.split('.');
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('people').select('id, name, pin_hash').eq('id', id).maybeSingle();
  if (!data || !data.pin_hash) return null;
  if (!safeEqual(sig, mac(data.id, data.pin_hash))) return null;
  return { id: data.id, name: data.name };
}
