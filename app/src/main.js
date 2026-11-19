// Vice Coast Cover Studio v2 — the editor: photos, panels, layout,
// grade, caption, per-panel colour adjust, presets, randomize, export
// and undo/redo. The preview canvas and the exported PNG are both painted
// by drawCover() in ./cover.js, so what you see is what you get.
//
// Keyboard: 1–7 switches layout, [ and ] cycle layouts, R randomizes the
// whole cover, Ctrl+Z undoes, Ctrl+Shift+Z / Ctrl+Y redoes. Shortcuts
// never fire while you type in a text field. The editor also works at
// narrow widths (see style.css).
import { drawCover, layoutPanels, LAYOUTS, GRADES, SIZES, PRESETS } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const PREVIEW_MAX = 720; // preview canvas long side, in pixels
const LAYOUT_KEYS = Object.keys(LAYOUTS);
const PRESET_KEYS = Object.keys(PRESETS);
const GRADE_KEYS = Object.keys(GRADES);
const SURPRISE_TITLES = [
  ['Neon Coast', 'a vice coast story'],
  ['Midnight Vice', 'neon nights'],
  ['Golden Hour', 'last light on the coast'],
  ['Vice City Nights', 'drive fast, live loud'],
  ['Sunset Strip', 'two stars, one coast'],
  ['Palm & Chrome', 'a leonida postcard'],
];

/** A fresh panel: which photo it shows, its zoom, pan and colour adjust. */
function newPanel(photo = 0) {
  return { photo, zoom: 1, ox: 0, oy: 0, bright: 1, contrast: 1, sat: 1 };
}

/** Fills in any missing panel field (older snapshots, shot patches). */
function completePanel(p, fallbackPhoto = 0) {
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

/** A tiny deterministic RNG (mulberry32) so a "surprise" can be replayed
 *  exactly in a screenshot scene; the editor itself uses Math.random. */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

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
  panels: [newPanel(0), newPanel(0), newPanel(0), newPanel(0)],
  selected: 0,
};

// --- history (undo / redo) ---------------------------------------------------

const history = [];
let historyIndex = -1;

function takeSnapshot() {
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

function applySnapshot(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  state.panels = state.panels.map((p) => completePanel(p));
  syncAll();
  paint();
}

function commit() {
  history.length = historyIndex + 1;
  history.push(takeSnapshot());
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = true;
}

function goBack() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  applySnapshot(history[historyIndex]);
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = false;
}

function goForward() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  applySnapshot(history[historyIndex]);
  $('undo').disabled = false;
  $('redo').disabled = historyIndex >= history.length - 1;
}

// --- painting ------------------------------------------------------------------

function previewSize() {
  const size = SIZES[state.size];
  const scale = PREVIEW_MAX / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function paint() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  // The pink selection outline is editor chrome: never draw it on the
  // full-frame cover scene used for screenshots.
  if (!document.body.classList.contains('shot-cover')) outlineSelected();
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
}

/** Draws the pink selection outline around the selected panel. */
function outlineSelected() {
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
    next.push(state.panels[i] ? completePanel(state.panels[i]) : newPanel(i % filledPhotos()));
  }
  state.panels = next;
  state.selected = Math.min(state.selected, n - 1);
}

function filledPhotos() {
  return Math.max(1, state.photos.filter(Boolean).length);
}

/** Switches to a layout by key, refitting panels and recording history. */
function chooseLayout(key) {
  if (!LAYOUTS[key] || key === state.layout) return;
  state.layout = key;
  refitPanels();
  commit();
  syncAll();
  paint();
}

/** Steps the layout forward (+1) or back (-1) through the picker order. */
function stepLayout(dir) {
  const i = LAYOUT_KEYS.indexOf(state.layout);
  const next = LAYOUT_KEYS[(i + dir + LAYOUT_KEYS.length) % LAYOUT_KEYS.length];
  chooseLayout(next);
}

// --- presets & surprise ---------------------------------------------------------

/** Applies one of the named presets: layout, grade, caption, stars, the
 *  preset's per-panel adjust and its photo pattern. */
function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.title = preset.title;
  state.subtitle = preset.subtitle;
  state.stars = preset.stars;
  refitPanels();
  state.panels.forEach((p, i) => {
    const slot = preset.photos[i % preset.photos.length] % filledPhotos();
    p.photo = slot;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.bright = preset.adjust.bright;
    p.contrast = preset.adjust.contrast;
    p.sat = preset.adjust.sat;
  });
  commit();
  syncAll();
  paint();
  statusEl.textContent = `Preset “${preset.name}” applied — ${LAYOUTS[preset.layout].name} · ${GRADES[preset.grade].name}.`;
}

/** Randomizes the whole cover: layout, grade, caption, stars, adjust and
 *  the photo pattern. `rng` defaults to Math.random; a seeded RNG makes
 *  the surprise replayable (screenshot scenes use one). */
function surpriseMe(rng = Math.random) {
  const [title, subtitle] = pick(rng, SURPRISE_TITLES);
  state.layout = pick(rng, LAYOUT_KEYS);
  state.grade = pick(rng, GRADE_KEYS);
  state.title = title;
  state.subtitle = subtitle;
  state.stars = 3 + Math.floor(rng() * 3);
  const bright = 0.9 + rng() * 0.25;
  const contrast = 0.95 + rng() * 0.25;
  const sat = 1 + rng() * 0.45;
  refitPanels();
  state.panels.forEach((p) => {
    p.photo = Math.floor(rng() * filledPhotos());
    p.zoom = 1 + rng() * 0.3;
    p.ox = (rng() - 0.5) * 0.16;
    p.oy = (rng() - 0.5) * 0.12;
    p.bright = bright;
    p.contrast = contrast;
    p.sat = sat;
  });
  commit();
  syncAll();
  paint();
  statusEl.textContent = `Surprise! ${LAYOUTS[state.layout].name} · ${GRADES[state.grade].name} · “${title}”. Press R again for another.`;
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

async function assignSlot(slot, file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos[slot] = img;
  state.photoNames[slot] = file.name;
  // Panels pointing at an empty slot take the new photo; empty panels fill in.
  state.panels.forEach((p) => {
    if (p.photo < 0) p.photo = slot;
  });
  drawSlots();
  paint();
}

function drawSlots() {
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
        if (input.files[0]) assignSlot(i, input.files[0]);
      };
      input.click();
    });
    wrap.appendChild(slot);
  });
}

/** Loads a bundled sample photo into slot 0 and fills every panel with it. */
async function useSample(name) {
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
  drawSlots();
  commit();
  paint();
  statusEl.textContent = `Loaded sample photo ${name}.jpg — drag a panel to reposition it.`;
}

// --- export ------------------------------------------------------------------

/** Renders the cover at full export size and returns a PNG blob. */
async function exportBlob(sizeKey) {
  const size = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  await document.fonts.ready;
  drawCover(off, state);
  return new Promise((resolve) => off.toBlob(resolve, 'image/png'));
}

function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function slugOf(title) {
  return (title || 'cover').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
}

async function exportSize(sizeKey) {
  const size = SIZES[sizeKey];
  statusEl.textContent = `Rendering ${size.name}…`;
  const blob = await exportBlob(sizeKey);
  const slug = slugOf(state.title);
  saveBlob(blob, `${slug}-${size.w}x${size.h}.png`);
  statusEl.textContent = `Saved ${slug}-${size.w}x${size.h}.png`;
}

async function exportEverySize() {
  const keys = Object.keys(SIZES);
  for (const key of keys) {
    await exportSize(key);
    await new Promise((r) => setTimeout(r, 350));
  }
  statusEl.textContent = `Saved all ${keys.length} sizes — square, portrait, wide and story.`;
}

// --- controls ----------------------------------------------------------------

function buildChips(container, entries, current, onPick) {
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
      buildChips(container, entries, key, onPick);
    });
    el.appendChild(b);
  });
}

function buildPresets() {
  const el = $('presetRow');
  el.innerHTML = '';
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    const grade = GRADES[preset.grade];
    b.style.background = `linear-gradient(135deg, ${grade.swatch[0]} 0%, ${grade.swatch[1]} 55%, ${grade.swatch[2]} 100%)`;
    b.innerHTML = `<span class="preset-name">${preset.name}</span><span class="preset-sub">${LAYOUTS[preset.layout].name} · ${grade.name}</span>`;
    b.addEventListener('click', () => applyPreset(key));
    el.appendChild(b);
  });
}

function syncAll() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('grainToggle').checked = state.grain;
  buildChips('layoutRow', LAYOUTS, state.layout, chooseLayout);
  buildChips('gradeRow', GRADES, state.grade, (key) => {
    state.grade = key;
    commit();
    paint();
  });
  buildChips('sizeRow', SIZES, state.size, (key) => {
    state.size = key;
    commit();
    paint();
  });
  buildPresets();
  paintStars();
  drawSlots();
  paintPanelForm();
}

function paintStars() {
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
      commit();
      paintStars();
      paint();
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

function paintPanelForm() {
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

function attachHandlers() {
  $('title').addEventListener('input', (e) => {
    state.title = e.target.value;
    paint();
  });
  $('title').addEventListener('change', commit);
  $('subtitle').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    paint();
  });
  $('subtitle').addEventListener('change', commit);
  $('grainToggle').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    commit();
    paint();
  });
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.selected].photo = Number(e.target.value);
    commit();
    paint();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    $('panelZoomVal').textContent = `${state.panels[state.selected].zoom.toFixed(2)}×`;
    paint();
  });
  $('panelZoom').addEventListener('change', commit);
  for (const a of ADJUST) {
    $(a.input).addEventListener('input', (e) => {
      const panel = state.panels[state.selected];
      if (!panel) return;
      panel[a.key] = Number(e.target.value);
      $(a.label).textContent = a.format(panel[a.key]);
      paint();
    });
    $(a.input).addEventListener('change', commit);
  }
  $('panelReset').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.bright = 1;
    p.contrast = 1;
    p.sat = 1;
    commit();
    paintPanelForm();
    paint();
  });
  $('fillAll').addEventListener('click', () => {
    const photo = state.panels[state.selected].photo;
    state.panels.forEach((p) => {
      p.photo = photo;
    });
    commit();
    paint();
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
        await assignSlot(slot, file);
      }
      commit();
      statusEl.textContent = `Added ${files.length} photo${files.length > 1 ? 's' : ''}.`;
    };
    input.click();
  });
  $('samplePier').addEventListener('click', () => useSample('pier'));
  $('sampleBoulevard').addEventListener('click', () => useSample('boulevard'));
  $('surpriseBtn').addEventListener('click', () => surpriseMe());
  $('exportOne').addEventListener('click', () => exportSize(state.size));
  $('exportAll').addEventListener('click', exportEverySize);
  $('undo').addEventListener('click', goBack);
  $('redo').addEventListener('click', goForward);

  // Keyboard: digits switch layout, [ ] cycle it, R randomizes, Ctrl+Z /
  // Ctrl+Shift+Z (or Ctrl+Y) undo and redo. Never while typing in a field.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      goBack();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      goForward();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-7]$/.test(e.key)) {
      const key = LAYOUT_KEYS[Number(e.key) - 1];
      if (key) {
        e.preventDefault();
        chooseLayout(key);
      }
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
      e.preventDefault();
      stepLayout(-1);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
      e.preventDefault();
      stepLayout(1);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      surpriseMe();
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
    paintPanelForm();
    paint();
    drag = { panel: state.panels[hit], startX: e.clientX, startY: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy, w: rect.width, h: rect.height, frac: rects[hit] };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / (drag.w * drag.frac.w);
    const dy = (e.clientY - drag.startY) / (drag.h * drag.frac.h);
    drag.panel.ox = Math.max(-1, Math.min(1, drag.ox + dx));
    drag.panel.oy = Math.max(-1, Math.min(1, drag.oy + dy));
    paint();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) {
      commit();
      drag = null;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = state.panels[state.selected];
    if (!p) return;
    p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    paintPanelForm();
    paint();
  }, { passive: false });
}

// --- boot ----------------------------------------------------------------------

async function boot() {
  attachHandlers();
  syncAll();
  commit();
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  await useSample('pier');
  const query = new URLSearchParams(location.search);
  if (query.get('shot')) {
    runShot(query, {
      loadSample: useSample,
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
        drawSlots();
        paint();
      },
      applyAdjust: (adjust) => {
        // Sets the same colour adjust on every panel (shot scenes use it
        // to show the adjust sliders doing real work in screenshots).
        state.panels.forEach((p) => {
          if (adjust.bright != null) p.bright = adjust.bright;
          if (adjust.contrast != null) p.contrast = adjust.contrast;
          if (adjust.sat != null) p.sat = adjust.sat;
        });
        paintPanelForm();
        paint();
      },
      applyPreset,
      surpriseMe: (seed) => surpriseMe(makeRng(seed)),
      setState: (patch) => {
        Object.assign(state, patch);
        refitPanels();
        syncAll();
        paint();
      },
      redraw: paint,
    });
  }
}

boot();
