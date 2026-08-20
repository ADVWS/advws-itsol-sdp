/*
  CDP Auth — client-side login/permission layer for a static GitHub Pages site.

  IMPORTANT SECURITY NOTE
  GitHub Pages has no server or database. This file, data/users.json, and every
  password hash in it are publicly downloadable by anyone who visits the site.
  This is an access GATE for an internal/demo tool, not real authentication —
  do not use it to protect real, sensitive personal data. Passwords are never
  stored in plaintext (only salted, iterated SHA-256 hashes), but a public hash
  can still be brute-forced offline given enough time. See README.md.
*/
(function (global) {
  const SESSION_KEY = 'cdp_session';
  const USERS_OVERRIDE_KEY = 'cdp_users_override';
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
  const HASH_ITERATIONS = 1000;

  // Resolve the project root relative to THIS script's own location, so any
  // page can include this file from any folder depth (e.g. "assets/auth.js"
  // from the root, or "../assets/auth.js" from pages/) without edits here.
  const _scriptEl = document.currentScript;
  const ROOT = _scriptEl ? _scriptEl.src.replace(/assets\/auth\.js(?:\?.*)?(?:#.*)?$/, '') : '';

  async function sha256Hex(text) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function hashPassword(password, salt, iterations = HASH_ITERATIONS) {
    let data = salt + ':' + password;
    for (let i = 0; i < iterations; i++) {
      data = await sha256Hex(data);
    }
    return data;
  }

  function randomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadUsers() {
    const override = localStorage.getItem(USERS_OVERRIDE_KEY);
    if (override) {
      try { return JSON.parse(override); } catch (e) { /* fall through to file */ }
    }
    const res = await fetch(ROOT + 'data/users.json', { cache: 'no-store' });
    const json = await res.json();
    return json.users;
  }

  function saveUsersOverride(usersArray) {
    localStorage.setItem(USERS_OVERRIDE_KEY, JSON.stringify(usersArray));
  }

  function hasUsersOverride() {
    return localStorage.getItem(USERS_OVERRIDE_KEY) !== null;
  }

  function clearUsersOverride() {
    localStorage.removeItem(USERS_OVERRIDE_KEY);
  }

  async function loadPages() {
    const res = await fetch(ROOT + 'data/pages.json', { cache: 'no-store' });
    const json = await res.json();
    return json.pages;
  }

  async function login(username, password) {
    const users = await loadUsers();
    const user = users.find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!user) return { ok: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' };

    const computed = await hashPassword(password, user.salt);
    if (computed !== user.hash) return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };

    const session = {
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      loginAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    let session;
    try { session = JSON.parse(raw); } catch (e) { return null; }
    if (!session.loginAt || Date.now() - session.loginAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isSuperadmin() {
    const s = getSession();
    return !!s && s.role === 'superadmin';
  }

  function canAccess(session, pageId) {
    if (!session) return false;
    if (pageId === 'admin') return session.role === 'superadmin';
    return Array.isArray(session.permissions) && session.permissions.includes(pageId);
  }

  /**
   * Renders a collapsed user-avatar button fixed top-right on any protected
   * page. Click to expand a small panel with name/role and a logout link;
   * click outside (or Escape) to collapse it again. Kept small when
   * collapsed so it never sits on top of a page's own header controls.
   */
  function mountUserBadge() {
    const session = getSession();
    if (!session) return;

    const el = document.createElement('div');
    el.id = 'cdp-user-badge';
    el.className = 'cdp-user-badge';
    el.innerHTML =
      '<button type="button" class="cdp-user-avatar" id="cdp-user-avatar-btn" aria-haspopup="true" aria-expanded="false" title="' + escapeHtml(session.name) + '">👤</button>' +
      '<div class="cdp-user-panel" id="cdp-user-panel">' +
        '<div class="cdp-user-panel-name">👤 ' + escapeHtml(session.name) + ' <span class="cdp-user-panel-role">(' + escapeHtml(session.role) + ')</span></div>' +
        '<div class="cdp-user-panel-divider"></div>' +
        '<a href="' + ROOT + 'index.html" id="cdp-logout-link" class="cdp-user-panel-logout">ออกจากระบบ</a>' +
      '</div>';
    document.body.appendChild(el);

    const btn = document.getElementById('cdp-user-avatar-btn');
    const panel = document.getElementById('cdp-user-panel');

    function closePanel() {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', function (e) {
      if (!el.contains(e.target)) closePanel();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    document.getElementById('cdp-logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      logout();
      window.location.href = ROOT + 'index.html';
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  global.CDPAuth = {
    ROOT,
    SESSION_TTL_MS,
    sha256Hex,
    hashPassword,
    randomSalt,
    loadUsers,
    saveUsersOverride,
    hasUsersOverride,
    clearUsersOverride,
    loadPages,
    login,
    logout,
    getSession,
    isSuperadmin,
    canAccess,
    mountUserBadge,
    escapeHtml,
  };
})(window);
