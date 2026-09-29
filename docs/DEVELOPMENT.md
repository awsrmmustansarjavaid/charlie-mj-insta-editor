# Development guide

← [Docs index](README.md)

## Folder structure

```
charlie-mj-instagram-post-editor/
├── main.js                 # Electron main process (window, save dialog, portable data folder)
├── preload.js               # contextBridge: the only API exposed to the UI
├── package.json              # scripts + electron-builder config
├── src/                       # the actual app (also runs as a plain static web page)
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── state.js          # CMJ.state — single source of truth + Undo/Redo
│       ├── formats.js        # Instagram presets
│       ├── smartcrop.js      # local, heuristic content-aware crop
│       ├── adjustments.js    # colour/effect maths + filter presets
│       ├── renderer.js       # the one draw function used by preview/thumbs/export
│       ├── export.js         # full-resolution encode + save
│       ├── ui.js              # DOM wiring — the only file that touches the page
│       ├── sample.js          # embedded demo photo
│       └── app.js             # entry point
├── assets/
│   ├── icons/                # app icon
│   ├── photos/                # author photo, project thumbnail
│   ├── sample/                # source of the embedded sample photo
│   └── screenshots/           # app screenshot used in the docs
├── build/
│   └── icon.ico                # Windows executable icon
└── docs/                        # you are here
```

## Running from source

No build step, no bundler — the app is plain HTML/CSS/JS.

```bash
npm install       # installs Electron + electron-builder only (devDependencies)
npm start          # opens the app in an Electron window
```

You can also open `src/index.html` directly in a browser to work on the UI without Electron at all; the
only things that will not work are the native Save dialog and "Open in Folder" (the app falls back to a
normal browser download in that case).

## Coding conventions

- **One `window.CMJ` namespace.** Every module attaches its public functions to `CMJ.<name>` (e.g.
  `CMJ.state`, `CMJ.render`, `CMJ.formats`) instead of declaring more globals. This keeps the dependency
  graph explicit even without a module bundler.
- **State in, render out.** UI code (`ui.js`) never draws anything itself — it changes `CMJ.state` and
  then calls the renderer. This is what keeps preview/thumbnails/export guaranteed to match (see
  [ARCHITECTURE.md](ARCHITECTURE.md)).
- **`commit()` on finished actions only.** History snapshots (`CMJ.history.push()`) are taken when an
  action *finishes* (mouse released, button clicked), not on every intermediate value, so Undo has one
  sensible step per user action rather than one per pixel of a drag.
- **Comment style.** Every file starts with a short block comment explaining its one responsibility;
  non-obvious functions have a one-line `/** ... */` doc comment above them. Follow this pattern for new
  files/functions.
- **No dependencies beyond Electron/electron-builder.** Keep the app buildable and auditable without a
  `node_modules` full of transitive image-processing or UI-framework packages.

## How to add a feature

1. **A new Instagram preset** — add one entry to `LIST` in `src/js/formats.js`; the format selector,
   thumbnail strip and export panel all read from that array automatically.
2. **A new adjustment slider** — add its default to `ADJ_DEFAULT` in `state.js`, its maths to
   `adjustments.js`, and a slider element + binding in `ui.js`.
3. **A new background fill method** (alongside Smart Crop / Blur / Solid / Gradient / Mirror) — add a case
   in the background-drawing section of `renderer.js` and a button in `ui.js`'s Story → Post panel.
4. **A new filter preset** — add one entry to the filter list in `adjustments.js`; thumbnails are
   generated automatically by re-using `renderer.js`.

## Testing

There is currently no automated test suite (see the roadmap in [FEATURES.md](FEATURES.md)). When changing
rendering logic, manually verify that the **live preview, the format thumbnails, and an actual exported
file all look identical** — that guarantee is the app's core design property.

## Contributing

Pull requests are welcome. Please keep new code dependency-free where possible, follow the comment
conventions above, and update the relevant file in `docs/` alongside any user-visible change.

← [Docs index](README.md)
