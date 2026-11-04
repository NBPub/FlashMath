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

const copy = x => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Combines saved progress with this page's changes. A "change" is anything
// that differs from `base`, the saved progress as this page last saw it.
// Each fact, each setting and each speed list is taken from this page only
// if this page changed it; everything else comes from storage, so another
// tab's work isn't overwritten. With no base (just after an import), this
// page's copy wins outright.
function mergeChanges(stored, mine, base) {
  if (!base) return copy(mine);
  const out = copy(stored);
  const ids = new Set([...Object.keys(mine.facts), ...Object.keys(base.facts)]);
  for (const id of ids) {
    if (same(mine.facts[id], base.facts[id])) continue;
    if (mine.facts[id] === undefined) delete out.facts[id];
    else out.facts[id] = copy(mine.facts[id]);
  }
  for (const key of Object.keys(mine.settings)) {
    if (!same(mine.settings[key], base.settings[key])) out.settings[key] = mine.settings[key];
  }
  for (const digits of Object.keys(mine.speed)) {
    if (!same(mine.speed[digits], base.speed[digits])) out.speed[digits] = copy(mine.speed[digits]);
  }
  return out;
}

// Holds one page's copy of progress, and keeps it in step with other tabs.
// - save() and refresh() re-read storage and combine it with this page's
//   changes (see mergeChanges), so two open tabs don't overwrite each other.
// - The page's progress object stays the same object; it's updated in place,
//   so code holding on to it sees the latest data.
// - If a save fails (private mode, storage full), the unsaved changes are
//   still kept, because they still differ from what storage holds.
export function createProgressKeeper(store) {
  const progress = loadProgress(store);
  let base = copy(progress);

  // Bring the page's copy up to date with storage, keeping its own changes.
  function sync() {
    const stored = loadProgress(store);
    Object.assign(progress, mergeChanges(stored, progress, base));
    base = stored;
  }

  return {
    get: () => progress,
    // Replace everything (used after an import); the next save writes it whole.
    set(newProgress) {
      Object.assign(progress, copy(newProgress));
      base = null;
    },
    save() {
      sync();
      const ok = saveProgress(progress, store);
      if (ok) base = copy(progress);
      return ok;
    },
    refresh() {
      sync();
      return progress;
    },
  };
}
