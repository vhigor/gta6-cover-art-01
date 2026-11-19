// Fixed scenes for screenshots: ?shot=editor shows the app with a sample
// photo loaded; ?shot=cover shows the cover alone, full frame.
//
// Query params pick the scene:
//   photo (pier|boulevard), second (a second sample photo for alternating
//   panels), layout, grade, size, title, subtitle, stars,
//   bright / contrast / sat (colour adjust applied to every panel, so a
//   screenshot can show the adjust sliders doing real work).
// window.__shotReady is set once the scene is painted.
function parseScene(query) {
  const scene = {
    shot: query.get('shot'),
    photo: query.get('photo') ?? 'pier',
    second: query.get('second'),
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

  // Colour adjust last, so it survives the sample loaders' panel resets.
  if (Object.keys(scene.adjust).length > 0) api.applyAdjust(scene.adjust);

  api.redraw();
  markReady();
}
