# Building the portable Windows .exe

← [Docs index](README.md)

## Where the ready-made .exe is

This repository ships a ready-built copy at:

```
dist/Charlie-MJ-Instagram-Post-Editor-Portable.exe
```

Just copy that one file anywhere (a folder, a USB stick) and double-click it — no installer, no admin
rights, no internet connection needed.

> **Note on repository size:** the built `.exe` is close to 100 MB, which is GitHub's per-file limit for a
> normal `git push`. If you fork or re-build this project, publish the `.exe` through **GitHub Releases**
> rather than committing it to the repository — `.gitignore` already excludes `dist/` for this reason.

## Building it yourself

Requirements: [Node.js](https://nodejs.org) 18 or later. Building the Windows target works on Windows,
macOS or Linux (electron-builder cross-compiles Windows portable builds without needing Wine).

```bash
git clone <this-repo-url>
cd charlie-mj-instagram-post-editor
npm install          # installs Electron + electron-builder (devDependencies only)
npm run dist          # runs electron-builder --win portable --x64
```

Output:

```
dist/win-unpacked/                                   # the unpacked app (for debugging)
dist/Charlie-MJ-Instagram-Post-Editor-Portable.exe    # the single portable executable
```

## How the build is configured

Everything lives in the `build` key of `package.json`:

```json
"build": {
  "appId": "com.charliemj.instagrampostEditor",
  "productName": "Charlie MJ Instagram Post Editor",
  "artifactName": "Charlie-MJ-Instagram-Post-Editor-Portable.exe",
  "directories": { "output": "dist", "buildResources": "build" },
  "files": ["main.js", "preload.js", "src/**/*", "assets/icons/**/*", "assets/sample/**/*"],
  "win": { "target": "portable", "icon": "build/icon.ico", "signAndEditExecutable": false },
  "portable": { "requestExecutionLevel": "user" }
}
```

- **`target: "portable"`** is electron-builder's single-file Windows format: the app unpacks to a
  temporary folder at launch and runs from there, so nothing is installed on the machine.
- **`requestExecutionLevel: "user"`** avoids a Windows admin-rights (UAC) prompt.
- **`files`** whitelists exactly what ships inside the `.exe` — the renderer source, the two Electron
  entry files, the icon and the embedded sample photo. Everything else (docs, screenshots, the author's
  full-resolution photos, `node_modules`) is left out, which is what keeps the executable as small as it
  is for an Electron app.
- **`signAndEditExecutable: false`** — the build is not code-signed. This means Windows SmartScreen will
  show an "unknown publisher" warning on first run (see below); code-signing is on the roadmap in
  [FEATURES.md](FEATURES.md).

## Portable data storage

At runtime, `main.js` detects electron-builder's portable mode via the `PORTABLE_EXECUTABLE_DIR`
environment variable and stores user data in a `CharlieMJ-Data` folder created **next to the .exe** —
never in `%APPDATA%` or the Windows registry — so the whole app folder can be moved or copied between
machines and keeps working.

## The SmartScreen warning

Because the `.exe` is not code-signed, Windows will show "Windows protected your PC" the first time
someone runs it. This is expected for any freely-distributed, unsigned executable — click **More info →
Run anyway**. Removing this prompt requires a paid code-signing certificate, which is out of scope for
this project for now.

## Publishing a release

1. Bump `"version"` in `package.json`.
2. `npm run dist`.
3. Create a GitHub Release and upload `dist/Charlie-MJ-Instagram-Post-Editor-Portable.exe` as a release
   asset (release assets are not subject to the normal repository file-size limits).

← [Docs index](README.md)
