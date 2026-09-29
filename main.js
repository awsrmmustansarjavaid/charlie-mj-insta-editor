/**
 * main.js — Electron MAIN process (the "backend" of the desktop app).
 *
 * Responsibilities:
 *   1. Create the application window that hosts the editor UI (src/index.html).
 *   2. Keep the app truly PORTABLE: all settings live next to the .exe,
 *      nothing is written to the registry or an installer folder.
 *   3. Provide the only two things the web UI cannot do by itself:
 *        - show a native "Save as" dialog and write the exported image to disk
 *        - reveal the exported file in Windows Explorer
 *
 * The renderer (UI) never touches the file system directly. It talks to this
 * file through the small, whitelisted API exposed in preload.js.
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---------- Portable mode ----------------------------------------------- */
// electron-builder's "portable" target sets PORTABLE_EXECUTABLE_DIR to the folder
// that contains the .exe. We store user data in a sub-folder there so the whole
// app can be copied to a USB stick and keep working.
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
if (portableDir) {
  app.setPath('userData', path.join(portableDir, 'CharlieMJ-Data'));
}

let mainWindow = null;   // the single editor window
let lastExportPath = ''; // remembered so "Open in Folder" can reveal it

/** Creates the main editor window. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1536,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0a1330',            // matches the dark navy theme (no white flash)
    title: 'Charlie MJ Instagram Post Editor',
    icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
    autoHideMenuBar: true,                  // hide the default File/Edit menu
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,               // security: UI cannot reach Node APIs
      nodeIntegration: false,               // security: no require() in the UI
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

/* ---------- IPC handlers (called from preload.js) ------------------------ */

/**
 * "save-image": receives the encoded image bytes from the UI, asks the user
 * where to save, and writes the file. The ORIGINAL photo is never touched.
 * @returns {string|null} the saved path, or null if the user cancelled.
 */
ipcMain.handle('save-image', async (_event, { bytes, suggestedName, ext }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Instagram-ready image',
    defaultPath: suggestedName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, Buffer.from(bytes));
  lastExportPath = result.filePath;
  return result.filePath;
});

/** "reveal-file": opens Explorer with the last exported file selected. */
ipcMain.handle('reveal-file', () => {
  if (lastExportPath) shell.showItemInFolder(lastExportPath);
  return Boolean(lastExportPath);
});

/* ---------- App lifecycle ------------------------------------------------ */
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
