/**
 * formats.js — the list of Instagram output formats.
 *
 * Each format has an id, display name, pixel size and aspect-ratio label.
 * "Story" and "Reel" share 1080×1920 but stay separate entries on purpose:
 * they are different use-cases and each remembers its own composition.
 *
 * A user-defined "custom" format can be added at runtime (Quick Presets →
 * Custom Size); it is stored in CMJ.formats.custom.
 */
window.CMJ = window.CMJ || {};

CMJ.formats = (function () {
  'use strict';

  /** Built-in presets (sizes recommended by Instagram). */
  const LIST = [
    { id: 'portrait',  name: 'Portrait',  tag: ' (Default)', w: 1080, h: 1350, ratio: '4:5'    },
    { id: 'square',    name: 'Square',    tag: '',           w: 1080, h: 1080, ratio: '1:1'    },
    { id: 'landscape', name: 'Landscape', tag: '',           w: 1080, h: 566,  ratio: '1.91:1' },
    { id: 'story',     name: 'Story',     tag: '',           w: 1080, h: 1920, ratio: '9:16'   },
    { id: 'reel',      name: 'Reel',      tag: '',           w: 1080, h: 1920, ratio: '9:16'   }
  ];

  const api = {
    list: LIST,
    /** The optional custom format (null until the user creates one). */
    custom: null,

    /** All formats including the custom one (if any). */
    all() { return api.custom ? LIST.concat([api.custom]) : LIST; },

    /** Look up a format by id. Falls back to Portrait. */
    get(id) { return api.all().find(f => f.id === id) || LIST[0]; },

    /** Create/replace the custom format from a width and height in pixels. */
    setCustom(w, h) {
      w = Math.max(100, Math.min(4096, Math.round(w)));
      h = Math.max(100, Math.min(4096, Math.round(h)));
      const g = (a, b) => (b ? g(b, a % b) : a);          // greatest common divisor
      const d = g(w, h);
      api.custom = { id: 'custom', name: 'Custom', tag: '', w, h, ratio: (w / d) + ':' + (h / d) };
      return api.custom;
    }
  };
  return api;
})();
