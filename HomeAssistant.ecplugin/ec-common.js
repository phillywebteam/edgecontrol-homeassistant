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

  window.ECShared = {
    installPreviewShim,
    svg,
    line,
    lineIcon,
    COLORS,
    applyColor,
    applyTheme,
    SETTINGS_HINT: 'Right-click this tile and choose "Edit This Widget\u2019s Settings".',
  };
})();
