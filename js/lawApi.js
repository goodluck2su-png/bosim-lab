(function() {
  function isEnabled() {
    return window.BOSIM_CONFIG && window.BOSIM_CONFIG.features && window.BOSIM_CONFIG.features.LAW_API_ENABLED;
  }

  function featureOn(flag) {
    return window.BOSIM_CONFIG && window.BOSIM_CONFIG.features && window.BOSIM_CONFIG.features[flag];
  }

  async function searchLaw(query, options) {
    if (!isEnabled()) return { disabled: true };
    if (!featureOn('LAW_SEARCH')) return { disabled: true };
    try {
      var params = '?query=' + encodeURIComponent(query);
      if (options) {
        Object.keys(options).forEach(function(k) {
          params += '&' + k + '=' + encodeURIComponent(options[k]);
        });
      }
      var res = await fetch('/api/law-search' + params);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[LawApi] searchLaw error:', e.message);
      return { error: e.message };
    }
  }

  async function getLawDetail(id) {
    if (!isEnabled()) return { disabled: true };
    if (!featureOn('LAW_DETAIL')) return { disabled: true };
    try {
      var res = await fetch('/api/law-detail?id=' + encodeURIComponent(id));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[LawApi] getLawDetail error:', e.message);
      return { error: e.message };
    }
  }

  async function searchInterpret(query) {
    if (!isEnabled()) return { disabled: true };
    if (!featureOn('LAW_INTERPRET')) return { disabled: true };
    try {
      var res = await fetch('/api/law-interpret?query=' + encodeURIComponent(query));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[LawApi] searchInterpret error:', e.message);
      return { error: e.message };
    }
  }

  window.LawApi = {
    searchLaw: searchLaw,
    getLawDetail: getLawDetail,
    searchInterpret: searchInterpret
  };
})();
