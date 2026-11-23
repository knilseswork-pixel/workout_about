/**
 * Конфигурация сайта (навигация, страницы) — site-config.json
 */
(function () {
  var STORAGE_CONFIG = 'workout_site_config_data';
  var STORAGE_DRAFT = 'workout_site_draft_enabled';
  var draftKeys = {
    siteConfig: STORAGE_CONFIG,
    content: 'workout_content_data',
    sections: 'workout_sections_data',
  };

  var siteConfig = null;

  function assetUrl(path) {
    return window.Workout && window.Workout.assetUrl ? window.Workout.assetUrl(path) : path;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isDraftEnabled() {
    try {
      return Object.values(draftKeys).some((key) => localStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function readDraft(key, serverData, validate) {
    try {
      var raw = localStorage.getItem(draftKeys[key]);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!validate(data)) return null;
      if (serverData && raw === JSON.stringify(serverData)) {
        localStorage.removeItem(draftKeys[key]);
        return null;
      }
      return data;
    } catch (error) {
      return null;
    }
  }

  function saveDraft(key, data) {
    try {
      localStorage.setItem(draftKeys[key], JSON.stringify(data));
    } catch (error) {
      throw new Error('Не удалось записать черновик в браузер. Проверьте доступ и свободное место.');
    }
  }

  function getDraftFiles() {
    return Object.fromEntries(Object.entries(draftKeys)
      .map(([key, name]) => [key, localStorage.getItem(name)])
      .filter(([, raw]) => raw)
      .map(([key, raw]) => [key, JSON.parse(raw)]));
  }

  function getDefaultConfig() {
    if (window.WORKOUT_SITE_CONFIG) return clone(window.WORKOUT_SITE_CONFIG);
    return {
      version: 1,
      site: { heroBadge: '', heroTitle: 'WORKOUT', heroText: '' },
      mainTabs: [
        { id: 'materials', label: 'Материалы', type: 'materials' },
        { id: 'sections', label: 'База элементов', type: 'sections' },
      ],
      materialFilters: [{ id: 'all', label: 'Все', category: '' }],
      customPages: [],
    };
  }

  async function loadSiteConfig() {
    var serverData = null;
    var urls = [assetUrl('data/site-config.json'), assetUrl('data/site-config.json') + '?t=' + Date.now()];

    for (var i = 0; i < urls.length && !serverData; i++) {
      try {
        var res = await fetch(urls[i], { cache: 'no-store' });
        if (res.ok) {
          var data = await res.json();
          if (Array.isArray(data?.mainTabs) && Array.isArray(data?.materialFilters) && Array.isArray(data?.customPages)) {
            serverData = data;
          }
        }
      } catch (e) {
        /* next */
      }
    }

    siteConfig = readDraft('siteConfig', serverData, (data) => Array.isArray(data?.mainTabs))
      || serverData || getDefaultConfig();
    return siteConfig;
  }

  function getSiteConfig() {
    return siteConfig;
  }

  function saveSiteConfigLocal(data) {
    saveDraft('siteConfig', data);
    siteConfig = data;
  }

  function clearSiteConfigLocal() {
    localStorage.removeItem(STORAGE_CONFIG);
  }

  function downloadSiteConfigJson(data) {
    var payload = data || siteConfig;
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function getCategories() {
    var filters = (siteConfig && siteConfig.materialFilters) || [];
    return filters
      .map(function (f) {
        return f.category;
      })
      .filter(function (c) {
        return c && String(c).trim();
      });
  }

  window.SiteConfigStore = {
    loadSiteConfig: loadSiteConfig,
    getSiteConfig: getSiteConfig,
    saveSiteConfigLocal: saveSiteConfigLocal,
    clearSiteConfigLocal: clearSiteConfigLocal,
    downloadSiteConfigJson: downloadSiteConfigJson,
    getCategories: getCategories,
    isDraftEnabled: isDraftEnabled,
    readDraft: readDraft,
    saveDraft: saveDraft,
    getDraftFiles: getDraftFiles,
    clearAllDrafts: function () {
      localStorage.removeItem(STORAGE_DRAFT);
      clearSiteConfigLocal();
      localStorage.removeItem('workout_content_data');
      localStorage.removeItem('workout_sections_data');
    },
  };
})();
