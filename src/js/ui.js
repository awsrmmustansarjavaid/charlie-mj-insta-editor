/**
 * ui.js — connects the HTML controls to the state and the renderer.
 *
 * Rule of thumb used everywhere in this file:
 *     user action  →  change CMJ.state  →  requestRender()  →  syncControls()
 * "commit()" is called when an action is FINISHED (mouse released, button
 * clicked) so that Undo/Redo gets one entry per action, not one per pixel moved.
 *
 * Sections: helpers · sliders · format/thumbnail lists · rendering ·
 * photo loading · canvas interaction · toolbar/rail/tabs · layers · export · init
 */
window.CMJ = window.CMJ || {};

CMJ.ui = (function () {
  'use strict';

  /* ================= helpers ================= */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const st = () => CMJ.state;
  const comp = () => CMJ.State.comp();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PREVIEW_MAX = 900;                       // longest side (px) of the live preview bitmap
  const STICKERS = ['😀', '😍', '🔥', '✨', '❤️', '⭐', '🎉', '📍', '🌈', '👍', '💯', '🌸'];

  let view = 'editor', before = false, rafId = 0, thumbTimer = 0, filterTimer = 0;
  let lastInfo = null, outBytes = null, drag = null, zoomCommit = 0;

  /** Small message at the bottom of the window. */
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  /* ================= sliders ================= */
  // scope 'adj' = colour adjustment shared by all formats; 'comp' = per-format position.
  // scale converts the stored value to the number shown (e.g. zoom 1.0 → 100 %).
  const SLIDERS = [
    { key: 'brightness', label: 'Brightness',  ico: '☼', min: -100, max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'contrast',   label: 'Contrast',    ico: '◐', min: -100, max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'saturation', label: 'Saturation',  ico: '💧', min: -100, max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'vibrance',   label: 'Vibrance',    ico: '△', min: -100, max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'sharpness',  label: 'Sharpness',   ico: '▲', min: 0,    max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'exposure',   label: 'Exposure',    ico: '◑', min: -100, max: 100, def: 0, scope: 'adj', host: 'edit' },
    { key: 'highlights', label: 'Highlights',  ico: '◌', min: -100, max: 100, def: 0, scope: 'adj', host: 'adjust' },
    { key: 'shadows',    label: 'Shadows',     ico: '●', min: -100, max: 100, def: 0, scope: 'adj', host: 'adjust' },
    { key: 'temperature',label: 'Temperature', ico: '🌡', min: -100, max: 100, def: 0, scope: 'adj', host: 'adjust' },
    { key: 'tint',       label: 'Tint',        ico: '◍', min: -100, max: 100, def: 0, scope: 'adj', host: 'adjust' },
    { key: 'zoom',       label: 'Zoom %',      ico: '🔍', min: 25,  max: 400, def: 100, scope: 'comp', scale: 100, host: 'adjust' },
    { key: 'rotation',   label: 'Straighten',  ico: '↻', min: -180, max: 180, def: 0, scope: 'comp', scale: 1, host: 'adjust' },
    { key: 'panX',       label: 'Position X',  ico: '↔', min: -100, max: 100, def: 0, scope: 'comp', scale: 100, host: 'adjust' },
    { key: 'panY',       label: 'Position Y',  ico: '↕', min: -100, max: 100, def: 0, scope: 'comp', scale: 100, host: 'adjust' },
    { key: 'blur',       label: 'Blur',        ico: '◎', min: 0,    max: 100, def: 0, scope: 'adj', host: 'effects' },
    { key: 'vignette',   label: 'Vignette',    ico: '◉', min: 0,    max: 100, def: 0, scope: 'adj', host: 'effects' },
    { key: 'fade',       label: 'Fade',        ico: '◔', min: 0,    max: 100, def: 0, scope: 'adj', host: 'effects' }
  ];
  const getVal = s => s.scope === 'adj' ? st().adj[s.key] : comp()[s.key] * s.scale;
  const setVal = (s, v) => { if (s.scope === 'adj') st().adj[s.key] = v; else comp()[s.key] = v / s.scale; };

  /** Update one slider's position, fill colour and number box from the state. */
  function paintSlider(s) {
    const v = clamp(Math.round(getVal(s)), s.min, s.max);
    s.inp.value = v; s.inp.style.setProperty('--p', ((v - s.min) / (s.max - s.min) * 100) + '%');
    s.val.textContent = s.key === 'zoom' ? v + '%' : s.key === 'rotation' ? v + '°' : (v > 0 && s.min < 0 ? '+' : '') + v;
  }
  function buildSliders() {
    SLIDERS.forEach(s => {
      const el = document.createElement('div'); el.className = 'sl';
      el.innerHTML = '<span class="i">' + s.ico + '</span><span class="n">' + s.label + '</span><input type="range" min="' + s.min + '" max="' + s.max + '"><span class="v"></span>';
      s.inp = el.querySelector('input'); s.val = el.querySelector('.v');
      s.inp.addEventListener('input', () => { setVal(s, +s.inp.value); paintSlider(s); requestRender(); });
      s.inp.addEventListener('change', commit);
      s.inp.addEventListener('dblclick', () => { setVal(s, s.def); paintSlider(s); requestRender(); commit(); });   // double-click = reset
      $('#host-' + s.host).appendChild(el);
    });
  }

  /* ================= lists: formats, thumbnails, filters, layers ================= */
  function buildFormatLists() {
    const fs = CMJ.formats.all();
    $('#formatList').innerHTML = fs.map(f => {
      const k = 30 / Math.max(f.w, f.h), w = Math.max(14, Math.round(f.w * k)), h = Math.max(14, Math.round(f.h * k));
      return '<div class="opt" data-id="' + f.id + '"><div class="rd"></div><div class="ic"><i style="width:' + w + 'px;height:' + h + 'px"></i></div>' +
             '<p>' + f.name + f.tag + '<br><span>' + f.ratio + ' &nbsp;|&nbsp; ' + f.w + ' × ' + f.h + ' px</span></p></div>';
    }).join('');
    $$('#formatList .opt').forEach(o => o.addEventListener('click', () => selectFormat(o.dataset.id)));

    $('#thumbs').innerHTML = fs.map(f => '<div class="t" data-id="' + f.id + '"><div class="m"><canvas></canvas></div>' +
      (f.id === 'story' || f.id === 'reel' ? f.name + ' ' : '') + f.ratio + '<br>' + f.w + ' × ' + f.h + '</div>').join('');
    $$('#thumbs .t').forEach(t => t.addEventListener('click', () => selectFormat(t.dataset.id)));

    $('#ratioSel').innerHTML = fs.map(f => '<option value="' + f.id + '">' + f.ratio + ' (' + f.w + ' × ' + f.h + ') — ' + f.name + '</option>').join('');
  }

  function buildFilterGrid() {
    $('#filterGrid').innerHTML = CMJ.adjust.FILTERS.map(f => '<div class="fl" data-id="' + f.id + '"><canvas></canvas>' + f.name + '</div>').join('');
    $$('#filterGrid .fl').forEach(el => el.addEventListener('click', () => {
      st().filter = el.dataset.id; commit(); syncControls(); requestRender();
    }));
  }

  /** Render every format thumbnail with ITS OWN composition (live multi-format preview). */
  function renderThumbs() {
    if (!CMJ.source) return;
    CMJ.formats.all().forEach(f => {
      const cv = $('#thumbs .t[data-id="' + f.id + '"] canvas'); if (!cv) return;
      const k = Math.min(58 / f.h, 74 / f.w);
      CMJ.render.frame(cv, Math.max(8, Math.round(f.w * k)), Math.max(8, Math.round(f.h * k)), Object.assign({}, st(), { formatId: f.id }), {});
    });
  }
  function renderFilterThumbs() {
    if (!CMJ.source) return;
    const f = CMJ.formats.get(st().formatId), W = 86, H = clamp(Math.round(86 * f.h / f.w), 50, 110);
    $$('#filterGrid .fl').forEach(el => {
      CMJ.render.frame(el.querySelector('canvas'), W, H, Object.assign({}, st(), { filter: el.dataset.id, layers: [] }), {});
    });
  }
  function renderLayerList() {
    const L = st().layers, box = $('#layerList');
    box.innerHTML = L.length ? '' : '<span class="mu small">No text or stickers yet</span>';
    L.forEach(l => {
      const d = document.createElement('div'); d.className = 'ly' + (l.id === st().selectedLayer ? ' on' : '');
      d.innerHTML = '<span></span><b style="cursor:pointer">✕</b>'; d.firstChild.textContent = l.text;
      d.addEventListener('click', () => { st().selectedLayer = l.id; renderLayerList(); });
      d.lastChild.addEventListener('click', e => { e.stopPropagation(); removeLayer(l.id); });
      box.appendChild(d);
    });
  }

  /* ================= rendering & syncing ================= */
  function requestRender() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; doRender(); }); }
  const previewSize = () => { const f = CMJ.formats.get(st().formatId), k = Math.min(1, PREVIEW_MAX / Math.max(f.w, f.h)); return { W: Math.round(f.w * k), H: Math.round(f.h * k) }; };

  function doRender() {
    const has = !!CMJ.source;
    $('#empty').classList.toggle('hidden', has);
    if (!has) { updateButtons(); return; }
    const { W, H } = previewSize(), main = $('#mainCanvas');
    lastInfo = CMJ.render.frame(main, W, H, st(), { before: before, record: true });
    layoutCanvas(); syncMirrors(); syncSliders(); updateZoomSel(); updateStatus(); updateButtons();
    $('#fmtBadge').textContent = CMJ.formats.get(st().formatId).ratio + ' (' + CMJ.formats.get(st().formatId).w + ' × ' + CMJ.formats.get(st().formatId).h + ')' + (before ? ' · BEFORE' : '');
    clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 120);
    if (!$('#tab-filters').classList.contains('hidden')) { clearTimeout(filterTimer); filterTimer = setTimeout(renderFilterThumbs, 250); }
    CMJ.exporter.estimate(out => { outBytes = out.blob.size; updateStatus(); });
  }

  /** Size the on-screen canvas to the largest box with the right aspect ratio that fits. */
  function layoutCanvas() {
    const wrap = $('#cvwrap'), box = $('#cvbox'), main = $('#mainCanvas');
    const aw = wrap.clientWidth - 8, ah = wrap.clientHeight - 8; if (aw <= 0 || ah <= 0) return;
    const r = main.width / main.height, w = Math.min(aw, ah * r);
    box.style.width = Math.floor(w) + 'px'; box.style.height = Math.floor(w / r) + 'px';
  }

  /** Copy the preview into the Instagram mock-ups (mini card, big card, feed, profile grid). */
  function syncMirrors() {
    const main = $('#mainCanvas');
    ['pipCanvas', 'igCanvas', 'feedCanvas', 'gridCanvas'].forEach(id => {
      const c = document.getElementById(id); if (!c) return;
      if (c.width !== main.width) c.width = main.width; if (c.height !== main.height) c.height = main.height;
      c.getContext('2d').drawImage(main, 0, 0);
    });
  }

  function syncSliders() { SLIDERS.forEach(paintSlider); }
  function updateZoomSel() {
    const sel = $('#zoomSel'), pct = Math.round(comp().zoom * 100);
    if ($$('#zoomSel option[value="' + pct + '"]').length) sel.value = pct;
    else { const o = sel.querySelector('option[value="x"]'); o.textContent = pct + '%'; sel.value = 'x'; }
  }
  function updateButtons() {
    $('#undoBtn').disabled = !CMJ.history.canUndo(); $('#redoBtn').disabled = !CMJ.history.canRedo();
  }
  function updateStatus() {
    if (!CMJ.source) { $('#statusBar').innerHTML = '<span>Open a photo to begin</span>'; return; }
    const e = st().exp, up = lastInfo ? lastInfo.s / lastInfo.W * e.res : 0, ok = up <= 1.0001, o = CMJ.source.size;
    $('#statusBar').innerHTML =
      '<span class="' + (ok ? 'ok' : 'warn') + '">' + (ok ? '✔ Ready to post' : '⚠ Photo enlarged ' + Math.round(up * 100) + '% — may look soft') + '</span>' +
      '<span>Original <b>' + fmtSize(o) + '</b></span>' +
      '<span>Output <b>' + (outBytes ? fmtSize(outBytes) : '…') + '</b>' + (outBytes && outBytes < o ? ' · <b>' + Math.round((1 - outBytes / o) * 100) + '% smaller</b>' : '') + '</span>' +
      '<span>sRGB ✔</span><span style="margin-left:auto">Original file untouched 🔒</span>';
  }

  /** Push the whole state into every control (after load, undo, format switch…). */
  function syncControls() {
    const s = st(), c = comp();
    $$('#formatList .opt').forEach(o => o.classList.toggle('sel', o.dataset.id === s.formatId));
    $$('#thumbs .t').forEach(o => o.classList.toggle('sel', o.dataset.id === s.formatId));
    $('#ratioSel').value = s.formatId;
    $$('#methodBtns .btn').forEach(b => b.classList.toggle('on', b.dataset.method === c.method));
    $$('#bgOptions .row').forEach(r => r.classList.toggle('hidden', r.dataset.for !== c.method));
    $('#bgBlur').value = c.bgBlur; $('#bgBlur').style.setProperty('--p', c.bgBlur + '%'); $('#bgColor').value = c.bgColor;
    $$('#filterGrid .fl').forEach(f => f.classList.toggle('on', f.dataset.id === s.filter));
    $$('#fmtChips .chip').forEach(ch => ch.classList.toggle('on', ch.dataset.f === s.exp.format));
    $('#qualityRange').value = s.exp.quality; $('#qualityVal').textContent = s.exp.quality;
    $('#qualityRange').style.setProperty('--p', ((s.exp.quality - 50) * 2) + '%'); $('#qualityRange').disabled = s.exp.format === 'png';
    $('#resSel').value = s.exp.res; $('#nameInput').value = s.exp.name;
    syncSliders(); renderLayerList();
  }

  /** Called after a finished action: one undo step + refresh derived UI. */
  function commit() {
    CMJ.history.push(); updateButtons();
    if (!$('#tab-filters').classList.contains('hidden')) { clearTimeout(filterTimer); filterTimer = setTimeout(renderFilterThumbs, 250); }
  }

  /* ================= photo loading ================= */
  async function loadFile(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) { toast('That file is not an image'); return; }
    try { setSource(await createImageBitmap(file), file.name, file.size); }
    catch (e) { toast('Could not open this image (unsupported format?)'); }
  }
  function loadSample() {
    const img = new Image();
    img.onload = async () => setSource(await createImageBitmap(img), 'sample-lake.jpg', Math.round(CMJ.sampleDataUri.length * 0.75));
    img.src = CMJ.sampleDataUri;
  }
  /** Install a decoded photo as the working source. The file itself is never written to. */
  function setSource(bmp, name, size) {
    const old = st();
    CMJ.source = { bitmap: bmp, w: bmp.width, h: bmp.height, name: name, size: size, colors: CMJ.render.sampleColors(bmp) };
    const s = CMJ.State.create(); s.exp = old.exp; s.formatId = old.formatId;
    CMJ.state = s; CMJ.State.initComps(s, CMJ.source); CMJ.history.reset(); outBytes = null;
    const t = $('#fileThumb').getContext('2d'), k = Math.max(48 / bmp.width, 38 / bmp.height);
    t.clearRect(0, 0, 48, 38); t.drawImage(bmp, (48 - bmp.width * k) / 2, (38 - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    $('#fileName').textContent = name; $('#fileDims').textContent = bmp.width + ' × ' + bmp.height + ' (Original)';
    $('#fileChip').classList.remove('hidden');
    syncControls(); requestRender();
    toast('Loaded ' + bmp.width + ' × ' + bmp.height + ' — ' + (CMJ.State.comp().method === 'blur' ? 'fitted with blurred background (no cropping)' : 'smart-cropped'));
  }
  function clearPhoto() { CMJ.source = null; $('#fileChip').classList.add('hidden'); requestRender(); }

  /* ================= actions ================= */
  function selectFormat(id) {
    st().formatId = id; comp();                 // comp() creates the composition if needed
    syncControls(); requestRender(); commit();
    if (!$('#tab-filters').classList.contains('hidden')) renderFilterThumbs();
  }
  /** Story→Post fit methods. Smart crop analyses the picture; the others pad instead of cropping. */
  function applyMethod(m) {
    const c = comp(), f = CMJ.formats.get(st().formatId);
    c.method = m; c.zoom = 1; c.panX = c.panY = 0;
    if (m === 'smart') CMJ.State.applySmart(c, f);
    syncControls(); requestRender(); commit();
  }
  function rotateBy(d) {
    const c = comp(); c.rotation = ((c.rotation + d + 180) % 360 + 360) % 360 - 180;
    if (c.method === 'smart') CMJ.State.applySmart(c, CMJ.formats.get(st().formatId)); else { c.panX = c.panY = 0; }
    syncControls(); requestRender(); commit();
  }
  function flip(axis) {
    const c = comp(); c[axis] = !c[axis];
    if (c.method === 'smart') CMJ.State.applySmart(c, CMJ.formats.get(st().formatId));
    requestRender(); commit();
  }
  function setZoom(z, done) { comp().zoom = clamp(z, 0.25, 6); requestRender(); if (done) commit(); }
  function fit() { applyMethod(comp().method); }
  function resetFormat() {
    const f = CMJ.formats.get(st().formatId), c = CMJ.State.newComp(CMJ.State.autoMethod(CMJ.source.w, CMJ.source.h, f));
    if (c.method === 'smart') CMJ.State.applySmart(c, f);
    st().comp[f.id] = c; syncControls(); requestRender(); commit();
  }
  function undoRedo(dir) {
    const keep = st().exp, s = dir < 0 ? CMJ.history.undo() : CMJ.history.redo();   // export settings are not part of history
    if (s) { s.exp = keep; syncControls(); requestRender(); }
  }
  function resetAll() {
    if (!CMJ.source) return;
    const old = st(), s = CMJ.State.create(); s.exp = old.exp; s.formatId = old.formatId;
    CMJ.state = s; CMJ.State.initComps(s, CMJ.source); CMJ.history.reset(); syncControls(); requestRender(); toast('Everything reset');
  }

  /* ---- text & sticker layers ---- */
  const newId = () => 'l' + Math.random().toString(36).slice(2, 8);
  function addLayer(text, size, bold) {
    if (!CMJ.source) { toast('Open a photo first'); return; }
    const l = { id: newId(), text: text, x: 0.5, y: 0.5, size: size, color: $('#textColor').value, bold: bold };
    st().layers.push(l); st().selectedLayer = l.id; renderLayerList(); requestRender(); commit();
  }
  function removeLayer(id) { st().layers = st().layers.filter(l => l.id !== id); renderLayerList(); requestRender(); commit(); }
  function editSelected(props) {
    const l = st().layers.find(x => x.id === st().selectedLayer); if (!l) return;
    Object.assign(l, props); requestRender();
  }

  /* ---- export ---- */
  async function doExport() {
    if (!CMJ.source) { toast('Open a photo first'); return; }
    toast('Exporting…');
    const r = await CMJ.exporter.save();
    if (r) toast('Saved ' + r.W + ' × ' + r.H + ' · ' + fmtSize(r.size));
  }

  /* ================= canvas interaction ================= */
  function bindCanvas() {
    const box = $('#cvbox');
    box.addEventListener('pointerdown', e => {
      if (!CMJ.source || e.target.classList.contains('hdl')) return;
      const r = box.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      const hit = CMJ.render.hitBoxes.slice().reverse().find(b => nx >= b.x0 && nx <= b.x1 && ny >= b.y0 && ny <= b.y1);
      drag = { layer: hit ? st().layers.find(l => l.id === hit.id) : null, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      if (drag.layer) { st().selectedLayer = drag.layer.id; renderLayerList(); }
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) / drag.w, dy = (e.clientY - drag.y) / drag.h;    // movement as a fraction of the frame
      if (drag.layer) { drag.layer.x += dx; drag.layer.y += dy; } else { comp().panX += dx; comp().panY += dy; }
      drag.x = e.clientX; drag.y = e.clientY; requestRender();
    });
    const end = () => { if (drag) { drag = null; commit(); } };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

    box.addEventListener('wheel', e => {                     // wheel = zoom
      if (!CMJ.source) return; e.preventDefault();
      setZoom(comp().zoom * Math.pow(1.0015, -e.deltaY), false);
      clearTimeout(zoomCommit); zoomCommit = setTimeout(commit, 350);
    }, { passive: false });

    $$('.hdl').forEach(h => {                                // corner handles: dragging inward crops tighter (= zoom in)
      let hd = null;
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); const r = box.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        hd = { cx: cx, cy: cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy), z0: comp().zoom }; h.setPointerCapture(e.pointerId);
      });
      h.addEventListener('pointermove', e => { if (hd) setZoom(hd.z0 * hd.d0 / Math.max(10, Math.hypot(e.clientX - hd.cx, e.clientY - hd.cy)), false); });
      h.addEventListener('pointerup', () => { if (hd) { hd = null; commit(); } });
    });
  }

  /* ================= toolbar / rail / tabs / panels ================= */
  function showTab(name) {
    $$('#tabs div').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    $$('.tabbody').forEach(b => b.classList.toggle('hidden', b.id !== 'tab-' + name));
    if (name === 'filters') renderFilterThumbs();
  }
  function showView(v) {
    view = v;
    $$('#viewTabs span').forEach(s => s.classList.toggle('on', s.dataset.view === v));
    ['editor', 'ig', 'feed', 'grid'].forEach(n => $('#stage-' + n).classList.toggle('hidden', n !== v));
    requestRender();
  }
  /** Profile grid: 8 placeholder tiles + the live post in the middle. */
  function buildGrid() {
    const g = $('#pgrid'); g.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      if (i === 4) { const c = document.createElement('canvas'); c.id = 'gridCanvas'; c.className = 'new'; g.appendChild(c); }
      else g.appendChild(document.createElement('div'));
    }
  }
  function railClick(tool) {
    const cvbox = $('#cvbox');
    if (tool === 'rotate') return rotateBy(90);
    if (tool === 'flip') return flip('flipH');
    if (tool === 'more') return $('#dlgMore').showModal();
    $$('#rail div').forEach(d => d.classList.toggle('on', d.dataset.tool === tool));
    const crop = tool === 'crop';
    cvbox.classList.toggle('show-handles', crop); if (crop) cvbox.classList.add('show-thirds');
    $$('#overlayChips .chip[data-g="thirds"]').forEach(c => c.classList.toggle('on', cvbox.classList.contains('show-thirds')));
    if (tool === 'resize') { showTab('edit'); $('#fitSec').scrollIntoView({ behavior: 'smooth' }); }
    if (tool === 'adjust') showTab('adjust');
    if (tool === 'filters') showTab('filters');
    if (tool === 'text') { showTab('effects'); $('#textInput').focus(); }
    if (tool === 'stickers') { showTab('effects'); $('#stickerSec').scrollIntoView({ behavior: 'smooth' }); }
  }

  /* ================= wiring ================= */
  function bindAll() {
    // photo input: click, file picker, drag & drop, paste
    const pick = () => $('#fileInput').click();
    $('#dropBtn').addEventListener('click', pick); $('#emptyBox').addEventListener('click', pick);
    $('#sampleBtn').addEventListener('click', e => { e.stopPropagation(); loadSample(); });
    $('#fileInput').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
    $('#fileClear').addEventListener('click', clearPhoto);
    window.addEventListener('dragover', e => { e.preventDefault(); $('#dropBtn').classList.add('over'); $('#emptyBox').classList.add('over'); });
    window.addEventListener('dragleave', () => { $('#dropBtn').classList.remove('over'); $('#emptyBox').classList.remove('over'); });
    window.addEventListener('drop', e => { e.preventDefault(); $('#dropBtn').classList.remove('over'); $('#emptyBox').classList.remove('over'); loadFile(e.dataTransfer.files[0]); });
    window.addEventListener('paste', e => { const it = Array.from(e.clipboardData.items).find(i => i.type.indexOf('image') === 0); if (it) loadFile(it.getAsFile()); });

    // toolbar
    $('#zoomSel').innerHTML = [25, 50, 75, 100, 125, 150, 200, 300, 400].map(v => '<option value="' + v + '">' + v + '%</option>').join('') + '<option value="x" hidden>100%</option>';
    $('#zoomSel').addEventListener('change', e => { if (CMJ.source && e.target.value !== 'x') setZoom(e.target.value / 100, true); });
    $('#zoomIn').addEventListener('click', () => CMJ.source && setZoom(comp().zoom * 1.1, true));
    $('#zoomOut').addEventListener('click', () => CMJ.source && setZoom(comp().zoom / 1.1, true));
    $('#undoBtn').addEventListener('click', () => undoRedo(-1)); $('#redoBtn').addEventListener('click', () => undoRedo(1));
    $('#fitBtn').addEventListener('click', () => CMJ.source && fit()); $('#resetBtn').addEventListener('click', () => CMJ.source && resetFormat());
    const bb = $('#beforeBtn');                                   // hold to compare with the untouched photo
    bb.addEventListener('pointerdown', () => { before = true; requestRender(); });
    ['pointerup', 'pointerleave'].forEach(ev => bb.addEventListener(ev, () => { if (before) { before = false; requestRender(); } }));
    $('#fullBtn').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

    // views, rail, tabs, overlay chips
    $$('#viewTabs span').forEach(s => s.addEventListener('click', () => showView(s.dataset.view)));
    $$('#rail div').forEach(d => d.addEventListener('click', () => railClick(d.dataset.tool)));
    $$('#tabs div').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    $$('#overlayChips .chip').forEach(c => c.addEventListener('click', () => {
      c.classList.toggle('on'); $('#cvbox').classList.toggle('show-' + c.dataset.g, c.classList.contains('on'));
    }));

    // Story→Post methods + background options
    $$('#methodBtns .btn').forEach(b => b.addEventListener('click', () => CMJ.source && applyMethod(b.dataset.method)));
    $('#bgBlur').addEventListener('input', e => { comp().bgBlur = +e.target.value; e.target.style.setProperty('--p', e.target.value + '%'); requestRender(); });
    $('#bgBlur').addEventListener('change', commit);
    $('#bgColor').addEventListener('input', e => { comp().bgColor = e.target.value; requestRender(); });
    $('#bgColor').addEventListener('change', commit);

    // rotate / flip / ratio
    $('#rotL').addEventListener('click', () => CMJ.source && rotateBy(-90)); $('#rotR').addEventListener('click', () => CMJ.source && rotateBy(90));
    $('#rot180').addEventListener('click', () => CMJ.source && rotateBy(180));
    $('#flipH').addEventListener('click', () => CMJ.source && flip('flipH')); $('#flipV').addEventListener('click', () => CMJ.source && flip('flipV'));
    $('#ratioSel').addEventListener('change', e => selectFormat(e.target.value));

    // quick presets + custom size dialog
    $('#qpInsta').addEventListener('click', () => {
      if (!CMJ.source) return toast('Open a photo first');
      st().exp = { format: 'jpeg', quality: 92, res: 1080, name: '' }; st().formatId = 'portrait'; resetFormat(); toast('Instagram Ready: Portrait 4:5 · JPEG 92 · 1080 px');
    });
    $('#qpHigh').addEventListener('click', () => { st().exp = { format: 'jpeg', quality: 98, res: 1440, name: '' }; syncControls(); requestRender(); toast('High Quality: JPEG 98 · 1440 px'); });
    $('#qpCustom').addEventListener('click', () => $('#dlgCustom').showModal());
    $('#dlgCustom').addEventListener('close', e => {
      if (e.target.returnValue !== 'ok') return;
      const f = CMJ.formats.setCustom(+$('#cW').value, +$('#cH').value);
      buildFormatLists();
      if (CMJ.source) { const c = CMJ.State.newComp(CMJ.State.autoMethod(CMJ.source.w, CMJ.source.h, f)); if (c.method === 'smart') CMJ.State.applySmart(c, f); st().comp.custom = c; }
      selectFormat('custom');
    });

    // export settings
    $$('#fmtChips .chip').forEach(c => c.addEventListener('click', () => { st().exp.format = c.dataset.f; syncControls(); requestRender(); }));
    $('#qualityRange').addEventListener('input', e => { st().exp.quality = +e.target.value; syncControls(); requestRender(); });
    $('#resSel').addEventListener('change', e => { st().exp.res = +e.target.value; requestRender(); });
    $('#nameInput').addEventListener('input', e => { st().exp.name = e.target.value; });
    $('#exportBtn').addEventListener('click', doExport);
    $('#openBtn').addEventListener('click', async () => {
      if (window.charlie) { if (!(await window.charlie.revealLastExport())) toast('Export an image first'); }
      else toast('Browser mode — the file is in your Downloads folder');
    });
    $('#resetAll').addEventListener('click', resetAll);
    $('#applyBtn').addEventListener('click', () => { $('#cvbox').classList.remove('show-handles'); $$('#rail div').forEach(d => d.classList.remove('on')); commit(); toast('Applied'); });

    // text & stickers
    $('#addText').addEventListener('click', () => addLayer($('#textInput').value.trim() || 'Your text', +$('#textSize').value / 100, $('#textBold').checked));
    $('#textColor').addEventListener('input', e => editSelected({ color: e.target.value }));
    $('#textSize').addEventListener('input', e => editSelected({ size: +e.target.value / 100 }));
    $('#textBold').addEventListener('change', e => editSelected({ bold: e.target.checked }));
    $('#stickerRow').innerHTML = STICKERS.map(s => '<span>' + s + '</span>').join('');
    $$('#stickerRow span').forEach(s => s.addEventListener('click', () => addLayer(s.textContent, 0.12, false)));

    // keyboard shortcuts
    window.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range';
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 'z') { e.preventDefault(); undoRedo(e.shiftKey ? 1 : -1); }
      else if (ctrl && k === 'y') { e.preventDefault(); undoRedo(1); }
      else if (ctrl && k === 'o') { e.preventDefault(); $('#fileInput').click(); }
      else if (ctrl && k === 'e') { e.preventDefault(); doExport(); }
      else if (!typing && !ctrl && CMJ.source) {
        if (k === 'f') fit();
        else if (k === '+' || k === '=') setZoom(comp().zoom * 1.1, true);
        else if (k === '-') setZoom(comp().zoom / 1.1, true);
        else if ((k === 'delete' || k === 'backspace') && st().selectedLayer) removeLayer(st().selectedLayer);
      }
    });
    new ResizeObserver(layoutCanvas).observe($('#cvwrap'));
  }

  /* ================= public API ================= */
  function init() {
    buildSliders(); buildFormatLists(); buildFilterGrid(); buildGrid(); bindAll(); bindCanvas();
    CMJ.history.reset(); syncControls(); updateStatus(); updateButtons(); doRender();
  }
  return { init, loadFile, loadSample, toast };
})();
