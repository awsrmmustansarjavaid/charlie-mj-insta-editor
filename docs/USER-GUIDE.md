# User guide

← [Docs index](README.md)

## Getting started

1. Double-click `Charlie-MJ-Instagram-Post-Editor-Portable.exe` (see [BUILD.md](BUILD.md) for where to get
   it, or how to build your own). No installation, no admin prompt, no account.
2. Drop a photo onto the window, click **Choose image**, paste one with `Ctrl+V`, or click **Try sample
   photo** to explore the app without a photo of your own.
3. Pick an output format at the top: **Portrait (4:5)** is selected by default because it is Instagram's
   recommended feed size.

## The Story → Post workflow (the app's signature feature)

This is the workflow the app was built to solve: you have a photo shaped for a **Story (9:16)** and want
to post it to the **feed (4:5)** without Instagram cropping out something important.

1. Load the Story-shaped photo and select the **Portrait** (or Square / Landscape) format.
2. The app automatically chooses a fitting method based on how different the two shapes are:
   - Close shapes → **Smart Crop** (see below).
   - Very different shapes (a tall Story into a 4:5 post) → **fits the whole photo and fills the gap with
     a blurred copy of itself**, so nothing is cut off.
3. Open **Story → Post fit** in the right-hand panel to change the method yourself at any time:

   | Method | What you get |
   |---|---|
   | Smart crop | The app finds the most interesting region and crops to it |
   | Blur bg | Whole photo visible, gaps filled with a soft blurred copy (adjustable blur amount) |
   | Solid | Whole photo visible, gaps filled with a colour you pick |
   | Gradient | Whole photo visible, gaps filled with a gradient built from the photo's own colours |
   | Mirror | Whole photo visible, gaps filled by reflecting the photo's edges |
   | Manual | You position and crop the photo yourself |

4. Switch between formats as often as you like — **each format remembers its own crop, zoom, rotation and
   background**, so going from Portrait to Story and back never loses your work.

## Editing tools

- **Move** — click and drag the photo.
- **Zoom** — mouse wheel, the `+`/`−` buttons, or the zoom slider (25%–400%).
- **Crop** — drag the corner handles once Crop is the active tool.
- **Rotate / Straighten** — 90°/180° buttons for quick rotation, or drag for a precise angle.
- **Flip** — horizontal or vertical.
- **Adjustments** — Brightness, Contrast, Saturation, Vibrance, Sharpness, Exposure, Highlights, Shadows,
  Temperature, Tint. Double-click any slider to reset just that one.
- **Effects** — Blur, Vignette.
- **Filters** — nine presets (Original, Vivid, Warm, Cool, B&W, Vintage, Cinematic, Fade, Dramatic) with
  live thumbnails; they stack on top of whatever the sliders are set to.
- **Text & stickers** — add one or more layers, drag to position, adjust colour/size/weight.
- **Before / After** — hold the button to see the untouched original underneath your edits.
- **Undo / Redo** — up to 100 steps back. **Reset** clears the current format's edits; **Reset All**
  clears every format.

## Checking how it will actually look

- The **live Instagram preview** panel next to the canvas updates as you edit.
- Switch the main view to **Feed** (see it between two other posts) or **Profile Grid** (a 3-column tile)
  for more context.
- Turn on the **rule-of-thirds grid**, **centre guide**, or the Story/Reel **safe area** overlay from the
  overlay buttons if you want extra guides while composing.

## Exporting

- The simplest option: click **Export Instagram Ready** for one-click sensible defaults (Portrait, JPEG,
  quality 92, 1080 px).
- For more control, open the export panel:
  - **Format**: JPEG / PNG / WebP.
  - **Quality** slider.
  - **Resolution**: 1080 / 1440 / 2160 px.
  - **File name**.
  - The status bar shows the **estimated output size** and how much smaller it is than the original, and
    warns you if the export would **enlarge** a photo that is smaller than the target (upscaling tends to
    look soft).
- A native **Save as** dialog appears so you choose exactly where the file goes; **Open in Folder**
  reveals it afterwards.
- Exported files never carry EXIF, GPS or camera metadata, and the original file on your disk is never
  changed.

## Keyboard & mouse shortcuts

| Action | Shortcut |
|---|---|
| Zoom in / out | Mouse wheel, or `+` / `−` |
| Pan | Click and drag |
| Paste image | `Ctrl+V` |
| Undo / Redo | the toolbar buttons |
| Reset one slider | Double-click it |

## Troubleshooting

- **"Upscaling may reduce quality" warning** — your original photo is smaller than the target export
  size. You can continue anyway or choose a smaller output resolution.
- **The exported photo looks different from the preview** — this should not happen (export and preview
  share the same rendering code — see [ARCHITECTURE.md](ARCHITECTURE.md)); if you do see a difference,
  please open an issue with the steps to reproduce.
- **Windows SmartScreen warning on first launch** — expected for an unsigned, freely distributed `.exe`;
  choose "More info → Run anyway". See the note in [BUILD.md](BUILD.md).
- **App data / settings location** — stored in a `CharlieMJ-Data` folder created next to the `.exe`
  (portable mode), never in the Windows registry.

← [Docs index](README.md)
