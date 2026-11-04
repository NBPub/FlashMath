// facts.js: the list of multiplication facts and the groups they belong to.
// Pure logic: no page code here, so it can be tested with `node --test`.

export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// The order numbers are usually taught: easy "anchor" facts first.
export const TEACHING_ORDER = [1, 2, 5, 10, 3, 4, 9, 11, 6, 7, 8, 12];

export const GROUPS = [
  { id: 'starter', name: 'Starter', numbers: [1, 2, 5, 10] },
  { id: 'middle', name: 'Middle', numbers: [3, 4, 9, 11] },
  { id: 'challenge', name: 'Challenge', numbers: [6, 7, 8, 12] },
];

// 3×7 and 7×3 are the same fact, so the id always puts the smaller number first: "3x7".
// `op` is there so addition/subtraction facts can be added later.
export function factId(a, b, op = 'x') {
  return `${Math.min(a, b)}${op}${Math.max(a, b)}`;
}

function makeFact(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { id: factId(lo, hi), a: lo, b: hi, op: 'x', answer: lo * hi };
}

// All 78 facts, from 1x1 to 12x12.
export const ALL_FACTS = [];
for (const a of NUMBERS) {
  for (const b of NUMBERS) {
    if (a <= b) ALL_FACTS.push(makeFact(a, b));
  }
}

const FACTS_BY_ID = new Map(ALL_FACTS.map(f => [f.id, f]));

export function getFact(id) {
  return FACTS_BY_ID.get(id);
}

// Every fact that uses at least one of the chosen numbers.
export function factsForNumbers(numbers) {
  const chosen = new Set(numbers);
  return ALL_FACTS.filter(f => chosen.has(f.a) || chosen.has(f.b));
}

// Anchor facts (×1 and ×10) need almost no thinking, so their answer times
// tell us how fast this person types. See scheduler.js.
export function isAnchor(fact) {
  return fact.a === 1 || fact.b === 1 || fact.a === 10 || fact.b === 10;
}

function teachingRank(n) {
  return TEACHING_ORDER.indexOf(n);
}

// Sorts facts by the factor taught later, then by the factor taught earlier,
// so facts using only early numbers come first. Returns a new array.
export function newFactOrder(facts) {
  const later = f => Math.max(teachingRank(f.a), teachingRank(f.b));
  const earlier = f => Math.min(teachingRank(f.a), teachingRank(f.b));
  return [...facts].sort((x, y) => later(x) - later(y) || earlier(x) - earlier(y));
}

// Picks which way round to show a fact this time (3 × 7 or 7 × 3).
export function orient(fact, rng = Math.random) {
  return rng() < 0.5 ? { left: fact.a, right: fact.b } : { left: fact.b, right: fact.a };
}

export function formatFact(fact, order = { left: fact.a, right: fact.b }) {
  return `${order.left} × ${order.right}`;
}
