/**
 * Загрузка и сохранение контента (без ES-модулей — совместимость с телефонами)
 */
(function () {
  const STORAGE_SESSION = 'workout_admin_session';
  const STORAGE_SESSION_UNTIL = 'workout_admin_until';
  const STORAGE_PASSWORD = 'workout_admin_password_hash';

  let contentData = null;
  let adminConfig = null;

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadAdminConfig() {
    if (adminConfig) return adminConfig;
    try {
      adminConfig = await window.Workout.loadGitHubJson('data/admin-config.json', (data) => typeof data?.passwordHash === 'string');
    } catch {
      adminConfig = {};
    }
    return adminConfig;
  }

  function getPasswordHash() {
    return localStorage.getItem(STORAGE_PASSWORD) || adminConfig?.passwordHash || '';
  }

  async function verifyPassword(password) {
    const hash = await sha256(password);
    return hash === getPasswordHash();
  }

  function isAdminLoggedIn() {
    if (sessionStorage.getItem(STORAGE_SESSION) === '1') return true;
    var until = parseInt(localStorage.getItem(STORAGE_SESSION_UNTIL) || '0', 10);
    if (until > Date.now()) {
      sessionStorage.setItem(STORAGE_SESSION, '1');
      return true;
    }
    return false;
  }

  function setAdminLoggedIn(value) {
    if (value) {
      sessionStorage.setItem(STORAGE_SESSION, '1');
      /* 30 дней на этом устройстве (телефон или ПК) */
      localStorage.setItem(STORAGE_SESSION_UNTIL, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } else {
      sessionStorage.removeItem(STORAGE_SESSION);
      localStorage.removeItem(STORAGE_SESSION_UNTIL);
    }
  }

  function getEditableContent() {
    const draft = window.SiteConfigStore.readDraft('content', (data) => Array.isArray(data?.articles));
    return draft || structuredClone(contentData);
  }

  function saveContentLocal(data) {
    window.SiteConfigStore.saveDraft('content', { ...data, schemaVersion: 1 });
  }

  function downloadContentJson(data) {
    const payload = data || getEditableContent();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importContentFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data?.articles)) throw new Error('Неверный формат');
          saveContentLocal(data);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  function slugId(title) {
    const cyr = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
      к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
      х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    let s = title.toLowerCase().trim();
    s = [...s].map((ch) => cyr[ch] ?? ch).join('');
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return s || 'article-' + Date.now();
  }

  window.WorkoutStore = {
    STORAGE_PASSWORD,
    getContentData: () => contentData,
    getEditableContent,
    setPublishedContent: (data) => { contentData = data; },
    sha256,
    loadAdminConfig,
    getPasswordHash,
    verifyPassword,
    isAdminLoggedIn,
    setAdminLoggedIn,
    saveContentLocal,
    downloadContentJson,
    importContentFromFile,
    slugId,
  };
})();
