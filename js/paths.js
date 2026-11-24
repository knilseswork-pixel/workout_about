/**
 * Базовый путь для GitHub Pages (репозиторий в подпапке, напр. /site/)
 */
(function () {
  const githubRepo = 'knilseswork-pixel/workout_about';
  const githubBranch = 'main';

  function detectBase() {
    const path = window.location.pathname || '/';
    if (path.endsWith('/')) return path;
    if (/\.(html?)$/i.test(path)) {
      const base = path.replace(/\/[^/]*$/, '/');
      return base || '/';
    }
    return path + '/';
  }

  window.Workout = window.Workout || {};
  window.Workout.basePath = detectBase();

  window.Workout.assetUrl = function (relativePath) {
    const clean = String(relativePath).replace(/^\//, '');
    if (window.location.protocol === 'file:') return new URL(clean, document.baseURI).href;
    return window.Workout.basePath + clean;
  };

  window.Workout.githubRepo = githubRepo;
  window.Workout.githubBranch = githubBranch;
  window.Workout.githubFileUrl = function (path, revision = githubBranch) {
    return 'https://raw.githubusercontent.com/' + githubRepo + '/' + revision + '/' + path.replace(/^\//, '');
  };

  window.Workout.loadGitHubJson = async function (path, validate, revision) {
    const url = new URL(window.Workout.githubFileUrl(path, revision));
    url.searchParams.set('fresh', Date.now() + '-' + Math.random().toString(36).slice(2));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url.href, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!validate(data)) throw new Error('Неверный формат JSON');
      return data;
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'превышено время ожидания' : error.message;
      throw new Error('Не удалось загрузить ' + path + ' с GitHub (' + reason + ').');
    } finally {
      clearTimeout(timeout);
    }
  };

  /* Подсказка в консоли при отладке на телефоне */
  window.Workout.debugBase = window.Workout.basePath;
})();
