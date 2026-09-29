/**
 * state.js — the single source of truth for everything the user can change.
 *
 * The UI never keeps its own copy of values: controls read from / write to
 * CMJ.state, then ask the renderer to redraw. Because the whole state is plain
 * JSON it is trivial to snapshot for Undo/Redo (see history below).
 *
 * Structure
 *   formatId  – currently selected output format
 *   comp{}    – "composition" PER FORMAT (crop position, zoom, rotation, flips,
 *               background method). Switching format never loses the others.
 *   adj{}     – colour/effect adjustments shared by every format
 *   filter    – id of the active filter preset
 *   layers[]  – text and sticker overlays (positions are 0..1 fractions)
 *   exp{}     – export settings
 *
 * CMJ.source holds the ORIGINAL photo (decoded bitmap). It is read-only:
 * the app only ever draws from it, so the file on disk is never modified.
 */
window.CMJ = window.CMJ || {};

CMJ.source = null;   // { bitmap, w, h, name, size, colors } or null when no photo is loaded

CMJ.State = (function () {
  'use strict';

  /** All adjustment keys with their neutral value. */
  const ADJ_DEFAULT = {
    brightness: 0, contrast: 0, saturation: 0, vibrance: 0, sharpness: 0, exposure: 0,
    highlights: 0, shadows: 0, temperature: 0, tint: 0, blur: 0, vignette: 0, fade: 0
  };

  /** A fresh composition. method = smart | manual (cover) or blur | solid | gradient | mirror (contain). */
  function newComp(method) {
    return { method: method || 'smart', zoom: 1, panX: 0, panY: 0, rotation: 0,
             flipH: false, flipV: false, bgColor: '#101010', bgBlur: 60 };
  }

  function create() {
    return {
      formatId: 'portrait',
      comp: {},                              // filled by CMJ.State.initComps()
      adj: Object.assign({}, ADJ_DEFAULT),
      filter: 'original',
      layers: [],
      exp: { format: 'jpeg', quality: 92, res: 1080, name: '' },
      selectedLayer: null
    };
  }

  /** Composition of the current format (created on demand). */
  function comp(st) {
    st = st || CMJ.state;
    if (!st.comp[st.formatId]) st.comp[st.formatId] = newComp('smart');
    return st.comp[st.formatId];
  }

  /**
   * Choose a sensible default for a format: if the photo's shape is close to the
   * target, crop smartly; if it is very different (e.g. a 9:16 Story going into
   * 4:5) do NOT crop — fit it and fill the gaps with a blurred copy instead.
   */
  function autoMethod(srcW, srcH, fmt) {
    const a = srcW / srcH, b = fmt.w / fmt.h;
    return Math.max(a, b) / Math.min(a, b) < 1.15 ? 'smart' : 'blur';
  }

  /** Give every format a starting composition for the freshly loaded photo. */
  function initComps(st, src) {
    st.comp = {};
    CMJ.formats.all().forEach(f => {
      const c = newComp(autoMethod(src.w, src.h, f));
      if (c.method === 'smart') applySmart(c, f);
      st.comp[f.id] = c;
    });
  }

  /** Run the smart-crop analysis and store the resulting pan on a composition. */
  function applySmart(c, fmt) {
    if (!CMJ.source) return;
    const p = CMJ.smartcrop.findPan(CMJ.source, c, fmt.w, fmt.h);
    c.panX = p.x; c.panY = p.y; c.zoom = 1;
  }

  const snapshot = st => JSON.stringify(st);   // used by history
  return { ADJ_DEFAULT, newComp, create, comp, autoMethod, initComps, applySmart, snapshot };
})();

/** Very small undo/redo stack built on state snapshots. */
CMJ.history = (function () {
  'use strict';
  let stack = [], idx = -1;
  const LIMIT = 100;
  return {
    /** Forget everything and store the current state as the starting point. */
    reset() { stack = [CMJ.State.snapshot(CMJ.state)]; idx = 0; },
    /** Record a new state (call after a finished user action). */
    push() {
      const s = CMJ.State.snapshot(CMJ.state);
      if (s === stack[idx]) return;                 // nothing changed
      stack = stack.slice(0, idx + 1); stack.push(s);
      if (stack.length > LIMIT) stack.shift();
      idx = stack.length - 1;
    },
    canUndo: () => idx > 0,
    canRedo: () => idx < stack.length - 1,
    /** Move back/forward and return the restored state object (or null). */
    undo() { return idx > 0 ? (CMJ.state = JSON.parse(stack[--idx])) : null; },
    redo() { return idx < stack.length - 1 ? (CMJ.state = JSON.parse(stack[++idx])) : null; }
  };
})();
