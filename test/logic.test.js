import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, localDay, monthRange, weekRange } from '../lib/time.js';
import { inRange, rankPeople } from '../lib/rank.js';
import { checkPin, hashPin, validPin } from '../lib/auth.js';

test('local day follows Europe/Berlin, including summer time', () => {
  // 23:30 UTC on 1 Jan is already 2 Jan in Berlin (UTC+1)
  assert.equal(localDay(new Date('2026-01-01T23:30:00Z')), '2026-01-02');
  // 22:30 UTC on 1 Jul is already 2 Jul in Berlin (UTC+2)
  assert.equal(localDay(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
  // 21:30 UTC on 1 Jul is still 1 Jul
  assert.equal(localDay(new Date('2026-07-01T21:30:00Z')), '2026-07-01');
});

test('weeks run Monday to Sunday', () => {
  assert.deepEqual(weekRange('2026-11-23'), { start: '2026-11-23', end: '2026-11-29' }); // Monday
  assert.deepEqual(weekRange('2026-11-29'), { start: '2026-11-23', end: '2026-11-29' }); // Sunday
  assert.deepEqual(weekRange('2026-12-02'), { start: '2026-11-30', end: '2026-12-06' }); // across months
});

test('months and last month', () => {
  assert.deepEqual(monthRange('2026-11-23'), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(monthRange('2026-01-10', -1), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(monthRange('2028-03-05', -1), { start: '2028-02-01', end: '2028-02-29' });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('ranking: most days wins, ties go to who got there first, zeros last', () => {
  const people = [
    { id: 'a', name: 'Lumi' }, { id: 'b', name: 'Rroni' }, { id: 'c', name: 'Doka' }, { id: 'd', name: 'Vali' },
  ];
  const checkins = [
    { person_id: 'a', day: '2026-11-23', created_at: '2026-11-23T08:00:00Z' },
    { person_id: 'a', day: '2026-11-24', created_at: '2026-11-24T18:00:00Z' },
    { person_id: 'b', day: '2026-11-23', created_at: '2026-11-23T07:00:00Z' },
    { person_id: 'b', day: '2026-11-24', created_at: '2026-11-24T07:00:00Z' },
    { person_id: 'c', day: '2026-11-24', created_at: '2026-11-24T06:00:00Z' },
  ];
  const rows = rankPeople(people, checkins);
  assert.deepEqual(rows.map((r) => [r.name, r.days, r.rank]), [
    ['Rroni', 2, 1], ['Lumi', 2, 2], ['Doka', 1, 3], ['Vali', 0, 4],
  ]);
  assert.equal(inRange('2026-11-24', { start: '2026-11-23', end: '2026-11-29' }), true);
  assert.equal(inRange('2026-11-30', { start: '2026-11-23', end: '2026-11-29' }), false);
});

test('PIN hashing', () => {
  assert.equal(validPin('0420'), true);
  assert.equal(validPin('42'), false);
  assert.equal(validPin('abcd'), false);
  const h = hashPin('1234');
  assert.equal(checkPin('1234', h), true);
  assert.equal(checkPin('1235', h), false);
  assert.equal(checkPin('1234', null), false);
});
