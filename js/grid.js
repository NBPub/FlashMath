// grid.js: builds the 12×12 grid, highlights the fact under the pointer
// (or the tapped / focused square), and colors squares by mastery level.

import { NUMBERS, factId } from './facts.js';
import { getRecord, LEVEL_NAMES } from './scheduler.js';
import { createProgressKeeper, STORAGE_KEY } from './storage.js';

const table = document.getElementById('grid');
const caption = document.getElementById('grid-caption');
const masteryToggle = document.getElementById('mastery-toggle');
const legend = document.getElementById('mastery-legend');
const keeper = createProgressKeeper(); // this page's copy of progress (see storage.js)
const progress = keeper.get();         // updated in place by the keeper

buildTable();
masteryToggle.checked = progress.settings.gridMastery;
applyMastery();

// ---------- Building the table ----------

function buildTable() {
  let html = '<thead><tr><th class="corner" aria-hidden="true">×</th>';
  for (const col of NUMBERS) html += `<th scope="col" data-col="${col}">${col}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of NUMBERS) {
    html += `<tr><th scope="row" data-row="${row}">${row}</th>`;
    for (const col of NUMBERS) {
      // Only one square is a Tab stop; arrow keys move within the grid.
      const tabStop = row === 1 && col === 1 ? 0 : -1;
      html += `<td tabindex="${tabStop}" data-row="${row}" data-col="${col}">${row * col}</td>`;
    }
    html += '</tr>';
  }
  table.innerHTML = html + '</tbody>';
}

// ---------- Highlighting ----------

const HIGHLIGHTS = ['in-line', 'header-on', 'mirror', 'selected'];

function clearSelection() {
  table.querySelectorAll('.' + HIGHLIGHTS.join(', .')).forEach(el => el.classList.remove(...HIGHLIGHTS));
  caption.textContent = '';
}

function select(cell) {
  clearSelection();

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  // Faint tint on the whole row and column (including their header squares)...
  table.querySelectorAll(`[data-row="${row}"], [data-col="${col}"]`).forEach(el => el.classList.add('in-line'));
  // ...strong highlight on the two header numbers...
  table.querySelector(`thead th[data-col="${col}"]`).classList.add('header-on');
  table.querySelector(`tbody th[data-row="${row}"]`).classList.add('header-on');
  // ...an outline on the mirror square (7×3 for 3×7), which is the same fact...
  if (row !== col) table.querySelector(`td[data-row="${col}"][data-col="${row}"]`).classList.add('mirror');
  // ...and the square itself.
  cell.classList.add('selected');
  // Move the single Tab stop to this square, so Tab returns here.
  table.querySelector('td[tabindex="0"]').tabIndex = -1;
  cell.tabIndex = 0;
  caption.textContent = `${row} × ${col} = ${row * col}`;
}

table.addEventListener('pointerover', event => {
  const cell = event.target.closest('td');
  if (cell && event.pointerType === 'mouse') select(cell);
});
table.addEventListener('click', event => {
  const cell = event.target.closest('td');
  if (cell) select(cell);
});
table.addEventListener('focusin', event => {
  const cell = event.target.closest('td');
  if (cell) select(cell);
});

// Clear the highlight when the mouse leaves the grid, when someone taps or
// clicks anywhere else on the page, or when keyboard focus leaves the grid.
table.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse') clearSelection();
});
document.addEventListener('click', event => {
  if (!table.contains(event.target)) clearSelection();
});
table.addEventListener('focusout', event => {
  if (!table.contains(event.relatedTarget)) clearSelection();
});

// Arrow keys move between squares.
const MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
table.addEventListener('keydown', event => {
  const cell = event.target.closest('td');
  const move = MOVES[event.key];
  if (!cell || !move) return;
  event.preventDefault();
  const clamp = n => Math.min(12, Math.max(1, n));
  const row = clamp(Number(cell.dataset.row) + move[0]);
  const col = clamp(Number(cell.dataset.col) + move[1]);
  table.querySelector(`td[data-row="${row}"][data-col="${col}"]`).focus();
});

// ---------- Mastery colors ----------

function applyMastery() {
  const on = masteryToggle.checked;
  table.classList.toggle('show-mastery', on);
  legend.hidden = !on;
  for (const cell of table.querySelectorAll('td')) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const level = getRecord(progress, factId(row, col)).level;
    cell.dataset.level = level;
    const label = `${row} × ${col} = ${row * col}`;
    cell.setAttribute('aria-label', on ? `${label}, ${LEVEL_NAMES[level]}` : label);
  }
}

masteryToggle.addEventListener('change', () => {
  // Re-read first, so practice done in another tab isn't overwritten
  // (and the colors show the latest levels).
  keeper.refresh();
  progress.settings.gridMastery = masteryToggle.checked;
  keeper.save();
  applyMastery();
});

// Show the latest levels when practice happened somewhere else:
// - pageshow (persisted): the browser brought this page back from its
//   back/forward cache, e.g. after pressing Back from the practice page;
// - storage: another open tab just saved progress.
function showLatest() {
  keeper.refresh();
  masteryToggle.checked = progress.settings.gridMastery;
  applyMastery();
}
window.addEventListener('pageshow', event => { if (event.persisted) showLatest(); });
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) showLatest();
});
