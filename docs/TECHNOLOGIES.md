# Technologies used

← [Docs index](README.md)

The app is deliberately built with as few moving parts as possible: no framework, no build step, no
bundler. That keeps it easy to read, easy to package as a small portable `.exe`, and fast to start.

| Technology | Used for | Why this instead of an alternative |
|---|---|---|
| **HTML5** | App structure (`src/index.html`) | No templating engine needed for a single-window app |
| **CSS3** | All styling (`src/css/styles.css`), dark theme, layout | Plain CSS is enough for a fixed, hand-designed layout; avoids a CSS-framework dependency |
| **Vanilla JavaScript (ES2017+)** | Every behaviour (`src/js/*.js`) | No React/Vue/etc. — the UI is one window with a fixed set of controls, so a framework's overhead (virtual DOM, build tooling) buys nothing here. Modules share one `window.CMJ` namespace instead of using `import`/`export`, which means the app also runs unmodified as a plain static web page, with no bundler step |
| **Canvas 2D API** | Cropping, zoom/pan/rotate/flip, colour adjustments, filters, backgrounds, text/sticker layers, thumbnails, and final export | It is the only browser API that can do all of read → transform → re-encode in one place, which is what makes the "what you see is what you export" guarantee possible (see [ARCHITECTURE.md](ARCHITECTURE.md)) |
| **`canvas.toBlob()` / `HTMLCanvasElement`** | Encoding JPEG / PNG / WebP | Built into every Chromium build, so no image-encoding library needs to ship inside the `.exe` |
| **Electron** | Turns the web app into a Windows desktop program with its own window, icon and taskbar entry | The app's logic is plain web tech, so Electron was the natural way to package it as a portable, offline `.exe` without rewriting anything in a native language |
| **`electron-builder`** | Produces the single portable `.exe` (`npm run dist`) | Its `portable` Windows target is exactly "one `.exe`, no installer, no admin rights", which matches the project's core requirement |
| **`contextBridge` / `contextIsolation`** (Electron, in `preload.js`) | The only channel between the UI and the filesystem (native Save dialog, writing the file, revealing it in Explorer) | Keeps Node.js access out of the renderer entirely, so the image-processing code — the largest, most complex part of the app — has no OS access at all |
| **Plain JSON state** (`src/js/state.js`) | The single source of truth for everything editable, and the format Undo/Redo snapshots are made of | A plain object can be stringified for history snapshots and, later, for "Save Project" with zero extra serialisation code |

## Explicitly *not* used (and why)

- **No React/Vue/Svelte/etc.** — a virtual DOM and component tree add complexity that a single fixed
  window with plain controls does not need.
- **No Webpack/Vite/bundler** — every script is loaded directly via `<script>` tags in dependency order;
  there is nothing to bundle, so there is nothing that can break in a build step.
- **No image-processing library (Sharp, Jimp, etc.)** — the Canvas 2D API already does everything the app
  needs, entirely in the renderer, without adding a native dependency that would complicate the portable
  build.
- **No cloud/AI service for Smart Crop** — `src/js/smartcrop.js` is a small local heuristic (edge
  strength + saturation + a skin-tone bonus) specifically so the app stays offline and instant; see the
  roadmap in [FEATURES.md](FEATURES.md) for a possible future local ML model.

← [Docs index](README.md)
