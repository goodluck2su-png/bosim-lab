(function () {
  var SUPABASE_URL = 'https://dorocsjhtamcjxwhlqbl.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_p1LTrTrBX3XX6NMK7e4Fig_tdQ4Fm2v';

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var sessionId = sessionStorage.getItem('bosim_sid');
  var isNew = false;
  if (!sessionId) {
    sessionId = newId();
    sessionStorage.setItem('bosim_sid', sessionId);
    isNew = true;
  }

  var payload = {
    session_id: sessionId,
    path: location.pathname + location.search,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent.slice(0, 300),
    screen_w: window.screen ? window.screen.width : null,
    screen_h: window.screen ? window.screen.height : null,
    is_new_session: isNew
  };

  try {
    fetch(SUPABASE_URL + '/rest/v1/page_views', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
