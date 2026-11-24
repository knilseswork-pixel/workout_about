/**
 * Панель администратора — редактирование без кода
 */
(function () {
  const S = window.WorkoutStore;
  const attachments = window.WorkoutAttachments;
  const STORAGE_PASSWORD = S.STORAGE_PASSWORD;
  const getContentData = () => S.getEditableContent();
  const downloadContentJson = () => S.downloadContentJson();
  const importContentFromFile = (f) => S.importContentFromFile(f);
  const isAdminLoggedIn = () => S.isAdminLoggedIn();
  const loadAdminConfig = () => S.loadAdminConfig();
  const saveContentLocal = (d) => S.saveContentLocal(d);
  const setAdminLoggedIn = (v) => S.setAdminLoggedIn(v);
  const sha256 = (t) => S.sha256(t);
  const slugId = (t) => S.slugId(t);
  const verifyPassword = (p) => S.verifyPassword(p);

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.prototype.slice.call(root.querySelectorAll(sel));

  const CATEGORIES = ['Методика', 'Разминка', 'Соревнования', 'Клиенты', 'Первая помощь'];

let editingId = null;
let materialHubEditor = null;

function openAdmin() {
  $('#adminPanel')?.classList.add('is-open');
  $('#adminPanel')?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('admin-open');
  renderAdminList();
  if (window.SectionsAdmin) window.SectionsAdmin.renderList();
}

function closeAdmin() {
  $('#adminPanel')?.classList.remove('is-open');
  $('#adminPanel')?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('admin-open');
  hideEditor();
}

function showLogin() {
  $('#adminLogin')?.classList.remove('hidden');
  $('#adminApp')?.classList.add('hidden');
}

function showApp() {
  $('#adminLogin')?.classList.add('hidden');
  $('#adminApp')?.classList.remove('hidden');
  if (window.SectionsAdmin) window.SectionsAdmin.renderList();
}

async function tryLogin(password) {
  if (await verifyPassword(password)) {
    setAdminLoggedIn(true);
    showApp();
    return true;
  }
  return false;
}

function renderAdminList() {
  const list = $('#adminArticleList');
  const data = getContentData();
  if (!list || !data) return;

  var articles = data.articles || [];
  if (window.WorkoutLevelSort) {
    articles = window.WorkoutLevelSort.sortByLevel(articles);
  }

  list.innerHTML = articles
    .map(
      (a) => `
    <li class="admin-list__item">
      <div class="admin-list__info">
        <strong>${escapeHtml(a.title)}</strong>
        <span>${escapeHtml(a.category)} · ${escapeHtml(a.date)}</span>
      </div>
      <div class="admin-list__actions">
        <button type="button" class="admin-btn admin-btn--sm" data-edit="${escapeHtml(a.id)}">Изменить</button>
        <button type="button" class="admin-btn admin-btn--sm admin-btn--danger" data-del="${escapeHtml(a.id)}">Удалить</button>
      </div>
    </li>`
    )
    .join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openEditor(btn.dataset.edit));
  });
  list.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteArticle(btn.dataset.del));
  });
}

const escapeHtml = window.WorkoutMedia.escapeHtml;

function hideEditor() {
  editingId = null;
  $('#adminEditor')?.classList.add('hidden');
}

function mountMaterialHubEditor(items) {
  if (!window.WorkoutHubItemsEditor) return null;
  var root = $('#editorHubItems');
  materialHubEditor = window.WorkoutHubItemsEditor.mount(root, items || []);
  return materialHubEditor;
}

function openEditor(id = null) {
  editingId = id;
  const editor = $('#adminEditor');
  editor?.classList.remove('hidden');

  const data = getContentData();
  const article = id ? data.articles.find((a) => a.id === id) : null;
  const hubItems = window.WorkoutHubItemsEditor
    ? window.WorkoutHubItemsEditor.getList(article || {})
    : article?.items || article?.subSections || [];

  $('#editorTitle').value = article?.title || '';
  $('#editorExcerpt').value = article?.excerpt || '';
  $('#editorDate').value = article?.date || new Date().toISOString().slice(0, 10);
  if (window.WorkoutMain && window.WorkoutMain.populateCategorySelect) {
    window.WorkoutMain.populateCategorySelect();
  }
  $('#editorCategory').value = article?.category || 'Методика';
  $('#editorBody').value = (article?.body || []).join('\n\n');
  $('#editorAttachments').innerHTML = attachments.renderEditor(article || {});

  mountMaterialHubEditor(hubItems);
}

function collectEditorData() {
  const title = $('#editorTitle').value.trim();
  const excerpt = $('#editorExcerpt').value.trim();
  const date = $('#editorDate').value || new Date().toISOString().slice(0, 10);
  const category = $('#editorCategory').value;
  const data = getContentData();
  const existing = editingId ? data.articles.find((a) => a.id === editingId) : null;

  const items = materialHubEditor ? materialHubEditor.collect() : [];
  const media = attachments.collectEditor($('#editorAttachments'));

  const body = $('#editorBody').value
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (items.length > 0) {
    const hub = {
      ...existing,
      id: articleId(data, title),
      title,
      excerpt,
      date,
      category,
      type: 'hub',
      subSections: items,
      items: items,
      body,
      ...media,
      accent: existing?.accent || '#FF2D2D',
    };
    delete hub.photo;
    if (window.WorkoutHubItemsEditor) window.WorkoutHubItemsEditor.syncItemsAlias(hub);
    return hub;
  }

  const plain = {
    ...existing,
    id: articleId(data, title),
    title,
    excerpt,
    date,
    category,
    accent: existing?.accent || '#FF2D2D',
    body,
    ...media,
  };
  delete plain.photo;
  delete plain.type;
  delete plain.items;
  delete plain.subSections;
  return plain;
}

function articleId(data, title) {
  const id = editingId || slugId(title);
  return !editingId && data.articles.some((a) => a.id === id) ? id + '-' + Date.now() : id;
}

function saveArticle() {
  const article = collectEditorData();
  if (!article.title) {
    showToast('Введите название материала');
    return;
  }
  const current = getContentData();
  const data = { ...current, articles: current.articles.slice() };
  const idx = data.articles.findIndex((a) => a.id === article.id);
  if (idx >= 0) data.articles[idx] = article;
  else data.articles.unshift(article);

  try {
    saveContentLocal(data);
  } catch (error) {
    showToast(error.message);
    return;
  }
  renderAdminList();
  hideEditor();
  showToast('Черновик материала сохранён в этом браузере');
}

function deleteArticle(id) {
  if (!confirm('Удалить этот материал?')) return;
  const data = getContentData();
  try {
    saveContentLocal({ ...data, articles: data.articles.filter((a) => a.id !== id) });
  } catch (error) {
    showToast(error.message);
    return;
  }
  renderAdminList();
  showToast('Материал удалён из черновика');
}

function showToast(msg) {
  const t = $('#adminToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-visible');
  setTimeout(() => t.classList.remove('is-visible'), 2800);
}

async function changePassword() {
  const p1 = $('#newPassword').value;
  const p2 = $('#newPassword2').value;
  if (p1.length < 4) {
    alert('Пароль минимум 4 символа');
    return;
  }
  if (p1 !== p2) {
    alert('Пароли не совпадают');
    return;
  }
  localStorage.setItem(STORAGE_PASSWORD, await sha256(p1));
  $('#newPassword').value = '';
  $('#newPassword2').value = '';
  showToast('Пароль изменён');
}

function openAdminEntry() {
  if (isAdminLoggedIn()) {
    openAdmin();
    showApp();
  } else {
    openAdmin();
    showLogin();
    requestAnimationFrame(function () {
      var input = $('#adminPassword');
      if (input) input.focus();
    });
  }
  if (history.replaceState) {
    history.replaceState(null, '', '#admin');
  } else {
    location.hash = 'admin';
  }
}

function closeAdminPanel() {
  closeAdmin();
  if (location.hash === '#admin' && history.replaceState) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function shouldOpenAdminFromUrl() {
  if (location.hash === '#admin') return true;
  try {
    return new URLSearchParams(location.search).get('admin') === '1';
  } catch (e) {
    return false;
  }
}

function getGhTokenFromInput() {
  var el = $('#ghToken');
  return el ? String(el.value || '').trim() : '';
}

function getGhTokenForUse() {
  var fromInput = getGhTokenFromInput();
  if (fromInput) return fromInput;
  if (window.GitHubPush) return window.GitHubPush.loadStoredToken();
  return '';
}

function setGhTokenInput(value) {
  var el = $('#ghToken');
  if (el) el.value = value || '';
}

function loadGhSettings() {
  if (!window.GitHubPush) return;
  var saved = window.GitHubPush.loadStoredToken();
  if (saved) {
    setGhTokenInput(saved);
    updatePublishHint('✓ Токен сохранён в этом браузере', true);
  } else {
    updatePublishHint();
  }
}

function updatePublishHint(text, ok) {
  var hint = $('#publishGhStatus');
  if (!hint) return;
  if (text) {
    hint.textContent = text;
    hint.style.color = ok ? '#4ade80' : ok === false ? '#f87171' : '';
    return;
  }
  hint.textContent = 'Введите токен и нажмите «Проверить» или сразу «Опубликовать».';
  hint.style.color = '';
}

function bindGhEvents() {
  var ghSaveBtn = $('#ghSaveBtn');
  if (ghSaveBtn) {
    ghSaveBtn.addEventListener('click', async function () {
      if (!window.GitHubPush) return;
      var token = getGhTokenFromInput();
      if (!token) {
        showToast('Вставьте токен ghp_…');
        updatePublishHint('Введите токен перед сохранением', false);
        return;
      }
      var check = await window.GitHubPush.checkToken(token);
      if (!check.ok) {
        updatePublishHint('✗ ' + (check.reason || 'Токен не принят'), false);
        showToast('Токен не принят GitHub');
        return;
      }
      try {
        window.GitHubPush.saveStoredToken(token);
      } catch (error) {
        updatePublishHint('Не удалось сохранить токен в браузере. Его можно использовать из поля ввода.', false);
        return;
      }
      updatePublishHint('✓ Токен сохранён (' + check.login + ') в этом браузере', true);
      showToast('Токен сохранён');
    });
  }

  var ghClearBtn = $('#ghClearBtn');
  if (ghClearBtn) {
    ghClearBtn.addEventListener('click', function () {
      if (!window.GitHubPush) return;
      window.GitHubPush.clearStoredToken();
      setGhTokenInput('');
      updatePublishHint('Сохранённый токен удалён');
      showToast('Токен удалён');
    });
  }

  var ghCheckBtn = $('#ghCheckBtn');
  if (ghCheckBtn) {
    ghCheckBtn.addEventListener('click', async function () {
      if (!window.GitHubPush) return;
      var token = getGhTokenForUse();
      if (!token) {
        showToast('Вставьте токен ghp_…');
        updatePublishHint('Введите токен GitHub', false);
        return;
      }
      var btn = ghCheckBtn;
      btn.disabled = true;
      btn.textContent = 'Проверяю…';
      updatePublishHint('Проверяю токен…', null);
      try {
        var result = await window.GitHubPush.checkToken(token);
        if (result.ok) {
          updatePublishHint('Токен принят (' + result.login + '). Ветка доступна для чтения. Право записи проверяется при публикации.', true);
        } else {
          updatePublishHint('✗ ' + (result.reason || 'Токен не принят'), false);
        }
      } catch (e) {
        updatePublishHint('✗ ' + e.message, false);
      }
      btn.disabled = false;
      btn.textContent = 'Проверить токен';
    });
  }

  var publishGhBtn = $('#adminPublishGitHub');
  if (publishGhBtn) {
    publishGhBtn.addEventListener('click', async function () {
      if (!window.GitHubPush) {
        showToast('Модуль github-push.js не загружен');
        return;
      }

      var token = getGhTokenForUse();
      if (!token) {
        alert('Введите токен GitHub (ghp_…) или нажмите «Сохранить токен» после ввода.');
        return;
      }

      var btn = publishGhBtn;
      var origText = btn.textContent;
      btn.disabled = true;
      var commitLink = $('#publishGhCommit');
      commitLink.hidden = true;

      try {
        var files = window.SiteConfigStore.getDraftFiles();
        var result = await window.GitHubPush.publishAll(
          files,
          function (msg) {
            updatePublishHint(msg);
          },
          token
        );
        commitLink.href = 'https://github.com/' + window.GitHubPush.DEFAULT_REPO + '/commit/' + result.sha;
        commitLink.textContent = 'Открыть коммит ' + result.sha.slice(0, 7);
        commitLink.hidden = false;
        window.SiteConfigStore.clearPublishedDrafts(files);
        updatePublishHint('GitHub подтвердил коммит. Загружаю опубликованные данные…', true);
        try {
          await window.WorkoutMain.refreshPublished(result.sha);
          hideEditor();
          renderAdminList();
          window.SiteBuilder.render();
          updatePublishHint('Данные опубликованы и загружены с GitHub.', true);
        } catch (error) {
          updatePublishHint('Коммит сохранён на GitHub. ' + error.message + ' Обновите страницу.', false);
        }
        showToast('Сохранено на GitHub');
      } catch (e) {
        updatePublishHint('Публикация не подтверждена. ' + e.message, false);
        showToast('Ошибка: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });
  }

  loadGhSettings();
}

function bindAdminEvents() {
  document.querySelectorAll('[data-admin-open]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openAdminEntry();
    });
  });

  var closeBtn = $('#adminCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeAdminPanel);
  var backdrop = $('#adminBackdrop');
  if (backdrop) backdrop.addEventListener('click', closeAdminPanel);

  window.addEventListener('hashchange', function () {
    if (location.hash === '#admin' && !$('#adminPanel').classList.contains('is-open')) {
      openAdminEntry();
    }
  });

  $('#adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await tryLogin($('#adminPassword').value);
    if (!ok) {
      $('#adminLoginError').textContent = 'Неверный пароль';
      return;
    }
    $('#adminLoginError').textContent = '';
    $('#adminPassword').value = '';
  });

  $('#adminLogout')?.addEventListener('click', () => {
    setAdminLoggedIn(false);
    showLogin();
    showToast('Вы вышли');
  });

  $('#adminAddBtn')?.addEventListener('click', () => openEditor(null));
  $('#editorCancel')?.addEventListener('click', hideEditor);
  $('#editorSave')?.addEventListener('click', saveArticle);

  $('#adminDownloadConfig')?.addEventListener('click', () => {
    if (window.SiteConfigStore) {
      window.SiteConfigStore.downloadSiteConfigJson();
      showToast('site-config.json скачан');
    }
  });

  $('#adminDownload')?.addEventListener('click', () => {
    downloadContentJson();
    showToast('Файл content.json скачан — загрузите в GitHub');
  });

  $('#adminImport')?.addEventListener('click', () => $('#adminImportFile').click());
  $('#adminImportFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importContentFromFile(file);
      renderAdminList();
      showToast('Импорт выполнен');
    } catch {
      alert('Не удалось прочитать файл');
    }
    e.target.value = '';
  });

  $('#adminReset')?.addEventListener('click', () => {
    if (!confirm('Сбросить все локальные черновики?')) return;
    window.SiteConfigStore.clearAllDrafts();
    hideEditor();
    renderAdminList();
    window.SectionsAdmin.resetEditor();
    window.SiteBuilder.render();
    showToast('Черновики сброшены');
  });

  bindGhEvents();

  var changePwdBtn = $('#changePasswordBtn');
  if (changePwdBtn) changePwdBtn.addEventListener('click', changePassword);

  $$('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.admin-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      $$('.admin-tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.tab !== tab.dataset.tab));
      if (tab.dataset.tab === 'sections' && window.SectionsAdmin) {
        window.SectionsAdmin.renderList();
      }
      if (tab.dataset.tab === 'builder' && window.SiteBuilder) {
        window.SiteBuilder.render();
      }
    });
  });
}

  async function initAdmin() {
    await loadAdminConfig();
    bindAdminEvents();
    if (shouldOpenAdminFromUrl()) {
      openAdminEntry();
    }
  }

  window.WorkoutAdmin = {
    init: initAdmin,
    open: openAdminEntry,
    close: closeAdminPanel,
    applyGhSettings: loadGhSettings,
  };
})();
