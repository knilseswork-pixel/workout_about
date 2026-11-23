/**
 * Подразделы (кнопки + текст + видео) — единая модель для всего сайта.
 * Поле: subSections (и items — синоним для материалов).
 */
(function () {
  var attachments = window.WorkoutAttachments;
  const escapeHtml = window.WorkoutMedia.escapeHtml;

  function normalizeItem(sub, idFn) {
    var id =
      sub.id ||
      (idFn ? idFn('sub') : 'sub-' + Date.now() + Math.random().toString(36).slice(2, 6));
    return {
      id: id,
      title: sub.title || 'Подраздел',
      body: Array.isArray(sub.body) ? sub.body : sub.body ? [String(sub.body)] : [],
      videos: Array.isArray(sub.videos) ? sub.videos : [],
      photos: attachments.photos(sub),
    };
  }

  /** Список подразделов с объекта (subSections или items). */
  function getList(obj) {
    if (!obj) return [];
    if (Array.isArray(obj.subSections)) return obj.subSections;
    if (Array.isArray(obj.items)) return obj.items;
    return [];
  }

  function hasSubSections(obj) {
    return getList(obj).length > 0;
  }

  function ensureOn(obj, idFn) {
    if (!obj) return obj;
    var list = getList(obj).map(function (sub) {
      return normalizeItem(sub, idFn);
    });
    obj.subSections = list;
    return obj;
  }

  function syncItemsAlias(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj.subSections)) obj.items = obj.subSections;
    else if (Array.isArray(obj.items) && !obj.subSections) obj.subSections = obj.items;
    return obj;
  }

  function renderItemsHtml(items) {
    return (items || [])
      .map(function (item) {
        return (
          '<div class="admin-hub-item" data-hub-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="admin-hub-item__head">' +
          '<label class="admin-field admin-field--grow">Подраздел<input type="text" class="hub-item-title" value="' +
          escapeHtml(item.title) +
          '"></label>' +
          '<button type="button" class="admin-btn admin-btn--sm admin-btn--danger hub-item-del">Удалить</button>' +
          '</div>' +
          '<label class="admin-field">Текст <span class="label-hint">абзацы через пустую строку</span>' +
          '<textarea class="hub-item-body" rows="3">' +
          escapeHtml((item.body || []).join('\n\n')) +
          '</textarea></label>' +
          attachments.renderEditor(item) +
          '</div>'
        );
      })
      .join('');
  }

  function collectFromRoot(rootEl) {
    if (!rootEl) return [];
    var list = [];
    rootEl.querySelectorAll('.admin-hub-item').forEach(function (el) {
      var titleEl = el.querySelector('.hub-item-title');
      var bodyEl = el.querySelector('.hub-item-body');
      list.push({
        id: el.getAttribute('data-hub-id') || 'hub-' + Date.now(),
        title: titleEl ? titleEl.value.trim() || 'Подраздел' : 'Подраздел',
        body: (bodyEl ? bodyEl.value : '')
          .split(/\n\n+/)
          .map(function (p) {
            return p.trim();
          })
          .filter(Boolean),
        ...attachments.collectEditor(el),
      });
    });
    return list;
  }

  function mount(root, items) {
    var rootEl = typeof root === 'string' ? document.querySelector(root) : root;
    if (!rootEl) return { collect: function () { return []; }, refresh: function () {}, root: null };

    function refresh(list) {
      rootEl.innerHTML =
        renderItemsHtml(list) +
        '<p class="hub-items-editor__add"><button type="button" class="admin-btn admin-btn--sm hub-add-item">+ Добавить подраздел</button></p>';
      var addBtn = rootEl.querySelector('.hub-add-item');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var next = collectFromRoot(rootEl);
          next.push({
            id: 'hub-' + Date.now(),
            title: 'Новый подраздел',
            body: [],
            videos: [],
          });
          refresh(next);
        });
      }
    }

    if (!rootEl.dataset.hubBound) {
      rootEl.dataset.hubBound = '1';
      rootEl.addEventListener('click', function (e) {
        if (!e.target.classList.contains('hub-item-del')) return;
        var row = e.target.closest('.admin-hub-item');
        if (!row || !rootEl.contains(row)) return;
        refresh(
          collectFromRoot(rootEl).filter(function (it) {
            return it.id !== row.getAttribute('data-hub-id');
          })
        );
      });
    }

    refresh(items || []);

    return {
      root: rootEl,
      collect: function () {
        return collectFromRoot(rootEl);
      },
      refresh: refresh,
    };
  }

  function nestedMountHtml(mountId) {
    return (
      '<div class="admin-subsection admin-subsection--nested">' +
      '<h5 class="admin-subsection__title-sm">Подразделы</h5>' +
      '<div class="hub-mount editor-hub-items" data-hub-mount="' +
      escapeHtml(mountId) +
      '"></div></div>'
    );
  }

  function collectAll(scopeRoot) {
    var map = {};
    if (!scopeRoot) return map;
    scopeRoot.querySelectorAll('[data-hub-mount]').forEach(function (el) {
      var id = el.getAttribute('data-hub-mount');
      if (id) map[id] = collectFromRoot(el);
    });
    return map;
  }

  function mountAll(scopeRoot, store) {
    if (!scopeRoot || !store) return;
    scopeRoot.querySelectorAll('[data-hub-mount]').forEach(function (el) {
      var id = el.getAttribute('data-hub-mount');
      if (!id) return;
      mount(el, store[id] || []);
    });
  }

  window.WorkoutHubItemsEditor = {
    mount: mount,
    mountAll: mountAll,
    collectFromRoot: collectFromRoot,
    collectAll: collectAll,
    getList: getList,
    hasSubSections: hasSubSections,
    ensureOn: ensureOn,
    syncItemsAlias: syncItemsAlias,
    nestedMountHtml: nestedMountHtml,
    escapeHtml: escapeHtml,
  };
})();
