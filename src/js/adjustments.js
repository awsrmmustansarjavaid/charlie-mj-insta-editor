/**
 * adjustments.js — colour & effect maths (works on canvas pixels).
 *
 * Pipeline order (see renderer.js): exposure/brightness/contrast/highlights/
 * shadows/fade are baked into a 256-entry lookup table (fast), then each pixel
 * gets temperature/tint, saturation and vibrance. Sharpen is a separate
 * 3×3 convolution. Filters are simply presets that ADD offsets to the sliders,
 * so the user can still fine-tune on top of a filter.
 */
window.CMJ = window.CMJ || {};

CMJ.adjust = (function () {
  'use strict';

  /** Filter presets: offsets added to the adjustment sliders. */
  const FILTERS = [
    { id: 'original',  name: 'Original',  d: {} },
    { id: 'vivid',     name: 'Vivid',     d: { saturation: 25, contrast: 12, vibrance: 15 } },
    { id: 'warm',      name: 'Warm',      d: { temperature: 28, tint: 4, saturation: 6 } },
    { id: 'cool',      name: 'Cool',      d: { temperature: -28, tint: -3 } },
    { id: 'bw',        name: 'B&W',       d: { saturation: -100, contrast: 15 } },
    { id: 'vintage',   name: 'Vintage',   d: { saturation: -22, temperature: 24, fade: 35, contrast: -8, vignette: 25 } },
    { id: 'cinematic', name: 'Cinematic', d: { contrast: 24, saturation: -10, shadows: -14, temperature: -10, vignette: 22 } },
    { id: 'fade',      name: 'Fade',      d: { fade: 55, saturation: -12, contrast: -10 } },
    { id: 'dramatic',  name: 'Dramatic',  d: { contrast: 38, highlights: -20, shadows: -20, saturation: 10, vignette: 30 } }
  ];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /** Slider values + the active filter's offsets → the numbers actually used. */
  function effective(adj, filterId) {
    const f = FILTERS.find(x => x.id === filterId) || FILTERS[0];
    const out = {};
    for (const k in adj) out[k] = clamp(adj[k] + (f.d[k] || 0), -100, 100);
    return out;
  }

  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /** Build the per-channel tone curve (input 0..255 → output 0..255). */
  function buildLUT(p) {
    const lut = new Uint8ClampedArray(256);
    const ev = Math.pow(2, p.exposure / 50), br = p.brightness / 200, c = p.contrast / 100;
    const hi = (p.highlights / 100) * 0.3, sh = (p.shadows / 100) * 0.3, fade = (p.fade / 100) * 0.2;
    for (let i = 0; i < 256; i++) {
      let x = (i / 255) * ev + br;                  // exposure (stops) + brightness
      x = (x - 0.5) * (1 + c) + 0.5;                // contrast around mid-grey
      const w = clamp(x, 0, 1);
      x += hi * smooth(0.5, 1, w);                  // highlights only affect bright tones
      x += sh * (1 - smooth(0, 0.5, w));            // shadows only affect dark tones
      x = fade + x * (1 - fade);                    // fade lifts the blacks
      lut[i] = clamp(x, 0, 1) * 255;
    }
    return lut;
  }

  /** Apply tone, white-balance, saturation and vibrance to the whole canvas. */
  function applyColor(ctx, W, H, p) {
    const neutral = !(p.exposure || p.brightness || p.contrast || p.highlights || p.shadows || p.fade ||
                      p.temperature || p.tint || p.saturation || p.vibrance);
    if (neutral) return;
    const img = ctx.getImageData(0, 0, W, H), d = img.data, lut = buildLUT(p);
    const tS = p.temperature * 0.3, gS = -p.tint * 0.2, rbS = p.tint * 0.1;   // white balance shifts
    const sat = 1 + p.saturation / 100, vib = p.vibrance / 100;
    const colour = sat !== 1 || vib !== 0;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] + tS + rbS, g = d[i + 1] + gS, b = d[i + 2] - tS + rbS;
      r = lut[(r < 0 ? 0 : r > 255 ? 255 : r) | 0];
      g = lut[(g < 0 ? 0 : g > 255 ? 255 : g) | 0];
      b = lut[(b < 0 ? 0 : b > 255 ? 255 : b) | 0];
      if (colour) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const f = sat * (1 + vib * (1 - (mx - mn) / 255));   // vibrance boosts dull colours more
        r = lum + (r - lum) * f; g = lum + (g - lum) * f; b = lum + (b - lum) * f;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;          // Uint8ClampedArray clamps automatically
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Unsharp-style 3×3 sharpen. amount 0..100. */
  function sharpen(ctx, W, H, amount) {
    if (amount <= 0) return;
    const a = (amount / 100) * 0.6, src = ctx.getImageData(0, 0, W, H), s = src.data;
    const out = ctx.createImageData(W, H), o = out.data, row = W * 4, k = 1 + 4 * a;
    o.set(s);                                        // borders stay unchanged
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * row + x * 4;
        for (let c = 0; c < 3; c++) {
          o[i + c] = s[i + c] * k - a * (s[i + c - 4] + s[i + c + 4] + s[i + c - row] + s[i + c + row]);
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  /** Darken the edges. amount 0..100. */
  function vignette(ctx, W, H, amount) {
    if (amount <= 0) return;
    const R = Math.hypot(W, H) / 2;
    const g = ctx.createRadialGradient(W / 2, H / 2, R * 0.35, W / 2, H / 2, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (amount / 100) * 0.85 + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  return { FILTERS, effective, applyColor, sharpen, vignette };
})();
