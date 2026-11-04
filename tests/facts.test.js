import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_FACTS, GROUPS, factId, getFact, factsForNumbers, isAnchor,
  newFactOrder, orient, formatFact,
} from '../js/facts.js';

test('there are 78 unique facts, smaller factor first', () => {
  assert.equal(ALL_FACTS.length, 78);
  assert.equal(new Set(ALL_FACTS.map(f => f.id)).size, 78);
  for (const f of ALL_FACTS) {
    assert.ok(f.a <= f.b);
    assert.equal(f.answer, f.a * f.b);
    assert.equal(f.op, 'x');
  }
});

test('factId ignores order', () => {
  assert.equal(factId(7, 3), '3x7');
  assert.equal(factId(3, 7), '3x7');
  assert.equal(getFact('3x7').answer, 21);
  assert.equal(getFact('7x3'), undefined);
});

test('the 6s are the 12 facts that contain a 6', () => {
  const sixes = factsForNumbers([6]);
  assert.equal(sixes.length, 12);
  assert.ok(sixes.every(f => f.a === 6 || f.b === 6));
});

test('a fact is included if either factor is selected', () => {
  // 12 facts with a 2, 12 with a 5, minus 2x5 counted twice
  assert.equal(factsForNumbers([2, 5]).length, 23);
  assert.equal(factsForNumbers([]).length, 0);
  assert.equal(factsForNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).length, 78);
});

test('groups follow the teaching order', () => {
  assert.deepEqual(GROUPS.map(g => g.numbers), [[1, 2, 5, 10], [3, 4, 9, 11], [6, 7, 8, 12]]);
});

test('anchor facts have a 1 or a 10', () => {
  assert.equal(isAnchor(getFact('1x7')), true);
  assert.equal(isAnchor(getFact('7x10')), true);
  assert.equal(isAnchor(getFact('3x7')), false);
});

test('new facts come in teaching order', () => {
  const order = newFactOrder(ALL_FACTS).map(f => f.id);
  assert.deepEqual(order.slice(0, 6), ['1x1', '1x2', '2x2', '1x5', '2x5', '5x5']);
  assert.equal(order.at(-1), '12x12');
  // 3x10 comes after every starter-only fact, because 3 is taught after 10
  assert.ok(order.indexOf('3x10') > order.indexOf('10x10'));
  assert.equal(ALL_FACTS[0].id, '1x1', 'newFactOrder must not reorder the original list');
});

test('orient picks a display order', () => {
  const f = getFact('3x7');
  assert.deepEqual(orient(f, () => 0.1), { left: 3, right: 7 });
  assert.deepEqual(orient(f, () => 0.9), { left: 7, right: 3 });
  assert.equal(formatFact(f), '3 × 7');
  assert.equal(formatFact(f, { left: 7, right: 3 }), '7 × 3');
});
