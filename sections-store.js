/**
 * Хранение разделов (sections.json)
 */
(function () {
  var sectionsData = null;

  function setPublishedSections(data) {
    sectionsData = window.SectionsGroups.migrateSectionsData(data);
  }

  function getSectionsData() {
    return sectionsData;
  }

  function getEditableSections() {
    var draft = window.SiteConfigStore.readDraft('sections', (data) => Array.isArray(data?.sections));
    return draft ? window.SectionsGroups.migrateSectionsData(draft) : structuredClone(sectionsData);
  }

  function saveSectionsLocal(data) {
    window.SiteConfigStore.saveDraft('sections', data);
  }

  function downloadSectionsJson(data) {
    var payload = data || getEditableSections();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sections.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function findItem(sectionId, itemId, data = sectionsData) {
    var sec = (data?.sections || []).find(function (s) {
      return s.id === sectionId;
    });
    if (!sec) return null;
    var item = (sec.items || []).find(function (it) {
      return it.id === itemId;
    });
    return item ? { section: sec, item: item } : null;
  }

  window.SectionsStore = {
    setPublishedSections: setPublishedSections,
    getSectionsData: getSectionsData,
    getEditableSections: getEditableSections,
    saveSectionsLocal: saveSectionsLocal,
    downloadSectionsJson: downloadSectionsJson,
    findItem: findItem,
  };
})();
