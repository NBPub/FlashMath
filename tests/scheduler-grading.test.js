import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newRecord, getRecord, checkAnswer, gradeAnswer, answerDigits,
  fastThreshold, addSpeedSample, DAY_MS,
} from '../js/scheduler.js';

const fact37 = { id: '3x7', a: 3, b: 7, op: 'x', answer: 21 };
const rec = overrides => ({ ...newRecord(), ...overrides });
const NOW = 1_000_000;

test('checkAnswer accepts whole numbers, ignores blanks and junk', () => {
  assert.equal(checkAnswer(fact37, '21'), true);
  assert.equal(checkAnswer(fact37, ' 021 '), true);
  assert.equal(checkAnswer(fact37, '20'), false);
  assert.equal(checkAnswer(fact37, ''), null);
  assert.equal(checkAnswer(fact37, '   '), null);
  assert.equal(checkAnswer(fact37, 'abc'), null);
  assert.equal(checkAnswer(fact37, '2.1'), null);
  assert.equal(checkAnswer(fact37, '-21'), null);
});

test('getRecord returns a new record for unseen facts without storing it', () => {
  const progress = { facts: {} };
  assert.deepEqual(getRecord(progress, '3x7'), newRecord());
  assert.deepEqual(progress.facts, {});
});

test('placement: a new fact answered fast the first time jumps to level 2', () => {
  const { record, events } = gradeAnswer(newRecord(), { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.equal(record.level, 2);
  assert.equal(record.interval, 1);
  assert.equal(record.due, NOW + DAY_MS);
  assert.equal(record.seen, 1);
  assert.equal(record.correct, 1);
  assert.equal(events.leveledUp, true);
});

test('slow but correct earns half credit; two of them earn a level', () => {
  const once = gradeAnswer(newRecord(), { correct: true, fast: false, firstShowing: true, now: NOW });
  assert.equal(once.record.level, 0);
  assert.equal(once.record.credit, 0.5);
  assert.equal(once.events.leveledUp, false);

  const twice = gradeAnswer(once.record, { correct: true, fast: false, firstShowing: true, now: NOW });
  assert.equal(twice.record.level, 1);
  assert.equal(twice.record.credit, 0);
  assert.equal(twice.record.due, NOW, 'level 1 is due immediately');
  assert.equal(twice.events.leveledUp, true);
});

test('fast and correct at level 2 moves to Strong and marks wasStrong', () => {
  const { record } = gradeAnswer(rec({ level: 2, interval: 1 }), { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.equal(record.level, 3);
  assert.equal(record.interval, 3);
  assert.equal(record.due, NOW + 3 * DAY_MS);
  assert.equal(record.wasStrong, true);
});

test('only the first showing in a session earns credit', () => {
  const { record, events } = gradeAnswer(rec({ level: 2 }), { correct: true, fast: true, firstShowing: false, now: NOW });
  assert.equal(record.level, 2);
  assert.equal(record.credit, 0);
  assert.equal(record.correct, 1);
  assert.equal(events.leveledUp, false);
});

test('a wrong answer drops to level 1 and flags drops from strong', () => {
  const strong = gradeAnswer(rec({ level: 3, wasStrong: true, credit: 0.5 }), { correct: false, fast: false, firstShowing: true, now: NOW });
  assert.equal(strong.record.level, 1);
  assert.equal(strong.record.credit, 0);
  assert.equal(strong.record.due, NOW);
  assert.equal(strong.record.wrong, 1);
  assert.equal(strong.events.dropped, true);
  assert.equal(strong.events.droppedFromStrong, true);

  const familiar = gradeAnswer(rec({ level: 2 }), { correct: false, fast: false, firstShowing: true, now: NOW });
  assert.equal(familiar.events.dropped, true);
  assert.equal(familiar.events.droppedFromStrong, false);

  const learning = gradeAnswer(rec({ level: 1 }), { correct: false, fast: false, firstShowing: false, now: NOW });
  assert.equal(learning.record.level, 1);
  assert.equal(learning.events.dropped, false);
});

test('at Mastered, more credit doubles the interval up to 60 days', () => {
  const doubled = gradeAnswer(rec({ level: 4, interval: 7 }), { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.equal(doubled.record.level, 4);
  assert.equal(doubled.record.interval, 14);
  assert.equal(doubled.record.due, NOW + 14 * DAY_MS);
  assert.equal(doubled.events.leveledUp, false);

  const capped = gradeAnswer(rec({ level: 4, interval: 56 }), { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.equal(capped.record.interval, 60);
});

test('gradeAnswer does not modify the record passed in', () => {
  const before = newRecord();
  gradeAnswer(before, { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.deepEqual(before, newRecord());
});

test('answerDigits', () => {
  assert.equal(answerDigits(7), 1);
  assert.equal(answerDigits(56), 2);
  assert.equal(answerDigits(144), 3);
});

test('fastThreshold uses defaults until there are 5 samples', () => {
  const empty = { 1: [], 2: [], 3: [] };
  assert.equal(fastThreshold(empty, 1), 4000);
  assert.equal(fastThreshold(empty, 2), 5000);
  assert.equal(fastThreshold(empty, 3), 6000);
  assert.equal(fastThreshold({ 1: [1000, 1000, 1000, 1000] }, 1), 4000);
});

test('fastThreshold is the median baseline plus 2 s, clamped to 2.5–10 s', () => {
  assert.equal(fastThreshold({ 1: [1000, 1200, 1100, 1300, 900] }, 1), 3100);
  assert.equal(fastThreshold({ 1: [100, 100, 100, 100, 100] }, 1), 2500);
  assert.equal(fastThreshold({ 1: [9000, 9000, 9000, 9000, 9000] }, 1), 10000);
});

test('addSpeedSample keeps only the last 10 samples', () => {
  const speed = { 1: [], 2: [], 3: [] };
  for (let i = 1; i <= 12; i++) addSpeedSample(speed, 2, i * 100);
  assert.equal(speed[2].length, 10);
  assert.equal(speed[2][0], 300);
  assert.equal(speed[2].at(-1), 1200);
});

test('a Mastered fact with no saved interval still gets a real review gap', () => {
  const { record } = gradeAnswer(rec({ level: 4, interval: 0 }), { correct: true, fast: true, firstShowing: true, now: NOW });
  assert.equal(record.interval, 7);
  assert.equal(record.due, NOW + 7 * DAY_MS);
});
