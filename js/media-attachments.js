/**
 * Local file drafts. JSON stores relative paths and IndexedDB stores the bytes.
 */
(function () {
  const media = window.WorkoutMedia;
  const pathPattern = /^attachments\/[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\.[a-z0-9]+$/;
  const formats = {
    photo: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' },
    video: { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg' },
  };
  const limits = { photo: 10, video: 25 };
  let database;

  function openDatabase() {
    if (!database) {
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open('workout-media', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('files');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        database = null;
        throw error;
      });
    }
    return database;
  }

  async function saveFiles(entries) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      entries.forEach(({ path, blob }) => store.put(blob, path));
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async function referencedFiles(data) {
    const paths = new Set();
    function visit(value) {
      if (typeof value === 'string' && pathPattern.test(value)) paths.add(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    }
    visit(data);
    if (!paths.size) return [];

    const db = await openDatabase().catch(() => null);
    if (!db) return Array.from(paths, (path) => ({ path }));
    const store = db.transaction('files').objectStore('files');
    return Promise.all(Array.from(paths, (path) => new Promise((resolve, reject) => {
      const request = store.get(path);
      request.onsuccess = () => resolve({ path, blob: request.result });
      request.onerror = () => reject(request.error);
    })));
  }

  function assetUrl(path) {
    return media.resolveUrl(path);
  }

  function photos(data) {
    return [...new Set([...(Array.isArray(data.photos) ? data.photos : []), data.photo].filter(Boolean))];
  }

  function formatVideos(videos) {
    return (videos || []).filter(Boolean).map((v) => (v.title || 'Видео') + ' | ' + (v.embed || v.src || '')).join('\n');
  }

  function parseVideos(text) {
    return text.split('\n').map((line, i) => {
      const divider = line.indexOf('|');
      const title = (divider >= 0 && line.slice(0, divider).trim()) || 'Видео ' + (i + 1);
      let url = line.slice(divider + 1).trim();
      const iframe = url.match(/src=["']([^"']+)["']/i);
      if (iframe) url = iframe[1].replace(/&amp;/g, '&');
      if (!url) return null;
      const video = media.normalizeVideo(url);
      return video.type === 'embed' ? { title, embed: video.url } : { title, src: url };
    }).filter(Boolean);
  }

  function renderEditor(data) {
    return '<div class="admin-media-editor">' +
      '<label class="admin-field">Фото <span class="label-hint">одна ссылка на строку</span>' +
      '<textarea data-media-links="photo" rows="2">' + media.escapeHtml(photos(data).join('\n')) + '</textarea></label>' +
      '<label class="admin-field">Прикрепить фото <span class="label-hint">до 10 МБ на файл</span>' +
      '<input type="file" data-media-file="photo" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" multiple></label>' +
      '<label class="admin-field">Видео <span class="label-hint">название | ссылка VK, YouTube, Google Drive или прямой URL</span>' +
      '<textarea data-media-links="video" rows="2">' + media.escapeHtml(formatVideos(data.videos)) + '</textarea></label>' +
      '<label class="admin-field">Прикрепить видео <span class="label-hint">до 25 МБ на файл</span>' +
      '<input type="file" data-media-file="video" accept=".mp4,.m4v,.webm,.mov,.ogv" multiple></label>' +
      '<p class="admin-media-status" aria-live="polite" hidden></p></div>';
  }

  function collectEditor(root) {
    const editor = root?.querySelector('.admin-media-editor');
    const read = (kind) => editor?.querySelector('[data-media-links="' + kind + '"]').value || '';
    return {
      photos: [...new Set(read('photo').split('\n').map((line) => line.trim()).filter(Boolean))],
      videos: parseVideos(read('video')),
    };
  }

  function prepareFile(file, kind) {
    const extension = file.name.split('.').pop().toLowerCase();
    const type = formats[kind][extension];
    if (!type || !file.size) throw new Error('Проверьте формат и размер файла «' + file.name + '».');
    if (file.size > limits[kind] * 1024 * 1024) {
      throw new Error('Файл «' + file.name + '» больше ' + limits[kind] + ' МБ. Добавьте его по ссылке.');
    }
    return {
      path: 'attachments/' + crypto.randomUUID() + '.' + extension,
      blob: file.slice(0, file.size, type),
      title: file.name.replace(/\.[^.]+$/, '').replace(/[|\r\n]+/g, ' ').trim(),
    };
  }

  document.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-media-file]');
    if (!input || !input.files.length) return;
    const kind = input.dataset.mediaFile;
    const editor = input.closest('.admin-media-editor');
    const links = editor.querySelector('[data-media-links="' + kind + '"]');
    const status = editor.querySelector('.admin-media-status');
    const app = document.querySelector('#adminApp');
    const wasInert = app.inert;
    app.inert = true;
    status.hidden = false;
    status.textContent = 'Прикрепляю файлы…';
    try {
      const entries = Array.from(input.files, (file) => prepareFile(file, kind));
      await saveFiles(entries);
      const lines = entries.map(({ path, title }) => kind === 'photo' ? path : (title || 'Видео') + ' | ' + path);
      links.value = [links.value.trim(), ...lines].filter(Boolean).join('\n');
      status.textContent = 'Файлы прикреплены. Сохраните черновик.';
    } catch (error) {
      status.textContent = 'Не удалось прикрепить файлы. ' + (error?.message || 'Проверьте свободное место в браузере.');
    } finally {
      app.inert = wasInert;
      input.value = '';
    }
  });

  window.WorkoutAttachments = { assetUrl, photos, renderEditor, collectEditor, referencedFiles };
})();
