// Fixed scenes for screenshots: ?shot=editor shows the app with a sample
// photo loaded; ?shot=cover shows the cover alone, full frame. Query params
// pick the scene: photo (pier|boulevard), second (a second sample photo for
// alternating panels), layout, grade, size, title, subtitle, stars.
// window.__shotReady is set once the scene is painted.
export async function runShot(query, api) {
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('shot-cover');

  await api.loadSample(query.get('photo') ?? 'pier');

  const patch = {};
  if (query.get('layout')) patch.layout = query.get('layout');
  if (query.get('grade')) patch.grade = query.get('grade');
  if (query.get('size')) patch.size = query.get('size');
  if (query.get('title')) patch.title = query.get('title');
  if (query.get('subtitle') !== null) patch.subtitle = query.get('subtitle');
  if (query.get('stars')) patch.stars = Number(query.get('stars'));
  api.setState(patch);

  // A second sample photo in slot 2 makes the multi-panel layouts show two
  // different photos, like a person who uploaded their own shots.
  if (query.get('second')) await api.loadSecondSample(query.get('second'));

  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
