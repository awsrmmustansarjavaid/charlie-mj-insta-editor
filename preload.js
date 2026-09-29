/**
 * preload.js — the secure BRIDGE between the UI and the main process.
 *
 * It runs before the web page loads and exposes exactly two functions on
 * `window.charlie`. The UI can call them, but gets no other Node/Electron power.
 * (In a normal browser `window.charlie` is undefined and the UI falls back to a
 * plain download link — see src/js/export.js.)
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('charlie', {
  /** Save encoded image bytes through a native dialog. Resolves to the path or null. */
  saveImage: (bytes, suggestedName, ext) =>
    ipcRenderer.invoke('save-image', { bytes, suggestedName, ext }),
  /** Reveal the last exported file in Windows Explorer. */
  revealLastExport: () => ipcRenderer.invoke('reveal-file')
});
