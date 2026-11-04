// progress-io.js: the "Export progress" and "Import progress" controls.
// Used on the intro page and the practice setup screen. It looks for:
//   <button data-export-progress>            downloads a progress file
//   <input type="file" data-import-progress>  reads a progress file
//   <p data-progress-status>                  where messages are shown

import { loadProgress, saveProgress, parseProgressFile, progressFileText, exportFileName } from './storage.js';

// getProgress (optional) returns the page's current progress, so Export
// still works when this browser isn't saving to storage.
export function setupProgressButtons({ onImported, getProgress = loadProgress } = {}) {
  const exportButton = document.querySelector('[data-export-progress]');
  const importInput = document.querySelector('[data-import-progress]');
  const status = document.querySelector('[data-progress-status]');
  const say = message => { if (status) status.textContent = message; };

  exportButton?.addEventListener('click', () => {
    const file = new Blob([progressFileText(getProgress())], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = exportFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    say('Progress file downloaded.');
  });

  importInput?.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const imported = parseProgressFile(await file.text());
      const question = Object.keys(imported.facts).length
        ? 'Replace the progress saved on this device with this file?'
        : 'This file has no practiced facts yet. Importing it will clear the progress on this device. Continue?';
      if (!confirm(question)) return;
      if (!saveProgress(imported)) {
        say("This browser won't save progress (it may be in private mode).");
        return;
      }
      say('Progress imported.');
      onImported?.(imported);
    } catch (error) {
      say(`This file can't be used: ${error.message} Your progress hasn't been changed.`);
    } finally {
      importInput.value = ''; // so choosing the same file again still works
    }
  });
}
