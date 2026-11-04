// scheduler.js: the rules for mastery levels, answer speed, and (in the
// session section added below) which card to show next.
// Pure logic: no page code here, so it can be tested with `node --test`.
// The reasoning behind these rules is in the design spec.

import { getFact, isAnchor, newFactOrder, orient } from './facts.js';

export const LEVEL_NAMES = ['New', 'Learning', 'Familiar', 'Strong', 'Mastered'];
export const MAX_LEVEL = 4;
export const DAY_MS = 24 * 60 * 60 * 1000;

// Days until a fact is due for review after reaching each level.
const INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7 };
const MAX_INTERVAL_DAYS = 60;

// ---------- Fact records ----------

export function newRecord() {
  return { level: 0, credit: 0, due: 0, interval: 0, seen: 0, correct: 0, wrong: 0, wasStrong: false };
}

// The saved record for a fact, or a fresh one if it has never been practiced.
export function getRecord(progress, id) {
  return progress.facts[id] ?? newRecord();
}

// true/false for a typed answer, or null if it isn't a whole number
// (blank, letters, decimals). null means "ignore it, let them keep typing".
export function checkAnswer(fact, input) {
  const text = String(input).trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text) === fact.answer;
}

// Applies one answer to a fact's record and returns a new record plus
// what happened (for the session summary). Rules:
// - Wrong: back to level 1 (Learning), due now.
// - Correct: earns credit only on the fact's first showing this session.
//   Fast = 1 credit, slow = half. 1 credit = up one level.
// - Placement: a New fact answered fast on first sight jumps to level 2.
export function gradeAnswer(before, { correct, fast, firstShowing, now }) {
  const record = { ...before, seen: before.seen + 1 };
  const events = { leveledUp: false, dropped: false, droppedFromStrong: false };

  if (!correct) {
    record.wrong += 1;
    if (record.level > 1) {
      events.dropped = true;
      events.droppedFromStrong = record.wasStrong;
    }
    record.level = 1;
    record.credit = 0;
    record.interval = 0;
    record.due = now;
    return { record, events };
  }

  record.correct += 1;
  if (!firstShowing) return { record, events };

  if (record.level === 0 && fast) {
    record.level = 2;
    record.credit = 0;
    record.interval = INTERVAL_DAYS[2];
    record.due = now + record.interval * DAY_MS;
    events.leveledUp = true;
  } else {
    record.credit += fast ? 1 : 0.5;
    if (record.credit >= 1) {
      record.credit = 0;
      if (record.level === MAX_LEVEL) {
        // Double the gap, but never below the level-4 starting gap (7 days).
        record.interval = Math.min(MAX_INTERVAL_DAYS, Math.max(INTERVAL_DAYS[MAX_LEVEL], record.interval * 2));
      } else {
        record.level += 1;
        record.interval = INTERVAL_DAYS[record.level];
        events.leveledUp = true;
      }
      record.due = now + record.interval * DAY_MS;
    }
  }

  if (record.level >= 3) record.wasStrong = true;
  return { record, events };
}

// ---------- Speed ----------
// "Fast" is measured against this person's own typing speed: we keep their
// recent times on anchor facts (×1, ×10), which need almost no thinking.

const SPEED_DEFAULTS_MS = { 1: 4000, 2: 5000, 3: 6000 };
const SPEED_MIN_SAMPLES = 5;
export const SPEED_KEEP = 10;
const SPEED_MARGIN_MS = 2000;
const FAST_MIN_MS = 2500;
const FAST_MAX_MS = 10000;

export function answerDigits(answer) {
  return Math.min(3, String(answer).length);
}

function median(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Answers at or under this many milliseconds count as fast.
export function fastThreshold(speed, digits) {
  const samples = speed[digits] ?? [];
  if (samples.length < SPEED_MIN_SAMPLES) return SPEED_DEFAULTS_MS[digits];
  const threshold = median(samples) + SPEED_MARGIN_MS;
  return Math.min(FAST_MAX_MS, Math.max(FAST_MIN_MS, threshold));
}

export function addSpeedSample(speed, digits, ms) {
  const list = speed[digits] ?? (speed[digits] = []);
  list.push(Math.round(ms));
  if (list.length > SPEED_KEEP) list.splice(0, list.length - SPEED_KEEP);
}

// ---------- Sessions ----------
// A session is one practice round. It remembers which facts were shown,
// which missed facts to ask again, and how many "known" cards came up.

const KNOWN_SHARE = 0.7;            // aim for ~70% known facts per round
const STRUGGLING_CAP = 3;           // don't add new facts while 3 are being missed
const REASK_AFTER_MISS = [3, 8];    // a missed fact comes back 3 and 8 cards later
const REASK_AFTER_REPEAT_MISS = [3];

export function createSession({ pool, mode = 'cards', length = 20, minutes = 0, now }) {
  return {
    pool,
    mode,
    length,
    endsAt: mode === 'timed' ? now + minutes * 60_000 : null,
    position: 0,              // how many cards have been shown
    shown: new Set(),         // ids shown this round
    lastId: null,
    reasks: [],               // [{fact, at}]: show `fact` as card number `at`
    struggling: new Set(),    // ids missed and not yet answered correctly
    knownShown: 0,
    current: null,            // the card on screen
    results: [],
  };
}

function randomPick(list, rng) {
  return list.length ? list[Math.floor(rng() * list.length)] : null;
}

// A re-ask that is due now, unless it's the fact that was just shown.
function takeReask(session, cardNumber) {
  const due = session.reasks
    .filter(r => r.at <= cardNumber && (r.fact.id !== session.lastId || session.pool.length === 1))
    .sort((x, y) => x.at - y.at)[0];
  if (!due) return null;
  session.reasks.splice(session.reasks.indexOf(due), 1);
  return due.fact;
}

// Known facts not yet shown this round: the most overdue first, else random.
function pickKnown(known, progress, session, now, rng) {
  const unseen = known.filter(f => !session.shown.has(f.id));
  const overdue = unseen
    .filter(f => getRecord(progress, f.id).due <= now)
    .sort((x, y) => getRecord(progress, x.id).due - getRecord(progress, y.id).due);
  return overdue[0] ?? randomPick(unseen, rng);
}

// Facts still being learned: unseen Learning facts first, then a new fact
// (if not too many are being missed), then rehearse ones already shown.
function pickWorking(working, progress, session, rng) {
  const level = f => getRecord(progress, f.id).level;
  const unseenLearning = working.filter(f => level(f) === 1 && !session.shown.has(f.id));
  if (unseenLearning.length) return randomPick(unseenLearning, rng);

  if (session.struggling.size < STRUGGLING_CAP) {
    const fresh = newFactOrder(working.filter(f => level(f) === 0 && !session.shown.has(f.id)));
    if (fresh.length) return fresh[0];
  }

  return randomPick(working.filter(f => session.shown.has(f.id)), rng);
}

// Chooses the next card and makes it the current one.
export function nextCard(session, progress, { now, rng = Math.random }) {
  const cardNumber = session.position + 1;
  const level = f => getRecord(progress, f.id).level;

  let fact = takeReask(session, cardNumber);
  const isReask = fact !== null;

  if (!fact) {
    const candidates = session.pool.length > 1
      ? session.pool.filter(f => f.id !== session.lastId)
      : session.pool;
    const known = candidates.filter(f => level(f) >= 2);
    const working = candidates.filter(f => level(f) <= 1);
    const wantKnown = session.knownShown < KNOWN_SHARE * cardNumber;

    fact = wantKnown
      ? pickKnown(known, progress, session, now, rng) ?? pickWorking(working, progress, session, rng)
      : pickWorking(working, progress, session, rng) ?? pickKnown(known, progress, session, now, rng);
    fact ??= randomPick(candidates, rng);
  }

  if (level(fact) >= 2) session.knownShown += 1;
  const first = !session.shown.has(fact.id);
  session.position = cardNumber;
  session.shown.add(fact.id);
  session.lastId = fact.id;
  session.current = { fact, first, isReask, order: orient(fact, rng) };
  return session.current;
}

// Grades the typed answer for the current card and saves the result into
// `progress`. Returns null (and keeps the card) if the input isn't a number.
export function recordAnswer(session, progress, { input, ms, now }) {
  const { fact, first, isReask, order } = session.current;
  const correct = checkAnswer(fact, input);
  if (correct === null) return null;

  const digits = answerDigits(fact.answer);
  const fast = correct && ms <= fastThreshold(progress.speed, digits);
  if (correct && isAnchor(fact)) addSpeedSample(progress.speed, digits, ms);

  const { record, events } = gradeAnswer(getRecord(progress, fact.id), {
    correct, fast, firstShowing: first, now,
  });
  progress.facts[fact.id] = record;

  if (correct) {
    session.struggling.delete(fact.id);
  } else {
    session.struggling.add(fact.id);
    const offsets = isReask ? REASK_AFTER_REPEAT_MISS : REASK_AFTER_MISS;
    for (const k of offsets) session.reasks.push({ fact, at: session.position + k });
  }

  const result = { fact, order, correct, fast, first, answer: fact.answer, events };
  session.results.push(result);
  session.current = null;
  return result;
}

export function isFinished(session, now) {
  if (session.mode === 'timed') return now >= session.endsAt;
  return session.position >= session.length;
}

// What to show on the end-of-round screen.
export function summarize(session, progress) {
  const { results } = session;
  const misses = new Map();
  for (const r of results) {
    if (!r.correct) misses.set(r.fact.id, (misses.get(r.fact.id) ?? 0) + 1);
  }
  const unique = ids => [...new Set(ids)];

  const refresh = unique(results.filter(r => r.events.droppedFromStrong).map(r => r.fact.id));
  const leveledUp = unique(results.filter(r => r.events.leveledUp).map(r => r.fact.id))
    .filter(id => !misses.has(id));
  const toWorkOn = [...misses.keys()]
    .filter(id => !refresh.includes(id))
    .sort((x, y) => misses.get(y) - misses.get(x)
      || getRecord(progress, x).level - getRecord(progress, y).level)
    .slice(0, 3);

  return {
    total: results.length,
    correct: results.filter(r => r.correct).length,
    leveledUp: leveledUp.map(getFact),
    refresh: refresh.map(getFact),
    toWorkOn: toWorkOn.map(getFact),
  };
}
