/* Shared EdgeControl plugin helpers: the standalone preview shim, icon
 * helpers, and EdgeControl theme handling (colour palette, font family).
 *
 * Shared by Philly Web Team's EdgeControl plugins. EdgeControl only lets a
 * plugin load files from inside its own bundle, so each repo carries a copy;
 * keep the copies identical.
 *
 * Exposes window.ECShared.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Standalone preview shim. EdgeControl injects window.edgecontrol before any
  // plugin script runs, so none of this is used inside the app. In a plain
  // browser it reads settings from the query string, keeps storage in
  // localStorage, and pushes 'update' every 2 s like EdgeControl does.
  // ---------------------------------------------------------------------------
  const QUERY_ALIASES = {
    haUrl: 'url',
    accessToken: 'token',
    buttonSet: 'set',
    buttonColor: 'color',
    showState: 'state',
    confirmRisky: 'confirm',
  };

  function installPreviewShim(defaults) {
    if (window.edgecontrol) return;
    if (window.top === window) document.documentElement.classList.add('standalone');
    const q = new URLSearchParams(location.search);
    const listeners = {};
    const emit = (ev, data) => (listeners[ev] || []).forEach((cb) => cb(data));
    const cfg = {};
    for (const [key, def] of Object.entries(defaults)) {
      const raw = q.get(QUERY_ALIASES[key] || key);
      if (raw === null) cfg[key] = def;
      else if (typeof def === 'boolean') cfg[key] = raw !== '0' && raw !== 'false';
      else cfg[key] = raw;
    }
    // Simulated theme: ?font=rounded|standard|monospaced|serif&gap=8&radius=10&opacity=0.05&accent=%2300E6FF
    const theme = { fontFamily: q.get('font') || 'rounded' };
    const bundle = (location.pathname.match(/([^/]+\.ecplugin)\//) || [])[1] || 'plugin';
    const storagePrefix = 'ec:' + bundle + ':';
    const rootStyle = document.documentElement.style;
    if (q.get('gap')) rootStyle.setProperty('--ec-widget-gap', q.get('gap') + 'px');
    if (q.get('radius')) rootStyle.setProperty('--ec-corner-radius', q.get('radius') + 'px');
    if (q.get('opacity')) rootStyle.setProperty('--ec-widget-opacity', q.get('opacity'));
    if (q.get('accent')) rootStyle.setProperty('--ec-accent', q.get('accent'));
    window.edgecontrol = {
      on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); },
      off(ev, cb) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== cb); },
      get config() { return cfg; },
      get theme() { return theme; },
      openURL(url) { window.open(url, '_blank'); },
      getWidgetSize() { return { width: 0, height: 0, pixelWidth: innerWidth, pixelHeight: innerHeight }; },
      // Namespaced by bundle folder: in EdgeControl each plugin has its own storage.
      storage: {
        async get(k) { try { return JSON.parse(localStorage.getItem(storagePrefix + k)); } catch (e) { return null; } },
        async set(k, v) { localStorage.setItem(storagePrefix + k, JSON.stringify(v)); },
        async remove(k) { localStorage.removeItem(storagePrefix + k); },
      },
    };
    document.addEventListener('DOMContentLoaded', () => {
      emit('ready');
      emit('update', { config: cfg, theme });
      setInterval(() => emit('update', { config: cfg, theme }), 2000);
    });
    addEventListener('resize', () => emit('resize', window.edgecontrol.getWidgetSize()));
  }

  // ---------------------------------------------------------------------------
  // Icon helpers (24×24, SF-Symbol-like filled glyphs)
  // ---------------------------------------------------------------------------
  const svg = (body) =>
    '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">' + body + '</svg>';
  const line = (d, w) =>
    '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + (w || 2.4) +
    '" stroke-linecap="round" stroke-linejoin="round"/>';
  const lineIcon = (d, w) => '<svg viewBox="0 0 24 24">' + line(d, w) + '</svg>';

  // ---------------------------------------------------------------------------
  // Theme: EdgeControl's colour palette and font families
  // ---------------------------------------------------------------------------
  // EdgeControl's ThemeColor palette, so a picked colour matches native widgets.
  const COLORS = {
    Cyan: '#00E6FF',
    Blue: '#3380FF',
    Purple: '#8C4DFF',
    Green: '#33E680',
    Yellow: '#F5C417',
    Orange: '#FF6B36',
    Red: '#FF2E2E',
    Pink: '#FF4D99',
    White: '#FFFFFF',
  };

  // EdgeControl's FontFamily setting → the matching macOS system font.
  const FONT_STACKS = {
    rounded: 'ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif',
    standard: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    monospaced: 'ui-monospace, "SF Mono", Menlo, monospace',
    serif: 'ui-serif, "New York", Georgia, serif',
  };

  /** "Theme accent" (or anything unknown) follows the Theme page's accent. */
  function applyColor(name) {
    const value = COLORS[name] || 'var(--ec-accent, #00e6ff)';
    document.documentElement.style.setProperty('--accent', value);
  }

  let appliedFont = null;
  function applyTheme(theme) {
    if (!theme || !theme.fontFamily) return;
    const family = String(theme.fontFamily).toLowerCase();
    if (family === appliedFont) return;
    appliedFont = family;
    document.documentElement.style.setProperty('--font', FONT_STACKS[family] || FONT_STACKS.rounded);
  }

  // ---------------------------------------------------------------------------
  // Search, typed on the tile's own keyboard
  // ---------------------------------------------------------------------------
  // Plugin views can't take the Mac's keyboard focus, and the Edge is a
  // touchscreen anyway, so search brings a keyboard of its own. The page
  // supplies a toggle button, a button that shows the query (tapping it
  // brings the keys back), and an empty keyboard container, then calls
  // render() from its own render. A short tile gets a compact keyboard: the
  // letters only, with the hide key beside Z.
  const SEARCH_ICONS = {
    search: lineIcon('M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.3 15.3L20 20', 2.6),
    stop: lineIcon('M6.5 6.5l11 11M17.5 6.5l-11 11', 2.8),
    backspace: lineIcon('M9 5h11v14H9l-6-7zM12.5 9.5l5 5M17.5 9.5l-5 5', 2.2),
    hide: lineIcon('M6 9l6 6 6-6', 2.6),
  };

  function createSearch(opts) {
    const s = { active: false, query: '', keysShown: true };
    const changed = () => { if (opts.onChange) opts.onChange(); };

    opts.toggle.addEventListener('click', () => {
      s.active = !s.active;
      s.query = '';
      s.keysShown = true;
      changed();
    });
    opts.field.addEventListener('click', () => {
      s.keysShown = true;
      changed();
    });

    function press(key) {
      if (key === 'back') s.query = s.query.slice(0, -1);
      else if (key === 'clear') s.query = '';
      else if (key === 'hide') s.keysShown = false;
      else if (key === ' ') { if (s.query && !s.query.endsWith(' ')) s.query += ' '; }
      else s.query += key;
      changed();
    }

    // Built once: rebuilding keys on every render would drop a press mid-tap.
    const key = (label, value, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (cls) b.className = cls;
      if (label.startsWith('<svg')) b.innerHTML = label;
      else b.textContent = label;
      b.addEventListener('click', () => press(value));
      return b;
    };
    const row = (cls, ...keys) => {
      const r = document.createElement('div');
      r.className = 'krow' + (cls ? ' ' + cls : '');
      r.append(...keys);
      return r;
    };
    const letters = (text) => [...text].map((c) => key(c, c));
    opts.keyboard.append(
      row('k-full', ...letters('1234567890')),
      row('', ...letters('qwertyuiop')),
      row('', ...letters('asdfghjkl')),
      row('', key(SEARCH_ICONS.hide, 'hide', 'wide k-compact'), ...letters('zxcvbnm'), key(SEARCH_ICONS.backspace, 'back', 'wide')),
      row('k-full', key(SEARCH_ICONS.hide, 'hide', 'wide'), key('space', ' ', 'space'), key('clear', 'clear', 'wide'))
    );

    s.stop = () => {
      s.active = false;
      s.query = '';
    };

    /** Shows the toggle, field and keyboard as they now are. */
    s.render = (placeholder, compact) => {
      opts.toggle.innerHTML = s.active ? SEARCH_ICONS.stop : SEARCH_ICONS.search;
      opts.toggle.setAttribute('aria-label', s.active ? 'Stop searching' : 'Search');
      opts.toggle.classList.toggle('active', s.active);
      opts.field.hidden = !s.active;
      opts.field.querySelector('.q').textContent = s.query || placeholder || 'Search';
      opts.field.classList.toggle('placeholder', !s.query);
      opts.keyboard.hidden = !(s.active && s.keysShown);
      opts.keyboard.classList.toggle('compact', !!compact);
    };

    /** Every typed word appears in `text`, or the query does with the spaces
     *  taken out, since the compact keyboard has no space bar. */
    s.matches = (text) => {
      const q = s.query.toLowerCase().trim();
      if (!q) return true;
      const hay = String(text).toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w)) || hay.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
    };

    return s;
  }

  window.ECShared = {
    installPreviewShim,
    createSearch,
    svg,
    line,
    lineIcon,
    COLORS,
    applyColor,
    applyTheme,
    SETTINGS_HINT: 'Right-click this tile and choose "Edit This Widget\u2019s Settings".',
  };
})();
