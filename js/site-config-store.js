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

  function readDraft(key, validate) {
    try {
      var data = JSON.parse(localStorage.getItem(draftKeys[key]));
      return validate(data) ? data : null;
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

  function getSiteConfig() {
    return siteConfig;
  }

  function getEditableSiteConfig() {
    return readDraft('siteConfig', (data) => Array.isArray(data?.mainTabs)) || structuredClone(siteConfig);
  }

  function clearDraft(key) {
    localStorage.removeItem(draftKeys[key]);
  }

  function clearPublishedDrafts(files) {
    Object.entries(files).forEach(([key, data]) => {
      if (localStorage.getItem(draftKeys[key]) === JSON.stringify(data)) clearDraft(key);
    });
  }

  function downloadSiteConfigJson(data) {
    var payload = data || getEditableSiteConfig();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function getCategories() {
    var filters = getEditableSiteConfig()?.materialFilters || [];
    return filters
      .map(function (f) {
        return f.category;
      })
      .filter(function (c) {
        return c && String(c).trim();
      });
  }

  window.SiteConfigStore = {
    setPublishedSiteConfig: (data) => { siteConfig = data; },
    getSiteConfig: getSiteConfig,
    getEditableSiteConfig: getEditableSiteConfig,
    saveSiteConfigLocal: (data) => saveDraft('siteConfig', data),
    downloadSiteConfigJson: downloadSiteConfigJson,
    getCategories: getCategories,
    readDraft: readDraft,
    saveDraft: saveDraft,
    getDraftFiles: getDraftFiles,
    clearDraft: clearDraft,
    clearPublishedDrafts: clearPublishedDrafts,
    clearAllDrafts: function () {
      localStorage.removeItem(STORAGE_DRAFT);
      Object.keys(draftKeys).forEach(clearDraft);
    },
  };
})();
