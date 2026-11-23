/**
 * Хранение разделов (sections.json)
 */
(function () {
  var sectionsData = null;

  function assetUrl(path) {
    return window.Workout && window.Workout.assetUrl ? window.Workout.assetUrl(path) : path;
  }

  async function loadSections() {
    var serverData = null;

    var urls = [assetUrl('data/sections.json'), assetUrl('data/sections.json') + '?t=' + Date.now()];
    for (var i = 0; i < urls.length && !serverData; i++) {
      try {
        var res = await fetch(urls[i], { cache: 'no-store' });
        if (res.ok) {
          var data = await res.json();
          if (Array.isArray(data?.sections)) serverData = data;
        }
      } catch (e) {
        /* next */
      }
    }

    var draft = window.SiteConfigStore.readDraft('sections', serverData, (data) => Array.isArray(data?.sections));
    sectionsData = draft || serverData || JSON.parse(JSON.stringify(window.WORKOUT_SECTIONS || { sections: [] }));

    if (window.SectionsGroups && window.SectionsGroups.migrateSectionsData) {
      sectionsData = window.SectionsGroups.migrateSectionsData(sectionsData);
    }

    return sectionsData;
  }

  function getSectionsData() {
    return sectionsData;
  }

  function saveSectionsLocal(data) {
    window.SiteConfigStore.saveDraft('sections', data);
    sectionsData = data;
  }

  function downloadSectionsJson(data) {
    var payload = data || sectionsData;
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sections.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function findItem(sectionId, itemId) {
    var sec = (sectionsData.sections || []).find(function (s) {
      return s.id === sectionId;
    });
    if (!sec) return null;
    var item = (sec.items || []).find(function (it) {
      return it.id === itemId;
    });
    return item ? { section: sec, item: item } : null;
  }

  window.SectionsStore = {
    loadSections: loadSections,
    getSectionsData: getSectionsData,
    saveSectionsLocal: saveSectionsLocal,
    downloadSectionsJson: downloadSectionsJson,
    findItem: findItem,
  };
})();
