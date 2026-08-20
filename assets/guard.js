/*
  CDP page guard — include as the FIRST script in <head> with a data-page
  attribute, e.g. <script src="assets/guard.js" data-page="dashboard"></script>
  Runs synchronously (no async/defer) so it can block rendering before any
  protected page content is parsed. Reads the session written by assets/auth.js
  at login time — see that file for the session shape and security notes.
*/
(function () {
  const SESSION_KEY = 'cdp_session';
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, must match assets/auth.js

  const scriptEl = document.currentScript;
  const pageId = scriptEl && scriptEl.getAttribute('data-page');
  // Resolve the project root relative to THIS script's own location, so any
  // page can include this file from any folder depth without edits here.
  const ROOT = scriptEl ? scriptEl.src.replace(/assets\/guard\.js(?:\?.*)?(?:#.*)?$/, '') : '';

  function isAllowed() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    let session;
    try { session = JSON.parse(raw); } catch (e) { return false; }
    if (!session.loginAt || Date.now() - session.loginAt > SESSION_TTL_MS) return false;
    if (pageId === 'admin') return session.role === 'superadmin';
    return Array.isArray(session.permissions) && session.permissions.indexOf(pageId) !== -1;
  }

  if (!isAllowed()) {
    window.location.replace(ROOT + 'index.html?denied=' + encodeURIComponent(pageId || ''));
    document.documentElement.innerHTML = '';
  }
})();
