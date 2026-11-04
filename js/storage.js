// storage.js: saves and loads progress in the browser's localStorage, and
// reads/writes progress files for export and import.
// The browser storage is passed in as `store`, so tests can use a fake one.
// None of these functions throw except migrate/parseProgressFile, whose
// error messages are meant to be shown to the user.

import { getFact } from './facts.js';
import { newRecord, MAX_LEVEL, SPEED_KEEP } from './scheduler.js';

export const STORAGE_KEY = 'mathFactsFlash';
export const BACKUP_KEY = 'mathFactsFlash.bak';
export const CURRENT_VERSION = 1;

const VALID_NUMPAD = ['auto', 'on', 'off'];
const VALID_SESSION_MODES = ['cards20', 'timed2', 'timed5'];
const RECORD_NUMBERS = ['credit', 'due', 'interval', 'seen', 'correct', 'wrong'];

export function defaultProgress() {
  return {
    version: CURRENT_VERSION,
    facts: {},
    speed: { 1: [], 2: [], 3: [] },
    settings: { numpad: 'auto', gridMastery: false, sessionMode: 'cards20' },
  };
}

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

// Checks saved or imported data and returns a clean, current-version copy.
// strict (used for imports): any unusable fact entry rejects the whole file.
// Not strict (used when loading this device's own data): unusable entries
// are skipped, so one bad record doesn't cost all the other progress.
// Later versions (e.g. profiles) will upgrade old data here.
export function migrate(data, { strict = false } = {}) {
  if (!isPlainObject(data) || !Number.isInteger(data.version) || data.version < 1 || !isPlainObject(data.facts)) {
    throw new Error('it is not a progress file from this app.');
  }
  if (data.version > CURRENT_VERSION) {
    throw new Error('it comes from a newer version of the app.');
  }

  const out = defaultProgress();

  for (const [id, saved] of Object.entries(data.facts)) {
    const usable = getFact(id) && isPlainObject(saved)
      && Number.isInteger(saved.level) && saved.level >= 0 && saved.level <= MAX_LEVEL;
    if (!usable) {
      if (strict) throw new Error(`it has an unusable entry for "${id}".`);
      continue;
    }
    const record = { ...newRecord(), level: saved.level, wasStrong: saved.wasStrong === true };
    for (const key of RECORD_NUMBERS) {
      if (Number.isFinite(saved[key]) && saved[key] >= 0) record[key] = saved[key];
    }
    out.facts[id] = record;
  }

  if (isPlainObject(data.speed)) {
    for (const digits of ['1', '2', '3']) {
      if (Array.isArray(data.speed[digits])) {
        out.speed[digits] = data.speed[digits].filter(ms => Number.isFinite(ms) && ms > 0).slice(-SPEED_KEEP);
      }
    }
  }

  if (isPlainObject(data.settings)) {
    const s = data.settings;
    if (VALID_NUMPAD.includes(s.numpad)) out.settings.numpad = s.numpad;
    if (VALID_SESSION_MODES.includes(s.sessionMode)) out.settings.sessionMode = s.sessionMode;
    if (typeof s.gridMastery === 'boolean') out.settings.gridMastery = s.gridMastery;
  }

  return out;
}

// The store to use: the one passed in, or the browser's localStorage.
// Called inside try blocks, because when a browser blocks site data,
// even reading `localStorage` throws.
function browserStore(store) {
  return store === undefined ? globalThis.localStorage : store;
}

// Reads saved progress. Missing, unreadable or unavailable storage gives
// fresh progress; unreadable data is copied to BACKUP_KEY first.
export function loadProgress(store) {
  let raw;
  try {
    store = browserStore(store);
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return defaultProgress();
  }
  if (raw === null || raw === undefined) return defaultProgress();

  try {
    return migrate(JSON.parse(raw));
  } catch {
    try { store.setItem(BACKUP_KEY, raw); } catch { /* nothing more we can do */ }
    return defaultProgress();
  }
}

// Returns false if the browser wouldn't save (private mode, storage full).
export function saveProgress(progress, store) {
  try {
    browserStore(store).setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function progressFileText(progress) {
  return JSON.stringify(progress, null, 2);
}

export function parseProgressFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('it is not a progress file from this app.');
  }
  return migrate(data, { strict: true });
}

export function exportFileName(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `flash-math-progress-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// Holds one page's copy of progress.
// - refresh() re-reads storage, so changes made in another tab aren't overwritten.
// - If a save ever fails (private mode, storage full), this copy is the only
//   one left, so refresh() keeps it instead of reloading older saved data.
export function createProgressKeeper(store) {
  let progress = loadProgress(store);
  let lastSaveOk = true;
  return {
    get: () => progress,
    set(newProgress) { progress = newProgress; },
    save() {
      lastSaveOk = saveProgress(progress, store);
      return lastSaveOk;
    },
    refresh() {
      if (lastSaveOk) progress = loadProgress(store);
      return progress;
    },
  };
}
