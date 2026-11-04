// practice.js: the practice page. Three screens, one at a time:
// setup (choose numbers and round length) → cards → summary.
// All the rules live in scheduler.js; this file only handles the page.

import { GROUPS, ALL_FACTS, factsForNumbers, formatFact } from './facts.js';
import { createSession, nextCard, recordAnswer, isFinished, summarize, getRecord, LEVEL_NAMES } from './scheduler.js';
import { createProgressKeeper } from './storage.js';
import { setupProgressButtons } from './progress-io.js';

const CORRECT_PAUSE_MS = 600; // how long the green/blue flash shows before the next card
const MIN_REVEAL_MS = 500;    // a missed fact's answer stays up at least this long
const ROUND_TYPES = {
  cards20: { mode: 'cards', length: 20 },
  timed2: { mode: 'timed', minutes: 2 },
  timed5: { mode: 'timed', minutes: 5 },
};

const $ = id => document.getElementById(id);
const screens = { setup: $('setup-screen'), card: $('card-screen'), summary: $('summary-screen') };
const cardBox = $('card');
const problem = $('problem');
const answer = $('answer');
const feedback = $('feedback');
const continueButton = $('continue-button');
const numpad = $('numpad');
const numpadToggle = $('numpad-toggle');
const checkButton = $('check-button');
const isTouch = matchMedia('(pointer: coarse)').matches;

const keeper = createProgressKeeper(); // this page's copy of progress (see storage.js)
const progress = keeper.get();         // updated in place by the keeper
let session = null;
let lastRound = null;     // {pool, roundType}, for "Practice again"
let roundStartedAt = 0;
let cardShownAt = 0;
let pauseTimer = null;
let barTimer = null;      // keeps the timed-round bar moving
let wrongShownAt = 0;
let state = 'setup';      // 'setup' | 'answering' | 'pause' | 'wrong' | 'summary'

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  window.scrollTo(0, 0);
}

function save() {
  $('save-warning').hidden = keeper.save();
}

// ---------- Setup screen ----------

const selected = new Set();
const chips = [...document.querySelectorAll('[data-number]')];

function refreshChips() {
  for (const chip of chips) chip.setAttribute('aria-pressed', String(selected.has(Number(chip.dataset.number))));
  $('start-button').disabled = selected.size === 0;
}

for (const chip of chips) {
  chip.addEventListener('click', () => {
    const n = Number(chip.dataset.number);
    if (selected.has(n)) selected.delete(n); else selected.add(n);
    refreshChips();
  });
}

for (const button of document.querySelectorAll('[data-group]')) {
  button.addEventListener('click', () => {
    GROUPS.find(g => g.id === button.dataset.group).numbers.forEach(n => selected.add(n));
    refreshChips();
  });
}

$('clear-numbers').addEventListener('click', () => { selected.clear(); refreshChips(); });

function showSavedRoundType() {
  const saved = document.querySelector(`input[name="length"][value="${progress.settings.sessionMode}"]`);
  if (saved) saved.checked = true;
}
showSavedRoundType();
const chosenRoundType = () => document.querySelector('input[name="length"]:checked').value;

$('adaptive-button').addEventListener('click', () => startRound(ALL_FACTS, chosenRoundType()));
$('start-button').addEventListener('click', () => startRound(factsForNumbers([...selected]), chosenRoundType()));

setupProgressButtons({
  getProgress: () => progress,
  onImported: imported => { keeper.set(imported); showSavedRoundType(); },
});

// When the browser brings this page back from its back/forward cache (for
// example after pressing Back), pick up anything saved on another page.
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  keeper.refresh();
  if (state === 'setup') showSavedRoundType();
});

// ---------- Starting a round ----------

function startRound(pool, roundType) {
  keeper.refresh(); // pick up anything changed on another page
  progress.settings.sessionMode = roundType;
  save();
  lastRound = { pool, roundType };
  roundStartedAt = Date.now();
  session = createSession({ pool, ...ROUND_TYPES[roundType], now: roundStartedAt });
  showScreen('card');
  applyNumpadSetting();
  clearInterval(barTimer);
  if (session.mode === 'timed') barTimer = setInterval(updateProgressBar, 250);
  showNextCard();
}

// ---------- Cards ----------

function showNextCard() {
  const card = nextCard(session, progress, { now: Date.now() });
  problem.textContent = formatFact(card.fact, card.order);
  cardBox.className = 'card';
  answer.value = '';
  answer.hidden = false;
  feedback.textContent = '';
  continueButton.hidden = true;
  checkButton.hidden = numpadOn();
  updateProgressBar();
  state = 'answering';
  cardShownAt = performance.now();
  if (!(numpadOn() && isTouch)) answer.focus(); // don't pop up the phone keyboard over the pad
}

function updateProgressBar() {
  const fraction = session.mode === 'timed'
    ? (Date.now() - roundStartedAt) / (session.endsAt - roundStartedAt)
    : session.results.length / session.length;
  $('progress-fill').style.width = `${Math.min(1, fraction) * 100}%`;
}

function submitAnswer() {
  if (state !== 'answering') return;
  const result = recordAnswer(session, progress, {
    input: answer.value,
    ms: performance.now() - cardShownAt,
    now: Date.now(),
  });
  if (!result) return; // blank or not a number: let them keep typing
  save();
  updateProgressBar();

  if (result.correct) {
    state = 'pause';
    cardBox.classList.add(result.fast ? 'correct-fast' : 'correct-slow');
    feedback.textContent = '✓ Correct';
    pauseTimer = setTimeout(goOn, CORRECT_PAUSE_MS);
  } else {
    state = 'wrong';
    cardBox.classList.add('wrong');
    problem.textContent = `${formatFact(result.fact, result.order)} = ${result.answer}`;
    answer.hidden = true;
    checkButton.hidden = true;
    feedback.textContent = "Here's the answer. This one will come back again soon.";
    continueButton.hidden = false;
    continueButton.focus();
    wrongShownAt = performance.now();
  }
}

// After a miss: move on only once the answer has been up long enough to
// read, so a quick double-tap can't skip it.
function continueAfterWrong() {
  if (state === 'wrong' && performance.now() - wrongShownAt >= MIN_REVEAL_MS) goOn();
}

function goOn() {
  if (isFinished(session, Date.now())) showSummary();
  else showNextCard();
}

continueButton.addEventListener('click', continueAfterWrong);
checkButton.addEventListener('click', submitAnswer);

// Keep only digits, at most 3.
answer.addEventListener('input', () => {
  answer.value = answer.value.replace(/\D/g, '').slice(0, 3);
});

document.addEventListener('keydown', event => {
  if (screens.card.hidden) return;
  if (event.key === 'Enter') {
    // Let Enter press a focused button (Stop early, Continue...) as usual;
    // number-pad keys are the exception, where Enter means "submit".
    if (event.target.closest('button') && !event.target.closest('#numpad')) return;
    event.preventDefault();
    if (state === 'answering') submitAnswer();
    else if (!event.repeat) continueAfterWrong();
    return;
  }
  // Typing works even when the focus is on a number-pad button, or when the
  // answer box is read-only (touch screen with the pad showing).
  if (state === 'answering' && (document.activeElement !== answer || answer.readOnly)) {
    if (/^\d$/.test(event.key)) { typeKey(event.key); event.preventDefault(); }
    if (event.key === 'Backspace') { typeKey('back'); event.preventDefault(); }
  }
});

// ---------- Number pad ----------

function numpadOn() {
  const setting = progress.settings.numpad;
  return setting === 'on' || (setting === 'auto' && isTouch);
}

function applyNumpadSetting() {
  const on = numpadOn();
  numpad.hidden = !on;
  // On touch screens with the pad showing, stop the phone's own keyboard from opening.
  answer.readOnly = on && isTouch;
  answer.setAttribute('inputmode', on && isTouch ? 'none' : 'numeric');
  numpadToggle.textContent = on ? 'Hide number pad' : 'Show number pad';
  checkButton.hidden = on;
}

function typeKey(key) {
  if (key === 'back') answer.value = answer.value.slice(0, -1);
  else if (answer.value.length < 3) answer.value += key;
}

numpad.addEventListener('click', event => {
  const key = event.target.closest('[data-key]')?.dataset.key;
  if (!key) return;
  if (key === 'enter') {
    if (state === 'answering') submitAnswer();
    else continueAfterWrong();
  } else if (state === 'answering') {
    typeKey(key);
  }
});

numpadToggle.addEventListener('click', () => {
  progress.settings.numpad = numpadOn() ? 'off' : 'on';
  save();
  applyNumpadSetting();
  if (!numpadOn() && state === 'answering') answer.focus();
});

$('stop-button').addEventListener('click', () => {
  clearTimeout(pauseTimer);
  clearInterval(barTimer);
  if (session.results.length) showSummary();
  else { state = 'setup'; showScreen('setup'); }
});

// ---------- Summary ----------

function factList(facts, describe) {
  return `<ul>${facts.map(f => `<li>${describe(f)}</li>`).join('')}</ul>`;
}

function showSummary() {
  state = 'summary';
  clearTimeout(pauseTimer);
  clearInterval(barTimer);
  const s = summarize(session, progress);
  $('summary-score').textContent = `${s.correct} of ${s.total} correct`;

  let html = '';
  if (s.leveledUp.length) {
    html += '<h2>Moved up a level</h2>'
      + factList(s.leveledUp, f => `${formatFact(f)}: now ${LEVEL_NAMES[getRecord(progress, f.id).level]}`);
  }
  if (s.refresh.length) {
    html += '<h2>Quick refresh</h2>'
      + factList(s.refresh, f => `${formatFact(f)} = ${f.answer} needs a quick refresh. You've known it before, so it'll come back fast.`);
  }
  if (s.toWorkOn.length) {
    html += '<h2>Worth another look</h2>'
      + factList(s.toWorkOn, f => `${formatFact(f)} = ${f.answer}`);
  }
  if (!html) html = '<p>Every answer was right. Nice and steady.</p>';
  $('summary-details').innerHTML = html;

  // Replay the small "pop" on the heading (CSS turns it off for reduced motion).
  const title = $('summary-title');
  title.classList.remove('celebrate');
  void title.offsetWidth;
  title.classList.add('celebrate');

  showScreen('summary');
}

$('again-button').addEventListener('click', () => startRound(lastRound.pool, lastRound.roundType));
$('change-button').addEventListener('click', () => { state = 'setup'; showScreen('setup'); });
