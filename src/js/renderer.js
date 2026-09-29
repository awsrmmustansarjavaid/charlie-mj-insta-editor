/**
 * renderer.js — turns (original photo + state) into pixels on a canvas.
 *
 * The SAME function draws the live preview, the small format thumbnails, the
 * filter thumbnails and the final export, just at different sizes. That is
 * what makes the preview trustworthy: what you see is exactly what you export.
 *
 * Drawing order inside CMJ.render.frame():
 *   1. background (blur / solid / gradient / mirror) – only where the photo
 *      does not cover the frame
 *   2. the photo, moved/zoomed/rotated/flipped by the composition
 *   3. colour adjustments + filter (adjustments.js)
 *   4. sharpen, blur effect, vignette
 *   5. text & sticker layers (never colour-adjusted)
 *
 * Positions (pan) are stored as FRACTIONS of the frame, so a composition made
 * on a small preview looks identical when exported at 1080 or 2160 px wide.
 */
window.CMJ = window.CMJ || {};

CMJ.render = (function () {
  'use strict';

  /** Clickable areas of text/sticker layers (0..1 coordinates) – filled during preview renders. */
  const hitBoxes = [];

  /* ---------- scale helpers ---------- */

  /** Scale that makes the (rotated) photo COVER the whole frame – used by crop modes. */
  function coverScale(W, H, iw, ih, rad) {
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    return Math.max((W * c + H * s) / iw, (W * s + H * c) / ih);
  }
  /** Scale that makes the whole (rotated) photo FIT inside the frame – used by padding modes. */
  function containScale(W, H, iw, ih, rad) {
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    return Math.min(W / (iw * c + ih * s), H / (iw * s + ih * c));
  }
  const isCover = comp => comp.method === 'smart' || comp.method === 'manual';

  /** Average colours of the photo's four sides – used by the auto-gradient background. */
  function sampleColors(bitmap) {
    function avg(w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingQuality = 'high'; x.drawImage(bitmap, 0, 0, w, h);
      return x.getImageData(0, 0, w, h).data;
    }
    const v = avg(1, 2), h = avg(2, 1), rgb = (d, i) => 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')';
    return { top: rgb(v, 0), bottom: rgb(v, 4), left: rgb(h, 0), right: rgb(h, 4) };
  }

  /* ---------- background layers ---------- */

  /** Draws the photo again, oversized and blurred, behind the sharp photo. */
  function drawBlurBackdrop(ctx, W, H, comp, src) {
    const rad = comp.rotation * Math.PI / 180, s = coverScale(W, H, src.w, src.h, rad) * 1.15;
    ctx.save();
    ctx.filter = 'blur(' + (comp.bgBlur * 0.6 * (W / 1080)) + 'px)';     // blur radius scales with output size
    ctx.translate(W / 2, H / 2); ctx.rotate(rad);
    ctx.scale(s * (comp.flipH ? -1 : 1), s * (comp.flipV ? -1 : 1));
    ctx.drawImage(src.bitmap, -src.w / 2, -src.h / 2);
    ctx.restore(); ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);       // slightly dim so the photo pops
  }

  /** Gradient built from the photo's own edge colours (left→right or top→bottom). */
  function drawGradientBackdrop(ctx, W, H, comp, src) {
    const c = src.colors, sideways = (src.w / src.h) < (W / H);          // tall photo → bars left/right
    const g = sideways ? ctx.createLinearGradient(0, 0, W, 0) : ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sideways ? c.left : c.top); g.addColorStop(1, sideways ? c.right : c.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /** Reflect the photo across each of its edges (and corners) to extend it. Called inside the photo's transform. */
  function drawMirrors(ctx, src) {
    const w = src.w, h = src.h;
    [[0, -h, 1, -1], [0, h, 1, -1], [-w, 0, -1, 1], [w, 0, -1, 1],
     [-w, -h, -1, -1], [w, -h, -1, -1], [-w, h, -1, -1], [w, h, -1, -1]].forEach(m => {
      ctx.save(); ctx.translate(m[0], m[1]); ctx.scale(m[2], m[3]);
      ctx.drawImage(src.bitmap, -w / 2, -h / 2); ctx.restore();
    });
  }

  /* ---------- composition ---------- */

  /**
   * Draw background + photo into ctx. Returns the scale (source px → frame px)
   * so callers can warn when a photo would be enlarged (low quality).
   */
  function compose(ctx, W, H, comp, src) {
    const rad = comp.rotation * Math.PI / 180;
    const base = isCover(comp) ? coverScale(W, H, src.w, src.h, rad) : containScale(W, H, src.w, src.h, rad);
    const s = base * comp.zoom;

    ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, W, H);
    const exposed = !isCover(comp) || comp.zoom < 1 || comp.panX || comp.panY || (comp.rotation % 90 !== 0);
    if (exposed) {                                    // only pay for a background when gaps are possible
      if (comp.method === 'solid') { ctx.fillStyle = comp.bgColor; ctx.fillRect(0, 0, W, H); }
      else if (comp.method === 'gradient') drawGradientBackdrop(ctx, W, H, comp, src);
      else if (comp.method !== 'mirror') drawBlurBackdrop(ctx, W, H, comp, src);   // blur, and safety net for crop modes
    }

    ctx.save();
    ctx.translate(W / 2 + comp.panX * W, H / 2 + comp.panY * H);
    ctx.rotate(rad);
    ctx.scale(s * (comp.flipH ? -1 : 1), s * (comp.flipV ? -1 : 1));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';       // best resampling for downscaling
    if (comp.method === 'mirror') drawMirrors(ctx, src);
    ctx.drawImage(src.bitmap, -src.w / 2, -src.h / 2);
    ctx.restore();
    return s;
  }

  /* ---------- text & sticker layers ---------- */

  function drawLayers(ctx, W, H, layers, record) {
    if (record) hitBoxes.length = 0;
    layers.forEach(l => {
      const px = Math.round(l.size * H);
      ctx.save();
      ctx.font = (l.bold ? '700 ' : '400 ') + px + 'px "Segoe UI", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = px * 0.15;
      ctx.fillStyle = l.color; ctx.fillText(l.text, l.x * W, l.y * H);
      const w = ctx.measureText(l.text).width;
      ctx.restore();
      if (record) hitBoxes.push({ id: l.id, x0: l.x - w / 2 / W, x1: l.x + w / 2 / W, y0: l.y - px * 0.6 / H, y1: l.y + px * 0.6 / H });
    });
  }

  /* ---------- the one public drawing entry point ---------- */

  /**
   * Render the current photo with `st` onto `canvas` at W×H pixels.
   * @param opts.before  true → show the photo without adjustments/filters/layers
   * @param opts.record  true → remember layer hit-boxes (live preview only)
   * @returns {{s:number, W:number}} photo scale info, or null when no photo is loaded
   */
  function frame(canvas, W, H, st, opts) {
    opts = opts || {};
    const src = CMJ.source; if (!src) return null;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.filter = 'none';

    const s = compose(ctx, W, H, CMJ.State.comp(st), src);
    if (!opts.before) {
      const p = CMJ.adjust.effective(st.adj, st.filter);
      CMJ.adjust.applyColor(ctx, W, H, p);
      CMJ.adjust.sharpen(ctx, W, H, p.sharpness);
      if (p.blur > 0) {                               // soften the whole picture
        const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
        tmp.getContext('2d').drawImage(canvas, 0, 0);
        ctx.filter = 'blur(' + (p.blur * 0.2 * (W / 1080)) + 'px)'; ctx.drawImage(tmp, 0, 0); ctx.filter = 'none';
      }
      CMJ.adjust.vignette(ctx, W, H, Math.max(0, p.vignette));
      drawLayers(ctx, W, H, st.layers, opts.record);
    } else if (opts.record) hitBoxes.length = 0;
    return { s, W };
  }

  return { frame, hitBoxes, sampleColors };
})();
