/**
 * Публикация JSON-файлов в GitHub через REST API.
 * Токен передаётся из админки при каждой публикации (не хранится в коде сайта).
 */
(function () {
  var STORAGE_GH = 'workout_github_token';
  var DEFAULT_REPO   = window.Workout.githubRepo;
  var DEFAULT_BRANCH = window.Workout.githubBranch;

  var FILE_PATHS = {
    siteConfig : 'data/site-config.json',
    content    : 'data/content.json',
    sections   : 'data/sections.json',
  };

  function isPlaceholderToken(token) {
    var t = String(token || '').trim();
    return !t || t === 'YOUR_TOKEN_HERE' || t === 'ghp_xxxxxxxxxxxxxxxx';
  }

  function normalizeToken(token) {
    var t = String(token || '').trim();
    return isPlaceholderToken(t) ? '' : t;
  }

  function apiBase() {
    return 'https://api.github.com/repos/' + DEFAULT_REPO;
  }

  function authHeaderValue(token) {
    var t = normalizeToken(token);
    if (!t) return '';
    if (/^github_pat_/i.test(t)) return 'Bearer ' + t;
    return 'token ' + t;
  }

  function authHeaders(token) {
    return {
      Authorization : authHeaderValue(token),
      Accept        : 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
  }

  async function request(token, url, method = 'GET', data) {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: authHeaders(token),
        body: data === undefined ? undefined : JSON.stringify(data),
        cache: 'no-store',
        signal: AbortSignal.timeout(90000),
      });
    } catch (error) {
      throw new Error('Нет ответа от GitHub. ' + error.message);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const hint = {
        401: 'Проверьте срок действия токена.',
        403: 'Проверьте права токена на Contents и статус лимита запросов.',
        404: 'Проверьте, что токен имеет доступ к репозиторию и ветка существует.',
      }[response.status] || '';
      throw new Error(['GitHub ' + response.status + '.', body?.message, hint].filter(Boolean).join(' '));
    }
    return body;
  }

  function git(token, path, method, data) {
    return request(token, apiBase() + '/git/' + path, method, data);
  }

  function fileEntry(path, source) {
    return { path, mode: '100644', type: 'blob', ...source };
  }

  async function encodeFile(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.toBase64) return bytes.toBase64();
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x6000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x6000));
    }
    return btoa(binary);
  }

  async function checkToken(token) {
    var t = normalizeToken(token);
    if (!t) return { ok: false, reason: 'Введите токен ghp_…' };
    try {
      var user = await request(t, 'https://api.github.com/user');
      await git(t, 'ref/heads/' + DEFAULT_BRANCH);
      return { ok: true, login: user.login };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  async function publishAll(files, onProgress, token) {
    const t = normalizeToken(token);
    if (!t) throw new Error('Введите токен GitHub в поле перед публикацией.');
    const entries = Object.entries(FILE_PATHS)
      .filter(([key]) => files[key] != null)
      .map(([key, path]) => fileEntry(path, { content: JSON.stringify(files[key], null, 2) + '\n' }));
    if (!entries.length) throw new Error('Сначала сохраните изменения в черновике.');

    onProgress?.('Проверяю ветку ' + DEFAULT_BRANCH + '…');
    const refPath = 'heads/' + DEFAULT_BRANCH;
    const parent = (await git(t, 'ref/' + refPath)).object.sha;
    const baseTree = (await git(t, 'commits/' + parent)).tree.sha;
    const attachments = await window.WorkoutAttachments.referencedFiles(files);
    let existing = new Set();
    if (attachments.length) {
      const root = await git(t, 'trees/' + baseTree);
      const directory = root.tree.find((entry) => entry.path === 'attachments' && entry.type === 'tree');
      if (directory) {
        const { tree } = await git(t, 'trees/' + directory.sha);
        existing = new Set(tree.filter((entry) => entry.type === 'blob').map((entry) => 'attachments/' + entry.path));
      }
    }

    const pending = attachments.filter(({ path }) => !existing.has(path));
    if (pending.some(({ blob }) => !blob)) {
      throw new Error('Файл вложения отсутствует в этом браузере и на GitHub. Прикрепите файл заново: ' +
        pending.filter(({ blob }) => !blob).map(({ path }) => path).join(', '));
    }

    for (const [index, { path, blob }] of pending.entries()) {
      onProgress?.('Отправляю вложение ' + (index + 1) + ' из ' + pending.length + '…');
      const result = await git(t, 'blobs', 'POST', { encoding: 'base64', content: await encodeFile(blob) });
      entries.push(fileEntry(path, { sha: result.sha }));
    }

    onProgress?.('Сохраняю изменения на GitHub…');
    const tree = await git(t, 'trees', 'POST', { base_tree: baseTree, tree: entries });
    if (tree.sha === baseTree) return { sha: parent };
    const commit = await git(t, 'commits', 'POST', {
      message: 'Обновление материалов сайта',
      tree: tree.sha,
      parents: [parent],
    });

    try {
      const updated = await git(t, 'refs/' + refPath, 'PATCH', { sha: commit.sha, force: false });
      if (updated?.object?.sha !== commit.sha) throw new Error('GitHub не подтвердил новый коммит.');
    } catch (error) {
      // The server may have updated the branch before the connection dropped.
      const current = await git(t, 'ref/' + refPath).catch(() => null);
      if (current?.object?.sha !== commit.sha) {
        throw new Error(error.message + ' Черновик сохранён. Проверьте ветку ' + DEFAULT_BRANCH + ' перед повтором.');
      }
    }
    return { sha: commit.sha };
  }

  function saveStoredToken(token) {
    var t = normalizeToken(token);
    if (t) localStorage.setItem(STORAGE_GH, t);
    else localStorage.removeItem(STORAGE_GH);
  }

  function loadStoredToken() {
    try {
      return normalizeToken(localStorage.getItem(STORAGE_GH) || '');
    } catch (e) {
      return '';
    }
  }

  function clearStoredToken() {
    try {
      localStorage.removeItem(STORAGE_GH);
      localStorage.removeItem('workout_github_settings');
    } catch (e) { /* ignore */ }
    if (window.__WORKOUT_GH_TOKEN__) window.__WORKOUT_GH_TOKEN__ = '';
  }

  window.GitHubPush = {
    DEFAULT_REPO     : DEFAULT_REPO,
    DEFAULT_BRANCH   : DEFAULT_BRANCH,
    normalizeToken   : normalizeToken,
    checkToken         : checkToken,
    publishAll         : publishAll,
    saveStoredToken    : saveStoredToken,
    loadStoredToken    : loadStoredToken,
    clearStoredToken   : clearStoredToken,
  };
})();
