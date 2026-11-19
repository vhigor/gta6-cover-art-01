// Fixed scenes for screenshots: ?shot=editor shows the app with a sample
// photo loaded; ?shot=cover shows the cover alone, full frame.
//
// Query params pick the scene:
//   photo (pier|boulevard), second (a second sample photo for alternating
//   panels), layout, grade, size, title, subtitle, stars,
//   bright / contrast / sat (colour adjust applied to every panel, so a
//   screenshot can show the adjust sliders doing real work),
//   preset (one of the named presets, applied after the samples load),
//   random (a seed number: runs the deterministic "Surprise me" so a
//   screenshot can show a randomized cover, replayed exactly).
// window.__shotReady is set once the scene is painted.
function parseScene(query) {
  const scene = {
    shot: query.get('shot'),
    photo: query.get('photo') ?? 'pier',
    second: query.get('second'),
    preset: query.get('preset'),
    random: query.get('random') !== null ? Number(query.get('random')) : null,
    patch: {},
    adjust: {},
  };
  if (query.get('layout')) scene.patch.layout = query.get('layout');
  if (query.get('grade')) scene.patch.grade = query.get('grade');
  if (query.get('size')) scene.patch.size = query.get('size');
  if (query.get('title')) scene.patch.title = query.get('title');
  if (query.get('subtitle') !== null) scene.patch.subtitle = query.get('subtitle');
  if (query.get('stars')) scene.patch.stars = Number(query.get('stars'));
  for (const key of ['bright', 'contrast', 'sat']) {
    if (query.get(key) !== null) scene.adjust[key] = Number(query.get(key));
  }
  return scene;
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

export async function runShot(query, api) {
  const scene = parseScene(query);
  if (scene.shot === 'cover') document.body.classList.add('shot-cover');

  await api.loadSample(scene.photo);
  api.setState(scene.patch);

  // A second sample photo in slot 2 makes the multi-panel layouts show two
  // different photos, like a person who uploaded their own shots.
  if (scene.second) await api.loadSecondSample(scene.second);

  // A named preset, or a seeded surprise, after the samples so the photos
  // it arranges are already loaded; the preset's own adjust wins over any
  // bright/contrast/sat params below it.
  if (scene.preset) api.applyPreset(scene.preset);
  if (scene.random !== null && !Number.isNaN(scene.random)) api.surpriseMe(scene.random);

  // Colour adjust last, so it survives the sample loaders' panel resets.
  if (Object.keys(scene.adjust).length > 0) api.applyAdjust(scene.adjust);

  api.redraw();
  markReady();
}
