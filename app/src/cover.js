// Vice Coast Cover Studio — v2 cover renderer.
//
// A cover is one canvas painting driven by a state object: a layout of
// photo panels, a gradient-map colour grade, a title in Anton, a subtitle
// in Pacifico, a star meter, film grain and a vignette. drawCover() paints
// the live preview and the exported PNG alike, so the editor shows exactly
// what the file will contain.
//
// Seven layouts, seven grades, four export sizes. Panels carry their own
// photo, zoom, pan and colour adjust (brightness / contrast / saturation),
// which the renderer bakes into each tile before the grade runs. Presets
// bundle a whole look — layout, grade, caption, stars and per-panel
// adjust — into one click; see PRESETS below.

export const LAYOUTS = {
  quad: { name: 'Quad Grid', panels: 4 },
  hero: { name: 'Hero + Three', panels: 4 },
  fullbleed: { name: 'Full Bleed', panels: 1 },
  nine: { name: 'Nine Grid', panels: 8 },
  tilted: { name: 'Tilted Snaps', panels: 4 },
  duo: { name: 'Duo', panels: 2 },
  diagonal: { name: 'Diagonal Split', panels: 4 },
};

export const GRADES = {
  sunset: {
    name: 'Sunset',
    shadows: [42, 14, 63], midtones: [255, 122, 61], highlights: [255, 217, 138],
    strength: 0.8, swatch: ['#2a0e3f', '#ff7a3d', '#ffd98a'],
  },
  neon: {
    name: 'Neon Vice',
    shadows: [11, 16, 53], midtones: [255, 46, 136], highlights: [125, 249, 255],
    strength: 0.85, swatch: ['#0b1035', '#ff2e88', '#7df9ff'],
  },
  dusk: {
    name: 'Dusk',
    shadows: [16, 19, 31], midtones: [122, 92, 255], highlights: [255, 179, 200],
    strength: 0.75, swatch: ['#10131f', '#7a5cff', '#ffb3c8'],
  },
  gold: {
    name: 'Golden Hour',
    shadows: [58, 28, 0], midtones: [255, 154, 61], highlights: [255, 243, 196],
    strength: 0.7, swatch: ['#3a1c00', '#ff9a3d', '#fff3c4'],
  },
  noir: {
    name: 'Mono Noir',
    shadows: [0, 0, 0], midtones: [119, 119, 119], highlights: [255, 255, 255],
    strength: 0.9, swatch: ['#000000', '#777777', '#ffffff'],
  },
  miami: {
    name: 'Miami Teal',
    shadows: [6, 34, 40], midtones: [0, 186, 168], highlights: [255, 242, 178],
    strength: 0.8, swatch: ['#062228', '#00baa8', '#fff2b2'],
  },
  ember: {
    name: 'Ember Red',
    shadows: [48, 5, 5], midtones: [255, 64, 38], highlights: [255, 205, 92],
    strength: 0.8, swatch: ['#300505', '#ff4026', '#ffcd5c'],
  },
};

export const SIZES = {
  square: { name: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  story: { name: 'Story 1080 × 1920', w: 1080, h: 1920 },
};

// One-click looks. `photos` is the photo slot each panel shows (0 or 1,
// alternating for multi-panel layouts); `adjust` is the colour adjust
// applied to every panel of the preset.
export const PRESETS = {
  viceSunset: {
    name: 'Vice Sunset', layout: 'hero', grade: 'sunset',
    title: 'Neon Coast', subtitle: 'a vice coast story', stars: 4,
    adjust: { bright: 1.05, contrast: 1.1, sat: 1.2 },
    photos: [0, 1, 0, 1],
  },
  neonNight: {
    name: 'Neon Night', layout: 'diagonal', grade: 'neon',
    title: 'Midnight Vice', subtitle: 'neon nights', stars: 5,
    adjust: { bright: 0.95, contrast: 1.15, sat: 1.35 },
    photos: [1, 0, 1, 0],
  },
  goldenHour: {
    name: 'Golden Hour', layout: 'duo', grade: 'gold',
    title: 'Golden Hour', subtitle: 'last light on the coast', stars: 4,
    adjust: { bright: 1.1, contrast: 1.05, sat: 1.1 },
    photos: [0, 0, 1, 1],
  },
};

/** A panel rectangle, in fractions of the canvas. `rot` spins a panel
 *  (tilted polaroids); `skew` shears it, so the panel becomes a
 *  parallelogram and the seams between panels run diagonally. */
function R(x, y, w, h, extra = {}) {
  return { x, y, w, h, ...extra };
}

const TITLE_BAND_H = 0.22; // title band height, as a fraction of h

/** Panel rectangles for a layout, as fractions of the canvas. */
export function layoutPanels(layout, w, h) {
  const artH = 1 - TITLE_BAND_H;
  const half = artH / 2;
  const gutter = 0.02;
  const inner = 0.47;
  switch (layout) {
    case 'quad':
      return [
        R(gutter, gutter, inner, half - 0.03),
        R(0.51, gutter, inner, half - 0.03),
        R(gutter, half, inner, half - 0.03),
        R(0.51, half, inner, half - 0.03),
      ];
    case 'hero': {
      const colH = artH - 0.04;
      const cell = colH / 3;
      return [
        R(gutter, gutter, 0.62, colH),
        R(0.66, gutter, 0.32, cell - 0.01),
        R(0.66, gutter + cell, 0.32, cell - 0.01),
        R(0.66, gutter + cell * 2, 0.32, cell - 0.01),
      ];
    }
    case 'fullbleed':
      return [R(0, 0, 1, 1)];
    case 'nine': {
      const cw = 0.96 / 3;
      const ch = (artH - 0.04) / 3;
      const cells = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (row === 1 && col === 1) continue; // centre cell is the title block
          cells.push(R(gutter + col * cw, gutter + row * ch, cw - 0.01, ch - 0.01));
        }
      }
      return cells;
    }
    case 'tilted':
      return [
        R(0.06, 0.16, 0.40, 0.32, { rot: -0.10 }),
        R(0.54, 0.13, 0.40, 0.32, { rot: 0.07 }),
        R(0.08, 0.54, 0.40, 0.32, { rot: 0.06 }),
        R(0.54, 0.51, 0.40, 0.32, { rot: -0.08 }),
      ];
    case 'duo':
      return [
        R(gutter, gutter, inner, artH - 0.04),
        R(0.51, gutter, inner, artH - 0.04),
      ];
    case 'diagonal': {
      // Two rows sheared in opposite directions: the top row leans right,
      // the bottom row leans left, and the seam between them runs on a
      // diagonal. The x offsets leave room for the shear so no panel is
      // clipped at the canvas edge (the shear shifts a row by about
      // skew * row height in pixels, most on tall story covers).
      const rowH = 0.35;
      const shear = 0.10;
      return [
        R(gutter, gutter, inner, rowH, { skew: shear }),
        R(0.51, gutter, 0.40, rowH, { skew: shear }),
        R(0.07, 0.40, 0.44, rowH, { skew: -shear }),
        R(0.53, 0.40, 0.40, rowH, { skew: -shear }),
      ];
    }
    default:
      return layoutPanels('quad', w, h);
  }
}

/** Title band rectangle, as fractions of the canvas. */
export function titleBand(layout) {
  if (layout === 'fullbleed') return R(0, 0.66, 1, 0.34);
  if (layout === 'tilted') return R(0, 0, 1, 0.14);
  if (layout === 'nine') return R(0.34, 0.28, 0.32, 0.22);
  return R(0, 0.78, 1, TITLE_BAND_H);
}

// --- gradient-map grades -----------------------------------------------------

const lutCache = new Map();

/** Linear mix of two RGB triples. */
function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A 256-entry gradient-map lookup for a grade: luminance -> [r, g, b]. */
function gradeLut(grade) {
  const hit = lutCache.get(grade.name);
  if (hit) return hit;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const rgb = t < 0.5
      ? mix3(grade.shadows, grade.midtones, t * 2)
      : mix3(grade.midtones, grade.highlights, (t - 0.5) * 2);
    lut[i * 3] = rgb[0];
    lut[i * 3 + 1] = rgb[1];
    lut[i * 3 + 2] = rgb[2];
  }
  lutCache.set(grade.name, lut);
  return lut;
}

/** Applies a grade's gradient map to a canvas region, blended with the photo. */
function applyGrade(ctx, x, y, w, h, grade) {
  if (w < 2 || h < 2) return;
  const lut = gradeLut(grade);
  const strength = grade.strength;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    const o = lum * 3;
    d[i] += (lut[o] - d[i]) * strength;
    d[i + 1] += (lut[o + 1] - d[i + 1]) * strength;
    d[i + 2] += (lut[o + 2] - d[i + 2]) * strength;
  }
  ctx.putImageData(img, x, y);
}

// --- per-panel photos ----------------------------------------------------------

/** The canvas filter string for a panel's adjust sliders. Defaults are 1,
 *  which renders exactly as before — the filter is skipped entirely then. */
function adjustFilter(panel) {
  const b = panel?.bright ?? 1;
  const c = panel?.contrast ?? 1;
  const s = panel?.sat ?? 1;
  if (b === 1 && c === 1 && s === 1) return '';
  return `brightness(${b}) contrast(${c}) saturate(${s})`;
}

/** Draws one photo into a panel rect, cover-fit with the panel's zoom, pan
 *  and colour adjust. The pan is clamped so the photo always covers the
 *  panel — no dark gaps. */
function drawPhotoInto(ctx, photo, rect, panel) {
  const { x, y, w, h } = rect;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const scale = Math.max(w / iw, h / ih) * (panel?.zoom ?? 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const slackX = Math.max(0, (pw - w) / 2) / w;
  const slackY = Math.max(0, (ph - h) / 2) / h;
  const ox = Math.max(-slackX, Math.min(slackX, panel?.ox ?? 0)) * w;
  const oy = Math.max(-slackY, Math.min(slackY, panel?.oy ?? 0)) * h;
  const filter = adjustFilter(panel);
  if (filter) ctx.filter = filter;
  ctx.drawImage(photo, x + (w - pw) / 2 + ox, y + (h - ph) / 2 + oy, pw, ph);
  if (filter) ctx.filter = 'none';
}

// --- texture helpers -----------------------------------------------------------

let noiseTile = null;

/** A tiny deterministic RNG (mulberry32) so the grain tile is identical
 *  on every load: the same cover state always renders the same pixels,
 *  which is what makes a seeded "Surprise me" replayable exactly. */
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tileable film-grain pattern, built once. */
function grainPattern(ctx) {
  if (!noiseTile) {
    noiseTile = document.createElement('canvas');
    noiseTile.width = 160;
    noiseTile.height = 160;
    const nctx = noiseTile.getContext('2d');
    const img = nctx.createImageData(160, 160);
    const rng = seededRng(1337);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + ((rng() * 90) | 0);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }
  return ctx.createPattern(noiseTile, 'repeat');
}

/** Draws a five-point star path at (cx, cy) with radius r. */
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Halftone dots across a band, the poster-print texture behind the title. */
function halftoneDots(ctx, x, y, w, h, colour) {
  ctx.save();
  ctx.fillStyle = colour;
  const step = Math.max(10, w / 72);
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const r = step * 0.22 * (0.6 + 0.4 * Math.sin(xx * 0.045 + yy * 0.03));
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// --- title block ----------------------------------------------------------------

/** Paints the title band: its fill, the title, subtitle and star meter. */
function paintTitle(ctx, state, w, h) {
  const band = titleBand(state.layout);
  const bx = band.x * w;
  const by = band.y * h;
  const bw = band.w * w;
  const bh = band.h * h;
  const centred = state.layout === 'nine';
  const title = (state.title || 'UNTITLED').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();

  ctx.save();
  if (state.layout === 'fullbleed') {
    const scrim = ctx.createLinearGradient(0, by, 0, by + bh);
    scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 24, 0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(bx, by, bw, bh);
  } else if (state.layout === 'tilted') {
    // Title rides on the sunset sky, no band fill.
  } else if (centred) {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(bx, by, bw, bh);
    halftoneDots(ctx, bx, by, bw, bh, '#ff2e88');
  } else {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(bx, by, bw, bh);
    halftoneDots(ctx, bx, by, bw, bh, '#ff2e88');
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(bx, by, bw, Math.max(3, h * 0.006));
    if (state.layout === 'diagonal') {
      // A slanted accent stripe echoes the diagonal seams above the band.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bx, by + bh);
      ctx.lineTo(bx + bw * 0.22, by);
      ctx.lineTo(bx + bw * 0.30, by);
      ctx.lineTo(bx + bw * 0.08, by + bh);
      ctx.closePath();
      ctx.fillStyle = '#7df9ff';
      ctx.fill();
      ctx.restore();
    }
  }

  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  ctx.translate(cx, cy);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const baseSize = centred ? Math.min(bw * 0.16, bh * 0.30) : Math.min(bw * 0.085, bh * 0.42);
  let size = baseSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(1, size * 0.04)}px`;
  } catch (e) { /* older canvas: no letterSpacing */ }
  while (ctx.measureText(title).width > bw * 0.92 && size > 10) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  const subSize = centred ? Math.min(bw * 0.09, bh * 0.16) : Math.min(bw * 0.032, bh * 0.16);
  const titleY = subtitle ? -bh * 0.16 : 0;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineWidth = Math.max(2, size * 0.10);
  ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
  ctx.shadowBlur = size * 0.18;
  ctx.strokeText(title, 0, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, 0, titleY);
  ctx.shadowBlur = 0;

  if (subtitle) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    try {
      ctx.letterSpacing = '0px';
    } catch (e) { /* ignore */ }
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.6;
    ctx.fillStyle = '#ff7ad9';
    ctx.fillText(subtitle, 0, titleY + size * 0.62 + subSize * 0.55);
    ctx.shadowBlur = 0;
  }

  if (state.stars > 0 && !centred) {
    const r = Math.min(bw * 0.016, bh * 0.09);
    const gap = r * 2.6;
    const total = gap * 4;
    const sy = titleY + size * 0.62 + subSize * 1.35;
    for (let i = 0; i < 5; i++) {
      starPath(ctx, -total / 2 + i * gap, sy, r);
      ctx.fillStyle = i < state.stars ? '#ffd166' : 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
    }
  }
  ctx.restore();
}

// --- panel placement ---------------------------------------------------------------

/** Paints one panel tile (photo + grade, or the empty placeholder) onto
 *  an offscreen canvas the size of the panel, then places it on the main
 *  canvas — rotated for tilted panels, sheared for diagonal ones. */
function placeTile(ctx, tile, frac, px, py, pw, ph, w, h) {
  ctx.save();
  if (frac.rot) {
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate(frac.rot);
    ctx.translate(-pw / 2, -ph / 2);
    // Polaroid white frame, thicker at the foot.
    ctx.fillStyle = '#f8f4ec';
    ctx.fillRect(-pw * 0.03, -ph * 0.03, pw * 1.06, ph * 1.06 + ph * 0.08);
    ctx.drawImage(tile, 0, 0);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, pw, ph);
  } else if (frac.skew) {
    // Shear: x' = x + skew * y, so the panel's seams run diagonally.
    ctx.translate(px, py);
    ctx.transform(1, 0, frac.skew, 1, 0, 0);
    ctx.drawImage(tile, 0, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(0, 0, pw, ph);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = Math.max(1, w * 0.002);
    ctx.strokeRect(w * 0.004, h * 0.004, pw - w * 0.008, ph - h * 0.008);
  } else {
    ctx.drawImage(tile, px, py);
    // Inked poster edge: white gutter line and a dark inner edge.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = Math.max(1, w * 0.002);
    ctx.strokeRect(px + w * 0.004, py + h * 0.004, pw - w * 0.008, ph - h * 0.008);
  }
  ctx.restore();
}

// --- whole cover ---------------------------------------------------------------------

/** Backdrop behind the panels: deep violet, a sunset sky for the tilted
 *  layout, and a diagonal sunset wash behind the diagonal split. */
function paintBackdrop(ctx, layout, w, h) {
  if (layout === 'tilted') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a0e3f');
    sky.addColorStop(0.45, '#ff2e88');
    sky.addColorStop(0.75, '#ff7a3d');
    sky.addColorStop(1, '#ffd98a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.42, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (layout === 'diagonal') {
    const wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, '#1a0b2e');
    wash.addColorStop(0.5, '#7a1e5c');
    wash.addColorStop(1, '#ff7a3d');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, 0, w, h);
  }
}

/** Paints every panel: each photo is adjusted and graded on its own tile,
 *  then the tile is placed on the main canvas. */
function paintPanels(ctx, state, w, h, grade) {
  const rects = layoutPanels(state.layout, w, h);
  rects.forEach((frac, i) => {
    const panel = state.panels[i] ?? { photo: -1, zoom: 1, ox: 0, oy: 0, bright: 1, contrast: 1, sat: 1 };
    const px = Math.round(frac.x * w);
    const py = Math.round(frac.y * h);
    const pw = Math.round(frac.w * w);
    const ph = Math.round(frac.h * h);
    const photo = panel.photo >= 0 ? state.photos[panel.photo] : null;

    const tile = document.createElement('canvas');
    tile.width = Math.max(2, pw);
    tile.height = Math.max(2, ph);
    const tctx = tile.getContext('2d');
    if (photo) {
      tctx.fillStyle = '#1d1030';
      tctx.fillRect(0, 0, pw, ph);
      drawPhotoInto(tctx, photo, { x: 0, y: 0, w: pw, h: ph }, panel);
      applyGrade(tctx, 0, 0, pw, ph, grade);
    } else {
      tctx.fillStyle = '#241534';
      tctx.fillRect(0, 0, pw, ph);
      tctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      tctx.lineWidth = Math.max(2, pw * 0.01);
      tctx.setLineDash([pw * 0.03, pw * 0.02]);
      tctx.strokeRect(pw * 0.04, ph * 0.04, pw * 0.92, ph * 0.92);
      tctx.setLineDash([]);
      tctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      tctx.font = `bold ${Math.max(12, pw * 0.05)}px system-ui, sans-serif`;
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';
      tctx.fillText(`PANEL ${i + 1} — ADD A PHOTO`, pw / 2, ph / 2);
    }

    placeTile(ctx, tile, frac, px, py, pw, ph, w, h);
  });
}

/** Film grain and vignette over the whole cover. */
function paintFinish(ctx, state, w, h) {
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover onto `canvas` (any size) from `state`:
 *   state = { layout, grade, title, subtitle, stars, grain, photos[], panels[] }
 * photos are Image elements (or null); panels are
 * { photo, zoom, ox, oy, bright, contrast, sat }.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  paintBackdrop(ctx, state.layout, w, h);
  paintPanels(ctx, state, w, h, grade);
  paintTitle(ctx, state, w, h);
  paintFinish(ctx, state, w, h);
}
