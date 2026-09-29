/**
 * export.js — encodes the final image and saves it.
 *
 * Export re-renders the composition at full size (never from the small
 * preview), encodes it as JPEG / PNG / WebP and hands the bytes to the
 * desktop shell (native "Save as" dialog) or, when running in a plain browser,
 * triggers a normal download.
 *
 * Privacy bonus: because the picture is re-drawn on a canvas and re-encoded,
 * ALL metadata (EXIF, GPS location, camera model, timestamps) is dropped.
 */
window.CMJ = window.CMJ || {};

CMJ.exporter = (function () {
  'use strict';

  const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const EXT  = { jpeg: 'jpg', png: 'png', webp: 'webp' };
  let estimateToken = 0;

  /** Render the current format at `res` pixels wide. Returns canvas + scale info. */
  function renderFull(res) {
    const st = CMJ.state, f = CMJ.formats.get(st.formatId);
    const W = res, H = Math.round(f.h * res / f.w);
    const canvas = document.createElement('canvas');
    const info = CMJ.render.frame(canvas, W, H, st, {});
    return { canvas, info, W, H };
  }

  /** Encode to a Blob using the export settings. */
  function toBlob() {
    const e = CMJ.state.exp, r = renderFull(e.res);
    return new Promise(res => r.canvas.toBlob(b => res({ blob: b, W: r.W, H: r.H, info: r.info }),
      MIME[e.format], e.format === 'png' ? undefined : e.quality / 100));
  }

  /** Default file name, e.g. "nature_4x5.jpg" (or the user's custom name). */
  function fileName() {
    const e = CMJ.state.exp, f = CMJ.formats.get(CMJ.state.formatId);
    const base = (CMJ.source.name || 'photo').replace(/\.[^.]+$/, '');
    const custom = (e.name || '').trim().replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
    return (custom || base + '_' + f.ratio.replace(':', 'x').replace('.', '_')) + '.' + EXT[e.format];
  }

  /** Export and save. Resolves to {path, size, W, H} or null if the user cancelled. */
  async function save() {
    const out = await toBlob(), name = fileName(), ext = EXT[CMJ.state.exp.format];
    if (window.charlie) {                                    // Electron desktop app
      const bytes = new Uint8Array(await out.blob.arrayBuffer());
      const path = await window.charlie.saveImage(bytes, name, ext);
      return path ? { path, size: out.blob.size, W: out.W, H: out.H } : null;
    }
    const a = document.createElement('a');                   // plain browser fallback
    a.href = URL.createObjectURL(out.blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { path: name + ' (Downloads)', size: out.blob.size, W: out.W, H: out.H };
  }

  /** Debounced size estimate so the UI can show "Output 0.9 MB" without lag. */
  function estimate(cb) {
    const token = ++estimateToken;
    setTimeout(async () => {
      if (token !== estimateToken || !CMJ.source) return;
      const out = await toBlob();
      if (token === estimateToken) cb(out);
    }, 450);
  }

  return { save, estimate, fileName };
})();
