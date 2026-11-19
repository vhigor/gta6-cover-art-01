// Vice Coast Cover Studio — the cover renderer.
//
// Every cover is drawn on a 2D canvas from one state object: a layout of
// photo panels, a colour grade, a title in Anton, a subtitle in Pacifico,
// a star meter, grain and a vignette. The same drawCover() paints the live
// preview (small canvas) and the exported PNG (full-size offscreen canvas).

export const LAYOUTS = {
  quad: { name: 'Quad Grid', panels: 4 },
  hero: { name: 'Hero + Three', panels: 4 },
  fullbleed: { name: 'Full Bleed', panels: 1 },
  nine: { name: 'Nine Grid', panels: 8 },
  tilted: { name: 'Tilted Snaps', panels: 4 },
  duo: { name: 'Duo', panels: 2 },
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
};

export const SIZES = {
  square: { name: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};

/** Panel rectangles for a layout, as fractions of the canvas (x, y, w, h). */
export function layoutPanels(layout, w, h) {
  const band = 0.22; // title band height, as a fraction of h
  const artH = 1 - band;
  switch (layout) {
    case 'quad':
      return [
        { x: 0.02, y: 0.02, w: 0.47, h: artH / 2 - 0.03, rot: 0 },
        { x: 0.51, y: 0.02, w: 0.47, h: artH / 2 - 0.03, rot: 0 },
        { x: 0.02, y: artH / 2, w: 0.47, h: artH / 2 - 0.03, rot: 0 },
        { x: 0.51, y: artH / 2, w: 0.47, h: artH / 2 - 0.03, rot: 0 },
      ];
    case 'hero':
      return [
        { x: 0.02, y: 0.02, w: 0.62, h: artH - 0.04, rot: 0 },
        { x: 0.66, y: 0.02, w: 0.32, h: (artH - 0.04) / 3 - 0.01, rot: 0 },
        { x: 0.66, y: 0.02 + (artH - 0.04) / 3, w: 0.32, h: (artH - 0.04) / 3 - 0.01, rot: 0 },
        { x: 0.66, y: 0.02 + ((artH - 0.04) / 3) * 2, w: 0.32, h: (artH - 0.04) / 3 - 0.01, rot: 0 },
      ];
    case 'fullbleed':
      return [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }];
    case 'nine': {
      const cw = 0.96 / 3;
      const ch = (artH - 0.04) / 3;
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title block
          cells.push({ x: 0.02 + c * cw, y: 0.02 + r * ch, w: cw - 0.01, h: ch - 0.01, rot: 0 });
        }
      }
      return cells;
    }
    case 'tilted':
      return [
        { x: 0.06, y: 0.16, w: 0.40, h: 0.32, rot: -0.10 },
        { x: 0.54, y: 0.13, w: 0.40, h: 0.32, rot: 0.07 },
        { x: 0.08, y: 0.54, w: 0.40, h: 0.32, rot: 0.06 },
        { x: 0.54, y: 0.51, w: 0.40, h: 0.32, rot: -0.08 },
      ];
    case 'duo':
      return [
        { x: 0.02, y: 0.02, w: 0.47, h: artH - 0.04, rot: 0 },
        { x: 0.51, y: 0.02, w: 0.47, h: artH - 0.04, rot: 0 },
      ];
    default:
      return layoutPanels('quad', w, h);
  }
}

/** Title band rectangle, as fractions of the canvas. */
export function titleBand(layout) {
  if (layout === 'fullbleed') return { x: 0, y: 0.66, w: 1, h: 0.34 };
  if (layout === 'tilted') return { x: 0, y: 0.0, w: 1, h: 0.14 };
  if (layout === 'nine') return { x: 0.34, y: 0.28, w: 0.32, h: 0.22 };
  return { x: 0, y: 0.78, w: 1, h: 0.22 };
}

const lutCache = new Map();

/** Builds a 256-entry gradient-map lookup for a grade: luminance -> [r, g, b]. */
function gradeLut(grade) {
  if (lutCache.has(grade.name)) return lutCache.get(grade.name);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const a = grade.shadows;
    const b = grade.midtones;
    const c = grade.highlights;
    let r, g, bl;
    if (t < 0.5) {
      const k = t * 2;
      r = a[0] + (b[0] - a[0]) * k;
      g = a[1] + (b[1] - a[1]) * k;
      bl = a[2] + (b[2] - a[2]) * k;
    } else {
      const k = (t - 0.5) * 2;
      r = b[0] + (c[0] - b[0]) * k;
      g = b[1] + (c[1] - b[1]) * k;
      bl = b[2] + (c[2] - b[2]) * k;
    }
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = bl;
  }
  lutCache.set(grade.name, lut);
  return lut;
}

/** Applies a grade's gradient map to a canvas region, blended with the photo. */
function applyGrade(ctx, x, y, w, h, grade) {
  if (w < 2 || h < 2) return;
  const lut = gradeLut(grade);
  const s = grade.strength;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    const o = lum * 3;
    d[i] = d[i] + (lut[o] - d[i]) * s;
    d[i + 1] = d[i + 1] + (lut[o + 1] - d[i + 1]) * s;
    d[i + 2] = d[i + 2] + (lut[o + 2] - d[i + 2]) * s;
  }
  ctx.putImageData(img, x, y);
}

/** Draws one photo into a panel rect, cover-fit with the panel's zoom and pan.
 *  The pan is clamped so the photo always covers the panel — no dark gaps. */
function drawPhotoInto(ctx, photo, rect, panel) {
  const { x, y, w, h } = rect;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const scale = Math.max(w / iw, h / ih) * (panel?.zoom ?? 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const maxOx = Math.max(0, (pw - w) / 2) / w;
  const maxOy = Math.max(0, (ph - h) / 2) / h;
  const ox = Math.max(-maxOx, Math.min(maxOx, panel?.ox ?? 0)) * w;
  const oy = Math.max(-maxOy, Math.min(maxOy, panel?.oy ?? 0)) * h;
  ctx.drawImage(photo, x + (w - pw) / 2 + ox, y + (h - ph) / 2 + oy, pw, ph);
}

let noiseCanvas = null;

/** A tileable film-grain pattern, built once. */
function grainPattern(ctx) {
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 160;
    noiseCanvas.height = 160;
    const nctx = noiseCanvas.getContext('2d');
    const img = nctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + ((Math.random() * 90) | 0);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }
  return ctx.createPattern(noiseCanvas, 'repeat');
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

/** Draws the title, subtitle and star meter inside the title band. */
function drawTitleBlock(ctx, state, w, h) {
  const band = titleBand(state.layout);
  const bx = band.x * w;
  const by = band.y * h;
  const bw = band.w * w;
  const bh = band.h * h;
  const centre = state.layout === 'nine';
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
  } else if (centre) {
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
  }

  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  ctx.translate(cx, cy);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleSize = centre ? Math.min(bw * 0.16, bh * 0.30) : Math.min(bw * 0.085, bh * 0.42);
  let size = titleSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(1, size * 0.04)}px`;
  } catch (e) { /* older canvas: no letterSpacing */ }
  while (ctx.measureText(title).width > bw * 0.92 && size > 10) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  const subSize = centre ? Math.min(bw * 0.09, bh * 0.16) : Math.min(bw * 0.032, bh * 0.16);
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

  if (state.stars > 0 && !centre) {
    const r = Math.min(bw * 0.016, bh * 0.09);
    const gap = r * 2.6;
    const total = gap * 4;
    const sy = titleY + size * 0.62 + subSize * 1.35;
    for (let i = 0; i < 5; i++) {
      const sx = -total / 2 + i * gap;
      starPath(ctx, sx, sy, r);
      ctx.fillStyle = i < state.stars ? '#ffd166' : 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` (any size) from `state`:
 *   state = { layout, grade, title, subtitle, stars, grain, photos[], panels[] }
 * photos are Image elements (or null); panels are { photo, zoom, ox, oy }.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = layoutPanels(state.layout, w, h);

  // Backdrop: deep violet, or a sunset sky for the tilted layout.
  if (state.layout === 'tilted') {
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
  } else {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, 0, w, h);
  }

  // Panels: each photo is graded on its own tile, then placed (tilted ones rotated).
  rects.forEach((frac, i) => {
    const panel = state.panels[i] ?? { photo: -1, zoom: 1, ox: 0, oy: 0 };
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
  });

  drawTitleBlock(ctx, state, w, h);

  // Film grain and vignette over the whole cover.
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
