// Vice Coast Cover Studio — wires the editor: photos, panels, layout,
// grade, caption, per-panel colour adjust, export and undo/redo. The
// preview canvas and the exported PNG are both painted by drawCover() in
// ./cover.js, so what you see is what you get.
//
// Keyboard: 1–7 switches layout, [ and ] cycle layouts, Ctrl+Z undoes,
// Ctrl+Shift+Z / Ctrl+Y redoes. Shortcuts never fire while you type in a
// text field. The editor also works at narrow widths (see style.css).
import { drawCover, layoutPanels, titleBand, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const PREVIEW_MAX = 720; // preview canvas long side, in pixels
const LAYOUT_KEYS = Object.keys(LAYOUTS);

/** A fresh panel: which photo it shows, its zoom, pan and colour adjust. */
function freshPanel(photo = 0) {
  return { photo, zoom: 1, ox: 0, oy: 0, bright: 1, contrast: 1, sat: 1 };
}

/** Fills in any missing panel field (older snapshots, shot patches). */
function normalizePanel(p, fallbackPhoto = 0) {
  return {
    photo: p?.photo ?? fallbackPhoto,
    zoom: p?.zoom ?? 1,
    ox: p?.ox ?? 0,
    oy: p?.oy ?? 0,
    bright: p?.bright ?? 1,
    contrast: p?.contrast ?? 1,
    sat: p?.sat ?? 1,
  };
}

const state = {
  layout: 'quad',
  grade: 'sunset',
  title: 'Neon Coast',
  subtitle: 'a vice coast story',
  stars: 4,
  grain: true,
  size: 'portrait',
  photos: [null, null, null, null], // Image elements, or null
  photoNames: ['', '', '', ''],
  panels: [freshPanel(0), freshPanel(0), freshPanel(0), freshPanel(0)],
  selected: 0,
};

// --- history (undo / redo) -------------------------------------------------

const history = [];
let historyIndex = -1;

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    stars: state.stars,
    grain: state.grain,
    size: state.size,
    panels: state.panels,
    selected: state.selected,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.panels = state.panels.map((p) => normalizePanel(p));
  syncControls();
  redraw();
}

function pushHistory() {
  history.length = historyIndex + 1;
  history.push(snapshot());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = true;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restore(history[historyIndex]);
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = false;
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restore(history[historyIndex]);
  $('undo').disabled = false;
  $('redo').disabled = historyIndex >= history.length - 1;
}

// --- rendering ---------------------------------------------------------------

function previewSize() {
  const size = SIZES[state.size];
  const scale = PREVIEW_MAX / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  // The pink selection outline is editor chrome: never draw it on the
  // full-frame cover scene used for screenshots.
  if (!document.body.classList.contains('shot-cover')) drawSelection();
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
}

/** Draws the pink selection outline around the selected panel. */
function drawSelection() {
  const { w, h } = previewSize();
  const rects = layoutPanels(state.layout, w, h);
  const frac = rects[state.selected];
  if (!frac) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(frac.x * w + 2, frac.y * h + 2, frac.w * w - 4, frac.h * h - 4);
  ctx.restore();
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function refitPanels() {
  const n = panelCount();
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push(state.panels[i] ? normalizePanel(state.panels[i]) : freshPanel(i % filledPhotoCount()));
  }
  state.panels = next;
  state.selected = Math.min(state.selected, n - 1);
}

function filledPhotoCount() {
  return Math.max(1, state.photos.filter(Boolean).length);
}

/** Switches to a layout by key, refitting panels and recording history. */
function pickLayout(key) {
  if (!LAYOUTS[key] || key === state.layout) return;
  state.layout = key;
  refitPanels();
  pushHistory();
  syncControls();
  redraw();
}

/** Steps the layout forward (+1) or back (-1) through the picker order. */
function cycleLayout(dir) {
  const i = LAYOUT_KEYS.indexOf(state.layout);
  const next = LAYOUT_KEYS[(i + dir + LAYOUT_KEYS.length) % LAYOUT_KEYS.length];
  pickLayout(next);
}

// --- photos ------------------------------------------------------------------

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function setPhotoSlot(slot, file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos[slot] = img;
  state.photoNames[slot] = file.name;
  // Panels pointing at an empty slot take the new photo; empty panels fill in.
  state.panels.forEach((p) => {
    if (p.photo < 0) p.photo = slot;
  });
  renderPhotoSlots();
  redraw();
}

function renderPhotoSlots() {
  const wrap = $('photoSlots');
  wrap.innerHTML = '';
  state.photos.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (img ? ' filled' : '');
    slot.title = img ? state.photoNames[i] : `Photo ${i + 1}: click to add`;
    if (img) {
      const thumb = document.createElement('canvas');
      thumb.width = 96;
      thumb.height = 72;
      const tctx = thumb.getContext('2d');
      const scale = Math.max(96 / img.naturalWidth, 72 / img.naturalHeight);
      const pw = img.naturalWidth * scale;
      const ph = img.naturalHeight * scale;
      tctx.drawImage(img, (96 - pw) / 2, (72 - ph) / 2, pw, ph);
      slot.appendChild(thumb);
      const label = document.createElement('span');
      label.textContent = `Photo ${i + 1}`;
      slot.appendChild(label);
    } else {
      slot.textContent = `+ Photo ${i + 1}`;
    }
    slot.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        if (input.files[0]) setPhotoSlot(i, input.files[0]);
      };
      input.click();
    });
    wrap.appendChild(slot);
  });
}

/** Loads a bundled sample photo into slot 0 and fills every panel with it. */
async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos[0] = img;
  state.photoNames[0] = `${name}.jpg (sample)`;
  state.panels.forEach((p) => {
    p.photo = 0;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.bright = 1;
    p.contrast = 1;
    p.sat = 1;
  });
  renderPhotoSlots();
  pushHistory();
  redraw();
  statusEl.textContent = `Loaded sample photo ${name}.jpg — drag a panel to reposition it.`;
}

// --- export ------------------------------------------------------------------

/** Renders the cover at full export size and returns a PNG blob. */
async function renderExportBlob(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  await document.fonts.ready;
  drawCover(off, state);
  return new Promise((resolve) => off.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportOne(sizeKey) {
  const size = SIZES[sizeKey];
  statusEl.textContent = `Rendering ${size.name}…`;
  const blob = await renderExportBlob(sizeKey);
  const slug = (state.title || 'cover').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  downloadBlob(blob, `${slug}-${size.w}x${size.h}.png`);
  statusEl.textContent = `Saved ${slug}-${size.w}x${size.h}.png`;
}

async function exportAll() {
  const keys = Object.keys(SIZES);
  for (const key of keys) {
    await exportOne(key);
    await new Promise((r) => setTimeout(r, 350));
  }
  statusEl.textContent = `Saved all ${keys.length} sizes — square, portrait, wide and story.`;
}

// --- controls ----------------------------------------------------------------

function buildButtons(container, entries, current, onPick) {
  const el = $(container);
  el.innerHTML = '';
  Object.entries(entries).forEach(([key, value]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (key === current ? ' active' : '');
    b.textContent = value.name ?? value;
    if (value.swatch) {
      b.style.background = `linear-gradient(135deg, ${value.swatch[0]} 0%, ${value.swatch[1]} 50%, ${value.swatch[2]} 100%)`;
    }
    b.addEventListener('click', () => {
      onPick(key);
      buildButtons(container, entries, key, onPick);
    });
    el.appendChild(b);
  });
}

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('grainToggle').checked = state.grain;
  buildButtons('layoutRow', LAYOUTS, state.layout, pickLayout);
  buildButtons('gradeRow', GRADES, state.grade, (key) => {
    state.grade = key;
    pushHistory();
    redraw();
  });
  buildButtons('sizeRow', SIZES, state.size, (key) => {
    state.size = key;
    pushHistory();
    redraw();
  });
  renderStars();
  renderPhotoSlots();
  renderPanelEditor();
}

function renderStars() {
  const wrap = $('starsRow');
  wrap.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'star' + (i <= state.stars ? ' on' : '');
    b.textContent = '★';
    b.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
    b.addEventListener('click', () => {
      state.stars = i;
      pushHistory();
      renderStars();
      redraw();
    });
    wrap.appendChild(b);
  }
}

/** The three adjust sliders for the selected panel: value + label. */
const ADJUST = [
  { key: 'bright', input: 'panelBright', label: 'panelBrightVal', min: 0.5, max: 1.5, format: (v) => `${v.toFixed(2)}×` },
  { key: 'contrast', input: 'panelContrast', label: 'panelContrastVal', min: 0.5, max: 1.5, format: (v) => `${v.toFixed(2)}×` },
  { key: 'sat', input: 'panelSat', label: 'panelSatVal', min: 0, max: 2, format: (v) => `${v.toFixed(2)}×` },
];

function renderPanelEditor() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  const select = $('panelPhoto');
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '-1';
  empty.textContent = 'Empty panel';
  select.appendChild(empty);
  state.photos.forEach((img, i) => {
    if (!img) return;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1} — ${state.photoNames[i]}`;
    select.appendChild(opt);
  });
  select.value = String(panel.photo);
  $('panelZoom').value = String(panel.zoom);
  $('panelZoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  for (const a of ADJUST) {
    $(a.input).value = String(panel[a.key]);
    $(a.label).textContent = a.format(panel[a.key]);
  }
}

function wire() {
  $('title').addEventListener('input', (e) => {
    state.title = e.target.value;
    redraw();
  });
  $('title').addEventListener('change', pushHistory);
  $('subtitle').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    redraw();
  });
  $('subtitle').addEventListener('change', pushHistory);
  $('grainToggle').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    pushHistory();
    redraw();
  });
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.selected].photo = Number(e.target.value);
    pushHistory();
    redraw();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    $('panelZoomVal').textContent = `${state.panels[state.selected].zoom.toFixed(2)}×`;
    redraw();
  });
  $('panelZoom').addEventListener('change', pushHistory);
  for (const a of ADJUST) {
    $(a.input).addEventListener('input', (e) => {
      const panel = state.panels[state.selected];
      if (!panel) return;
      panel[a.key] = Number(e.target.value);
      $(a.label).textContent = a.format(panel[a.key]);
      redraw();
    });
    $(a.input).addEventListener('change', pushHistory);
  }
  $('panelReset').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.bright = 1;
    p.contrast = 1;
    p.sat = 1;
    pushHistory();
    renderPanelEditor();
    redraw();
  });
  $('fillAll').addEventListener('click', () => {
    const photo = state.panels[state.selected].photo;
    state.panels.forEach((p) => {
      p.photo = photo;
    });
    pushHistory();
    redraw();
    statusEl.textContent = 'Every panel now shows the selected photo.';
  });
  $('addPhotos').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = [...input.files].slice(0, 4);
      for (const file of files) {
        const slot = state.photos.findIndex((p) => !p);
        if (slot < 0) break;
        await setPhotoSlot(slot, file);
      }
      pushHistory();
      statusEl.textContent = `Added ${files.length} photo${files.length > 1 ? 's' : ''}.`;
    };
    input.click();
  });
  $('samplePier').addEventListener('click', () => loadSample('pier'));
  $('sampleBoulevard').addEventListener('click', () => loadSample('boulevard'));
  $('exportOne').addEventListener('click', () => exportOne(state.size));
  $('exportAll').addEventListener('click', exportAll);
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);

  // Keyboard: digits switch layout, [ ] cycle it, Ctrl+Z / Ctrl+Shift+Z
  // (or Ctrl+Y) undo and redo. Never while typing in a field.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-7]$/.test(e.key)) {
      const key = LAYOUT_KEYS[Number(e.key) - 1];
      if (key) {
        e.preventDefault();
        pickLayout(key);
      }
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
      e.preventDefault();
      cycleLayout(-1);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
      e.preventDefault();
      cycleLayout(1);
    }
  });

  // Drag a panel to pan its photo; wheel zooms it; click selects it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const rects = layoutPanels(state.layout, 1, 1);
    const hit = rects.findIndex((r) => fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h);
    if (hit < 0) return;
    state.selected = hit;
    renderPanelEditor();
    redraw();
    drag = { panel: state.panels[hit], startX: e.clientX, startY: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy, w: rect.width, h: rect.height, frac: rects[hit] };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / (drag.w * drag.frac.w);
    const dy = (e.clientY - drag.startY) / (drag.h * drag.frac.h);
    drag.panel.ox = Math.max(-1, Math.min(1, drag.ox + dx));
    drag.panel.oy = Math.max(-1, Math.min(1, drag.oy + dy));
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) {
      pushHistory();
      drag = null;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = state.panels[state.selected];
    if (!p) return;
    p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    renderPanelEditor();
    redraw();
  }, { passive: false });
}

// --- boot ----------------------------------------------------------------------

async function boot() {
  wire();
  syncControls();
  pushHistory();
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  await loadSample('pier');
  const query = new URLSearchParams(location.search);
  if (query.get('shot')) {
    runShot(query, {
      loadSample,
      loadSecondSample: async (name) => {
        const img = await loadImage(`samples/${name}.jpg`);
        state.photos[1] = img;
        state.photoNames[1] = `${name}.jpg (sample)`;
        // Alternate panels between the two photos, each with its own crop.
        // Panel 0 (the hero/big one) shifts its photo down so faces stay in.
        state.panels.forEach((p, i) => {
          p.photo = i % 2;
          p.zoom = 1 + (i % 3) * 0.15;
          p.ox = (i % 2 === 0 ? -0.08 : 0.08) * ((i + 1) / 4);
          p.oy = i === 0 ? 0.15 : i % 3 === 0 ? 0.05 : 0;
          p.bright = 1;
          p.contrast = 1;
          p.sat = 1;
        });
        renderPhotoSlots();
        redraw();
      },
      applyAdjust: (adjust) => {
        // Sets the same colour adjust on every panel (shot scenes use it
        // to show the adjust sliders doing real work in screenshots).
        state.panels.forEach((p) => {
          if (adjust.bright != null) p.bright = adjust.bright;
          if (adjust.contrast != null) p.contrast = adjust.contrast;
          if (adjust.sat != null) p.sat = adjust.sat;
        });
        renderPanelEditor();
        redraw();
      },
      setState: (patch) => {
        Object.assign(state, patch);
        refitPanels();
        syncControls();
        redraw();
      },
      redraw,
    });
  }
}

boot();
