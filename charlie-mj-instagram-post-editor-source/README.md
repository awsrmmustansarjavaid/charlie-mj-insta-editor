# Charlie MJ Instagram Post Editor

![Project thumbnail](assets/photos/project-thumbnail.jpg)

A **portable Windows desktop app** that turns any photo — or an existing Instagram Story — into a
perfectly-sized Instagram post, without losing quality and without uploading anything anywhere.

One `.exe`. No installer. No account. No internet required.

[Download Charlie MJ Instagram Post Editor]()

## Why I made this

I kept running into the same problem: a photo shot or exported for an Instagram **Story (9:16)** never
fits an Instagram **feed post (4:5)** without Instagram cropping it oddly or squeezing it into the wrong
shape. General-purpose photo editors don't know Instagram's exact sizes, and online resizers upload your
photos to someone else's server and often re-compress them until they look soft. I wanted one small, fast,
private tool that knows Instagram's rules and gets a photo "Instagram ready" in a few clicks — so I built
it. The full story, the problem in detail, and who this is for are in
**[docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md)**.

## Core features

- **5 Instagram formats** — Portrait (default), Square, Landscape, Story, Reel — each remembering its own
  crop so switching formats never loses your work.
- **Story → Post conversion**, the signature feature: Smart Crop, Blur background, Solid, Gradient,
  Mirror, or Manual — your choice, shown live before you export.
- **Full editor** — move, zoom, crop, rotate, flip, 10 colour/effect sliders, 9 filters, text & stickers,
  Before/After, Undo/Redo.
- **Live Instagram-style preview** — see the post, the feed, and the profile grid, not just a cropped
  rectangle.
- **High-quality, private export** — JPEG/PNG/WebP, up to 2160 px, metadata (EXIF/GPS) stripped
  automatically, original file never touched.
- **Portable** — a single `.exe`, no installation, works offline, settings stored next to the app.

Every feature, in detail, is documented in **[docs/FEATURES.md](docs/FEATURES.md)**.

## Technologies

Plain **HTML/CSS/JavaScript** and the **Canvas 2D API** for all image processing, packaged into a Windows
desktop app with **Electron** and **electron-builder**. No frameworks, no build step, no cloud services —
see **[docs/TECHNOLOGIES.md](docs/TECHNOLOGIES.md)** for the full list and the reasoning behind each
choice, and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for how the pieces fit together (with a
diagram).

## Getting started

**Just want to use it?** Grab `dist/Charlie-MJ-Instagram-Post-Editor-Portable.exe` and double-click it —
see **[docs/USER-GUIDE.md](docs/USER-GUIDE.md)** for a full walkthrough.

**Want to run or build it yourself?**

```bash
npm install
npm start        # run from source
npm run dist       # build the portable .exe
```

Full instructions: **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** (running from source, folder structure,
how to add a feature) and **[docs/BUILD.md](docs/BUILD.md)** (packaging the `.exe`, publishing a release).

## Documentation

Everything above is covered in more depth in the **[docs/](docs/README.md)** folder:

| Document | What it explains |
|---|---|
| [PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) | The problem, why this exists, benefits, who it's for |
| [FEATURES.md](docs/FEATURES.md) | Every feature in detail, plus the roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is put together, with a diagram |
| [TECHNOLOGIES.md](docs/TECHNOLOGIES.md) | What it's built with, and why |
| [USER-GUIDE.md](docs/USER-GUIDE.md) | Step-by-step usage and troubleshooting |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Run from source, conventions, how to extend |
| [BUILD.md](docs/BUILD.md) | Build and publish the portable `.exe` |

## License

[MIT](LICENSE) — Charlie MJ.
