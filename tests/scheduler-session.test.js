import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_FACTS, factsForNumbers, getFact, newFactOrder } from '../js/facts.js';
import { createSession, nextCard, recordAnswer, isFinished, summarize, newRecord } from '../js/scheduler.js';

const rng0 = () => 0; // always picks the first option: makes runs repeatable
const freshProgress = () => ({ version: 1, facts: {}, speed: { 1: [], 2: [], 3: [] }, settings: {} });
const FAST = card => ({ input: String(card.fact.answer), ms: 1000 });
const SLOW = card => ({ input: String(card.fact.answer), ms: 20000 });
const WRONG = card => ({ input: String(card.fact.answer + 1), ms: 1000 });

// Plays n cards. answerFor(card, i) returns {input, ms}. Returns the fact ids shown.
function play(session, progress, n, answerFor, now = 0) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const card = nextCard(session, progress, { now, rng: rng0 });
    ids.push(card.fact.id);
    recordAnswer(session, progress, { ...answerFor(card, i), now });
  }
  return ids;
}

test('a missed fact comes back 3 and 8 cards later', () => {
  const progress = freshProgress();
  const session = createSession({ pool: factsForNumbers([7]), mode: 'cards', length: 20, now: 0 });
  const ids = play(session, progress, 9, (card, i) => (i === 0 ? WRONG(card) : FAST(card)));
  assert.deepEqual(ids, ['1x7', '2x7', '5x7', '1x7', '7x10', '3x7', '4x7', '7x9', '1x7']);
});

test('never the same fact twice in a row', () => {
  const progress = freshProgress();
  const session = createSession({ pool: factsForNumbers([7]), mode: 'cards', length: 40, now: 0 });
  const ids = play(session, progress, 40, (card, i) => (i % 2 ? WRONG(card) : FAST(card)));
  for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `repeat at card ${i + 1}`);
});

test('no more than 3 struggling facts at once', () => {
  const progress = freshProgress();
  const session = createSession({ pool: factsForNumbers([7]), mode: 'cards', length: 15, now: 0 });
  const ids = play(session, progress, 15, WRONG);
  assert.ok(new Set(ids).size <= 3, `saw ${new Set(ids).size} different facts`);
});

test('about 70% of cards are known facts', () => {
  const progress = freshProgress();
  const sevens = newFactOrder(factsForNumbers([7]));
  for (const f of sevens.slice(0, 8)) progress.facts[f.id] = { ...newRecord(), level: 2, due: 1e15 };
  const session = createSession({ pool: factsForNumbers([7]), mode: 'cards', length: 10, now: 0 });
  play(session, progress, 10, SLOW);
  assert.equal(session.knownShown, 7);
});

test('fluent student sees 20 different facts in adaptive mode', () => {
  const progress = freshProgress();
  const session = createSession({ pool: ALL_FACTS, mode: 'cards', length: 20, now: 0 });
  const ids = play(session, progress, 20, FAST);
  assert.equal(new Set(ids).size, 20);
  for (const id of ids) assert.equal(progress.facts[id].level, 2);
});

test('blank or non-numeric input is ignored, not marked wrong', () => {
  const progress = freshProgress();
  const session = createSession({ pool: factsForNumbers([3]), mode: 'cards', length: 20, now: 0 });
  const card = nextCard(session, progress, { now: 0, rng: rng0 });
  assert.equal(recordAnswer(session, progress, { input: '', ms: 500, now: 0 }), null);
  assert.equal(recordAnswer(session, progress, { input: 'abc', ms: 500, now: 0 }), null);
  assert.equal(session.results.length, 0);
  assert.equal(progress.facts[card.fact.id], undefined);
  const result = recordAnswer(session, progress, { input: String(card.fact.answer), ms: 500, now: 0 });
  assert.equal(result.correct, true);
  assert.equal(session.results.length, 1);
});

test('only correct anchor answers become speed samples', () => {
  const progress = freshProgress();
  const session = createSession({ pool: [getFact('1x7'), getFact('3x7')], mode: 'cards', length: 20, now: 0 });
  play(session, progress, 2, FAST); // 1x7 (anchor, 1 digit), then 3x7 (not an anchor)
  assert.deepEqual(progress.speed[1], [1000]);
  assert.deepEqual(progress.speed[2], []);
});

test('card rounds end after the set number of cards', () => {
  const progress = freshProgress();
  const session = createSession({ pool: factsForNumbers([2]), mode: 'cards', length: 3, now: 0 });
  play(session, progress, 2, WRONG);
  assert.equal(isFinished(session, 0), false);
  play(session, progress, 1, WRONG);
  assert.equal(isFinished(session, 0), true, 'pending re-asks do not extend the round');
});

test('timed rounds end when the time is up', () => {
  const session = createSession({ pool: factsForNumbers([2]), mode: 'timed', minutes: 2, now: 0 });
  assert.equal(isFinished(session, 119_999), false);
  assert.equal(isFinished(session, 120_000), true);
});

test('summary separates level-ups, gentle refreshes, and facts to work on', () => {
  const progress = freshProgress();
  progress.facts['7x8'] = { ...newRecord(), level: 3, wasStrong: true, due: 1e15 };
  const session = createSession({ pool: [getFact('7x8'), getFact('6x7')], mode: 'cards', length: 2, now: 0 });
  const ids = play(session, progress, 2, (card, i) => (i === 0 ? WRONG(card) : FAST(card)));
  assert.deepEqual(ids, ['7x8', '6x7']);
  const s = summarize(session, progress);
  assert.equal(s.total, 2);
  assert.equal(s.correct, 1);
  assert.deepEqual(s.leveledUp.map(f => f.id), ['6x7']);
  assert.deepEqual(s.refresh.map(f => f.id), ['7x8']);
  assert.deepEqual(s.toWorkOn, [], 'a refreshed fact is not listed twice');
});

test('summary lists missed facts to work on', () => {
  const progress = freshProgress();
  const session = createSession({ pool: [getFact('3x7'), getFact('4x7')], mode: 'cards', length: 2, now: 0 });
  play(session, progress, 2, WRONG);
  const s = summarize(session, progress);
  assert.deepEqual(s.toWorkOn.map(f => f.id), ['3x7', '4x7']);
  assert.deepEqual(s.refresh, []);
  assert.deepEqual(s.leveledUp, []);
});
