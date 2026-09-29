/**
 * smartcrop.js — content-aware positioning ("Smart Crop").
 *
 * Idea: instead of cropping from the centre, look for the part of the photo
 * that matters. We draw a tiny (~120px) version of the photo, score every
 * pixel by how "interesting" it is, then slide a window with the target
 * aspect ratio across it and keep the position with the highest score.
 *
 * Score per pixel = edge strength (detail) + colour saturation
 *                 + a bonus for skin-tone pixels (people/faces) 
 *                 × a gentle bias towards the centre (avoids extreme crops).
 * Fully local, no AI model or internet needed.
 */
window.CMJ = window.CMJ || {};

CMJ.smartcrop = (function () {
  'use strict';

  /**
   * Find the pan offset that puts the most interesting region inside the frame.
   * @param src   CMJ.source (bitmap + size)
   * @param comp  composition (uses rotation and flips)
   * @param W,H   output frame size in pixels
   * @returns {{x:number,y:number}} pan as a fraction of frame width/height
   */
  function findPan(src, comp, W, H) {
    const rad = comp.rotation * Math.PI / 180, c = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
    const s = Math.max((W * c + H * sn) / src.w, (W * sn + H * c) / src.h);   // "cover" scale
    const rw = (src.w * c + src.h * sn) * s, rh = (src.w * sn + src.h * c) * s; // rotated size in frame px
    const k = 120 / Math.max(rw, rh);
    const lw = Math.max(8, Math.round(rw * k)), lh = Math.max(8, Math.round(rh * k));
    const ww = Math.min(lw, Math.round(W * k)), wh = Math.min(lh, Math.round(H * k));

    // 1. draw the oriented photo at low resolution
    const cv = document.createElement('canvas'); cv.width = lw; cv.height = lh;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.translate(lw / 2, lh / 2); x.rotate(rad);
    x.scale(s * k * (comp.flipH ? -1 : 1), s * k * (comp.flipV ? -1 : 1));
    x.drawImage(src.bitmap, -src.w / 2, -src.h / 2);
    const d = x.getImageData(0, 0, lw, lh).data;

    // 2. score every pixel
    const lum = new Float32Array(lw * lh), score = new Float32Array(lw * lh);
    for (let i = 0; i < lw * lh; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let yy = 0; yy < lh; yy++) for (let xx = 0; xx < lw; xx++) {
      const i = yy * lw + xx, p = i * 4;
      const gx = lum[yy * lw + Math.min(lw - 1, xx + 1)] - lum[yy * lw + Math.max(0, xx - 1)];
      const gy = lum[Math.min(lh - 1, yy + 1) * lw + xx] - lum[Math.max(0, yy - 1) * lw + xx];
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const skin = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 ? 60 : 0;
      const cx = (xx / lw - 0.5) * 2, cy = (yy / lh - 0.5) * 2;
      score[i] = (Math.abs(gx) + Math.abs(gy) + 0.6 * sat + skin) * (1.25 - 0.25 * Math.min(1, Math.hypot(cx, cy)));
    }

    // 3. integral image → fast window sums
    const I = new Float64Array((lw + 1) * (lh + 1));
    for (let yy = 1; yy <= lh; yy++) { let row = 0;
      for (let xx = 1; xx <= lw; xx++) { row += score[(yy - 1) * lw + xx - 1]; I[yy * (lw + 1) + xx] = I[(yy - 1) * (lw + 1) + xx] + row; } }
    let best = -1, bx = 0, by = 0;
    for (let yy = 0; yy <= lh - wh; yy++) for (let xx = 0; xx <= lw - ww; xx++) {
      const sum = I[(yy + wh) * (lw + 1) + xx + ww] - I[yy * (lw + 1) + xx + ww] - I[(yy + wh) * (lw + 1) + xx] + I[yy * (lw + 1) + xx];
      if (sum > best) { best = sum; bx = xx; by = yy; }
    }

    // 4. window centre offset → how far the image must move (opposite direction)
    const px = -((bx + ww / 2) - lw / 2) / k / W, py = -((by + wh / 2) - lh / 2) / k / H;
    const limX = Math.max(0, (rw - W) / (2 * W)), limY = Math.max(0, (rh - H) / (2 * H));
    return { x: Math.max(-limX, Math.min(limX, px)), y: Math.max(-limY, Math.min(limY, py)) };
  }

  return { findPan };
})();
