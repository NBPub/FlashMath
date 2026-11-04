import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, BACKUP_KEY, defaultProgress, migrate, loadProgress, saveProgress,
  parseProgressFile, progressFileText, exportFileName, createProgressKeeper,
} from '../js/storage.js';

// A stand-in for the browser's localStorage.
function fakeStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}
const brokenStore = {
  getItem() { throw new Error('storage disabled'); },
  setItem() { throw new Error('quota exceeded'); },
};

test('default progress shape', () => {
  assert.deepEqual(defaultProgress(), {
    version: 1,
    facts: {},
    speed: { 1: [], 2: [], 3: [] },
    settings: { numpad: 'auto', gridMastery: false, sessionMode: 'cards20' },
  });
});

test('save then load gives back the same progress', () => {
  const store = fakeStore();
  const progress = defaultProgress();
  progress.facts['3x7'] = { level: 2, credit: 0.5, due: 123, interval: 1, seen: 3, correct: 2, wrong: 1, wasStrong: false };
  progress.speed[1] = [1500, 1600];
  progress.settings.numpad = 'on';
  assert.equal(saveProgress(progress, store), true);
  assert.deepEqual(loadProgress(store), progress);
});

test('an empty store loads default progress', () => {
  assert.deepEqual(loadProgress(fakeStore()), defaultProgress());
});

test('corrupt saved data loads defaults and is kept as a backup', () => {
  const store = fakeStore({ [STORAGE_KEY]: 'not json{' });
  assert.deepEqual(loadProgress(store), defaultProgress());
  assert.equal(store.data.get(BACKUP_KEY), 'not json{');
});

test('data from a newer version loads defaults and is kept as a backup', () => {
  const raw = JSON.stringify({ version: 2, facts: {} });
  const store = fakeStore({ [STORAGE_KEY]: raw });
  assert.deepEqual(loadProgress(store), defaultProgress());
  assert.equal(store.data.get(BACKUP_KEY), raw);
});

test('storage that throws never crashes the app', () => {
  assert.deepEqual(loadProgress(brokenStore), defaultProgress());
  assert.equal(saveProgress(defaultProgress(), brokenStore), false);
  assert.deepEqual(loadProgress(null), defaultProgress(), 'no storage at all');
  assert.equal(saveProgress(defaultProgress(), null), false);
});

test('migrate drops unknown facts and fills in missing fields', () => {
  const out = migrate({ version: 1, facts: { '3x7': { level: 3 }, '13x13': { level: 1 }, bogus: 5 } });
  assert.deepEqual(Object.keys(out.facts), ['3x7']);
  assert.deepEqual(out.facts['3x7'], { level: 3, credit: 0, due: 0, interval: 0, seen: 0, correct: 0, wrong: 0, wasStrong: false });
  assert.deepEqual(out.settings, defaultProgress().settings);
});

test('migrate keeps valid settings and ignores invalid ones', () => {
  const out = migrate({ version: 1, facts: {}, settings: { numpad: 'off', gridMastery: true, sessionMode: 'nonsense' } });
  assert.deepEqual(out.settings, { numpad: 'off', gridMastery: true, sessionMode: 'cards20' });
});

test('migrate rejects bad data with a readable message', () => {
  assert.throws(() => migrate({ foo: 1 }), /not a progress file/i);
  assert.throws(() => migrate({ version: 2, facts: {} }), /newer version/i);
  assert.throws(() => migrate({ version: 1, facts: { '3x7': { level: 7 } } }, { strict: true }), /3x7/);
  assert.throws(() => migrate(null), /not a progress file/i);
});

test('parseProgressFile reads exported files and rejects other files', () => {
  const progress = defaultProgress();
  progress.facts['2x5'] = { level: 4, credit: 0, due: 0, interval: 14, seen: 9, correct: 9, wrong: 0, wasStrong: true };
  assert.deepEqual(parseProgressFile(progressFileText(progress)), progress);
  assert.throws(() => parseProgressFile('hello'), /not a progress file/i);
  assert.throws(() => parseProgressFile('{"name":"some other json"}'), /not a progress file/i);
});

test('export file name uses the local date', () => {
  assert.equal(exportFileName(new Date(2026, 10, 3)), 'flash-math-progress-2026-11-03.json');
});

test('a browser that blocks localStorage entirely never crashes the app', () => {
  // In Chrome/Safari with site data blocked, even reading `localStorage` throws.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError: access denied'); },
  });
  try {
    assert.deepEqual(loadProgress(), defaultProgress());
    assert.equal(saveProgress(defaultProgress()), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('when saving fails, a page keeps this session\'s progress instead of reloading old data', () => {
  const saved = defaultProgress();
  const store = {
    getItem: () => JSON.stringify(saved),
    setItem() { throw new Error('quota exceeded'); },
  };
  const keeper = createProgressKeeper(store);
  keeper.get().facts['3x7'] = { level: 2, credit: 0, due: 0, interval: 1, seen: 1, correct: 1, wrong: 0, wasStrong: false };
  assert.equal(keeper.save(), false);
  assert.equal(keeper.refresh().facts['3x7'].level, 2);
});

test('refreshing before saving a setting keeps progress saved by another tab', () => {
  const store = fakeStore();
  const gridTab = createProgressKeeper(store);
  const practiceTab = createProgressKeeper(store);
  practiceTab.get().facts['3x7'] = { level: 3, credit: 0, due: 0, interval: 3, seen: 2, correct: 2, wrong: 0, wasStrong: true };
  assert.equal(practiceTab.save(), true);

  gridTab.refresh().settings.gridMastery = true;
  gridTab.save();

  const final = loadProgress(store);
  assert.equal(final.facts['3x7'].level, 3);
  assert.equal(final.settings.gridMastery, true);
});

test('loading skips bad fact records instead of resetting everything', () => {
  const saved = { version: 1, facts: { '3x7': { level: 7 }, '2x5': { level: 2 }, '13x13': { level: 1 }, '4x4': 'junk' } };
  const out = loadProgress(fakeStore({ [STORAGE_KEY]: JSON.stringify(saved) }));
  assert.equal(out.facts['2x5'].level, 2);
  assert.deepEqual(Object.keys(out.facts), ['2x5']);
});

test('imported files must match the format exactly', () => {
  const file = facts => JSON.stringify({ version: 1, facts });
  assert.throws(() => parseProgressFile(file({ '3x7': { level: 7 } })), /3x7/);
  assert.throws(() => parseProgressFile(file({ '13x13': { level: 1 } })), /13x13/);
  assert.throws(() => parseProgressFile(file({ '3x7': 5 })), /3x7/);
  assert.throws(() => parseProgressFile(JSON.stringify({ version: 0, facts: {} })), /not a progress file/i);
  assert.throws(() => parseProgressFile(JSON.stringify({ version: -1, facts: {} })), /not a progress file/i);
  assert.throws(() => parseProgressFile(JSON.stringify({ version: 1.5, facts: {} })), /not a progress file/i);
});
