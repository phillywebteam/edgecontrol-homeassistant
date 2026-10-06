/* Home Assistant Buttons — EdgeControl plugin widget.
 *
 * Connection, preview shim and theme helpers come from ha-client.js and
 * ec-common.js (window.HAShared).
 * Settings (URL, token, grid, button set) come from EdgeControl's per-widget
 * settings. The chosen buttons are picked inside the tile and saved with
 * edgecontrol.storage under the tile's "button set" name.
 */
(function () {
  'use strict';

  const H = window.HAShared;

  const DEFAULTS = {
    haUrl: '',
    accessToken: '',
    title: '',
    layout: 'Auto',
    buttonSet: 'Main',
    buttonColor: 'Theme accent',
    style: 'Cards',
    showState: true,
    confirmRisky: true,
  };

  H.installPreviewShim(DEFAULTS);
  const ec = window.edgecontrol;

  // ---------------------------------------------------------------------------
  // Icons (24×24). Filled glyphs in the spirit of the SF Symbols EdgeControl's
  // native widgets use (lightbulb.fill, bolt.fill, lock.fill, tv.fill …).
  // ---------------------------------------------------------------------------
  const { svg, line } = H;
  const fanBlade = 'M12 10.2c-.6-3.4.5-7 3.5-7.6 2.4-.5 3.9 1.7 2.7 3.8-1.1 2-3.4 3.2-6.2 3.8z';

  const ICONS = {
    // sparkles
    scene: svg('<path d="M10 2.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5z"/>' +
      '<path d="M18.5 13.5c.3 1.9 1.3 2.9 3.2 3.2-1.9.3-2.9 1.3-3.2 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.2z"/>' +
      '<path d="M19 2.6c.2 1.1.8 1.7 1.9 1.9-1.1.2-1.7.8-1.9 1.9-.2-1.1-.8-1.7-1.9-1.9 1.1-.2 1.7-.8 1.9-1.9z"/>'),
    // play.circle.fill
    script: svg('<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 6.1c-.5-.3-1.2 0-1.2.7v6.4c0 .7.7 1 1.2.7l5.2-3.2c.5-.3.5-1.1 0-1.4z"/>'),
    // bolt.fill
    automation: svg('<path d="M13.6 2.1 4.9 13.2c-.4.5 0 1.2.6 1.2H11l-1.2 7c-.1.6.7.9 1.1.4l8.7-11.1c.4-.5 0-1.2-.6-1.2H13.5l1.2-7c.1-.6-.7-.9-1.1-.4z"/>'),
    // lightbulb.fill
    light: svg('<path d="M12 2.2a7 7 0 0 0-4.2 12.6c.8.6 1.2 1.4 1.2 2.3v.4h6v-.4c0-.9.4-1.7 1.2-2.3A7 7 0 0 0 12 2.2z"/>' +
      '<path d="M9 19h6v.8a2.2 2.2 0 0 1-2.2 2.2h-1.6A2.2 2.2 0 0 1 9 19.8z"/>'),
    // power
    switch: '<svg viewBox="0 0 24 24">' + line('M12 3.2v8') + line('M7 6.4a7.6 7.6 0 1 0 10 0') + '</svg>',
    // fan.fill
    fan: svg('<circle cx="12" cy="12" r="2"/><path d="' + fanBlade + '"/>' +
      '<path transform="rotate(120 12 12)" d="' + fanBlade + '"/><path transform="rotate(240 12 12)" d="' + fanBlade + '"/>'),
    // blinds.horizontal.closed
    cover: svg('<rect x="3" y="2.5" width="18" height="2.6" rx="1.3"/><rect x="4" y="7" width="16" height="2.8" rx="1.4"/>' +
      '<rect x="4" y="11" width="16" height="2.8" rx="1.4"/><rect x="4" y="15" width="16" height="2.8" rx="1.4"/>' +
      '<rect x="4" y="19" width="16" height="2.8" rx="1.4"/>'),
    // door.garage.closed
    garage: svg('<path d="M12.6 2.4l8.8 5.2c.4.2.6.6.6 1V21a1 1 0 0 1-1 1h-2v-9a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9H3a1 1 0 0 1-1-1V8.6c0-.4.2-.8.6-1l8.8-5.2c.4-.2.8-.2 1.2 0z"/>' +
      '<rect x="6.6" y="13.6" width="10.8" height="2.2" rx=".6"/><rect x="6.6" y="16.9" width="10.8" height="2.2" rx=".6"/>' +
      '<rect x="6.6" y="20.2" width="10.8" height="1.8" rx=".6"/>'),
    // lock.fill / lock.open.fill
    lock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.4" width="15" height="11.6" rx="2.4" fill="currentColor"/>' +
      line('M8 10.4V7.6a4 4 0 0 1 8 0v2.8', 2.3) + '</svg>',
    unlock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.4" width="15" height="11.6" rx="2.4" fill="currentColor"/>' +
      line('M8 10.4V7.6a4 4 0 0 1 7.8-1.3', 2.3) + '</svg>',
    // circle.circle.fill
    button: svg('<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8z"/>' +
      '<circle cx="12" cy="12" r="4"/>'),
    // tv.fill
    media: svg('<rect x="2" y="3.8" width="20" height="13.4" rx="2.2"/><rect x="7" y="19.2" width="10" height="1.9" rx=".95"/>'),
    // switch.2 style toggle
    toggle: svg('<path d="M7.5 6h9a6 6 0 0 1 0 12h-9a6 6 0 0 1 0-12zm9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>'),
    // thermometer.medium
    climate: svg('<path d="M12 2.2a3.2 3.2 0 0 0-3.2 3.2v8.1a5.2 5.2 0 1 0 6.4 0V5.4A3.2 3.2 0 0 0 12 2.2z"/>'),
    // robot vacuum
    vacuum: svg('<path d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm0 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>'),
    valve: '<svg viewBox="0 0 24 24">' + line('M3.5 9v6M20.5 9v6M3.5 12h17M12 12V6.5M8.5 6h7') + '</svg>',
    generic: svg('<circle cx="12" cy="12" r="8"/>'),
    // UI
    pencil: svg('<path d="M15.4 4.4l4.2 4.2L9.2 19 4 20l1-5.2zM16.9 2.9a1.6 1.6 0 0 1 2.2 0l2 2a1.6 1.6 0 0 1 0 2.2l-.8.8-4.2-4.2z"/>'),
    check: '<svg viewBox="0 0 24 24">' + line('M5 12.5l4.5 4.5L19 7.5', 3.2) + '</svg>',
    left: '<svg viewBox="0 0 24 24">' + line('M15 5l-7 7 7 7', 2.8) + '</svg>',
    right: '<svg viewBox="0 0 24 24">' + line('M9 5l7 7-7 7', 2.8) + '</svg>',
    remove: '<svg viewBox="0 0 24 24">' + line('M6.5 6.5l11 11M17.5 6.5l-11 11', 2.8) + '</svg>',
  };

  // ---------------------------------------------------------------------------
  // Domains
  // ---------------------------------------------------------------------------
  const DEVICE_DOMAINS = [
    ['light', 'Lights'], ['switch', 'Switches'], ['fan', 'Fans'], ['cover', 'Covers & doors'],
    ['lock', 'Locks'], ['media_player', 'Media'], ['climate', 'Climate'], ['input_boolean', 'Helpers'],
    ['button', 'Buttons'], ['input_button', 'Helper buttons'], ['valve', 'Valves'], ['vacuum', 'Vacuums'],
    ['siren', 'Sirens'], ['humidifier', 'Humidifiers'],
  ];
  const CATEGORIES = [
    { key: 'scene', label: 'Scenes', domains: ['scene'] },
    { key: 'script', label: 'Scripts', domains: ['script'] },
    { key: 'automation', label: 'Automations', domains: ['automation'] },
    { key: 'device', label: 'Devices', domains: DEVICE_DOMAINS.map((d) => d[0]) },
    { key: 'selected', label: 'Selected' },
  ];
  const ACTION_DOMAINS = new Set(['scene', 'script', 'automation', 'button', 'input_button']);
  const ON_STATES = new Set([
    'on', 'open', 'opening', 'unlocked', 'unlocking', 'playing', 'cleaning',
    'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only',
  ]);
  const RISKY_COVER_CLASSES = new Set(['garage', 'gate', 'door']);

  const domainOf = (id) => id.slice(0, id.indexOf('.'));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

  function nameOf(ent, id) {
    const n = ent && ent.attributes && ent.attributes.friendly_name;
    if (n) return String(n);
    const obj = id.slice(id.indexOf('.') + 1).replace(/_/g, ' ');
    return cap(obj);
  }

  function iconFor(id, ent) {
    const d = domainOf(id);
    const a = (ent && ent.attributes) || {};
    if (d === 'lock') return ent && ent.state === 'unlocked' ? ICONS.unlock : ICONS.lock;
    if (d === 'cover') return RISKY_COVER_CLASSES.has(a.device_class) ? ICONS.garage : ICONS.cover;
    if (d === 'media_player') return ICONS.media;
    if (d === 'input_boolean') return ICONS.toggle;
    if (d === 'input_button') return ICONS.button;
    return ICONS[d] || ICONS.generic;
  }

  function stateText(id, ent) {
    if (!ent) return 'Not found';
    const d = domainOf(id);
    const s = ent.state;
    const a = ent.attributes || {};
    if (s === 'unavailable') return 'Unavailable';
    switch (d) {
      case 'scene': return 'Scene';
      case 'script': return s === 'on' ? 'Running' : 'Script';
      case 'automation': return s === 'on' ? 'Automation' : 'Disabled';
      case 'button':
      case 'input_button': return 'Press';
      case 'light':
        if (s === 'on' && typeof a.brightness === 'number') return 'On · ' + Math.round(a.brightness / 2.55) + '%';
        return cap(s);
      case 'cover':
        if (s === 'open' && typeof a.current_position === 'number') return 'Open · ' + a.current_position + '%';
        return cap(s);
      case 'climate':
        return typeof a.current_temperature === 'number' ? cap(s) + ' · ' + a.current_temperature + '°' : cap(s);
      case 'media_player':
        return s === 'playing' && a.media_title ? String(a.media_title) : cap(s);
      default:
        return s === 'unknown' ? '—' : cap(s);
    }
  }

  // Which service a tap calls, and whether it needs a second tap to confirm.
  function serviceFor(id, ent) {
    const d = domainOf(id);
    const s = ent ? ent.state : '';
    const a = (ent && ent.attributes) || {};
    switch (d) {
      case 'scene': return { domain: 'scene', service: 'turn_on' };
      case 'script': return { domain: 'script', service: 'turn_on' };
      case 'automation': return { domain: 'automation', service: 'trigger' };
      case 'button': return { domain: 'button', service: 'press' };
      case 'input_button': return { domain: 'input_button', service: 'press' };
      case 'lock':
        return s === 'locked'
          ? { domain: 'lock', service: 'unlock', risky: 'Tap again to unlock' }
          : { domain: 'lock', service: 'lock' };
      case 'cover': {
        const opening = s === 'closed' || s === 'closing';
        const risky = opening && RISKY_COVER_CLASSES.has(a.device_class) ? 'Tap again to open' : null;
        return { domain: 'cover', service: 'toggle', risky };
      }
      case 'media_player': return { domain: 'media_player', service: 'media_play_pause' };
      case 'vacuum': return { domain: 'vacuum', service: s === 'cleaning' ? 'return_to_base' : 'start' };
      case 'valve': return { domain: 'valve', service: 'toggle' };
      default: return { domain: 'homeassistant', service: 'toggle' };
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const STYLES = ['cards', 'dividers', 'pills', 'minimal', 'tinted'];

  let config = Object.assign({}, DEFAULTS);
  let gotConfig = false;
  let connection = { url: '', token: '', shared: false }; // own settings or the shared connection
  let selectionKey = null;
  let status = 'idle';
  let haVersion = '';

  const entities = new Map();
  let selection = [];
  let page = 0;
  let pickerOpen = false;
  let pickerTab = 'scene';
  const feedback = new Map(); // entity_id -> { kind: 'busy'|'done'|'failed'|'confirm', text, timer }

  const $ = (sel) => document.querySelector(sel);
  const el = {
    app: $('#app'),
    header: $('#header'),
    headerTitle: $('#header .title'),
    grid: $('#grid'),
    message: $('#message'),
    msgTitle: $('#message .title'),
    msgDetail: $('#message .detail'),
    msgAction: $('#message .action'),
    edit: $('#edit'),
    pager: $('#pager'),
    dot: $('#status-dot'),
    picker: $('#picker'),
    tabs: $('#tabs'),
    list: $('#list'),
    done: $('#done'),
  };
  el.edit.innerHTML = ICONS.pencil;

  const client = new H.HAClient({
    onStatus(s) { setStatus(s); },
    onAuthed(version) {
      haVersion = version || '';
      setStatus('loading');
      Promise.all([
        client.send({ type: 'subscribe_events', event_type: 'state_changed' }),
        client.send({ type: 'get_states' }, 30000),
      ]).then(([, states]) => {
        entities.clear();
        (states || []).forEach((s) => entities.set(s.entity_id, s));
        setStatus('connected');
      }).catch(() => {
        // The socket will close and retry if it is really broken.
        setStatus('connected');
      });
    },
    onStateChanged(data) {
      if (!data || !data.entity_id) return;
      const added = !entities.has(data.entity_id);
      if (data.new_state) entities.set(data.entity_id, data.new_state);
      else entities.delete(data.entity_id);
      if (selection.includes(data.entity_id) || (pickerOpen && (added || !data.new_state))) scheduleRender();
    },
  });

  function setStatus(s) {
    status = s;
    scheduleRender();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function readConfig(raw) {
    const c = Object.assign({}, DEFAULTS);
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(DEFAULTS)) if (raw[k] !== undefined && raw[k] !== null) c[k] = raw[k];
    }
    c.haUrl = String(c.haUrl).trim();
    c.accessToken = String(c.accessToken).trim().replace(/^bearer\s+/i, '');
    c.title = String(c.title || '').trim();
    c.layout = String(c.layout || 'Auto');
    c.buttonSet = String(c.buttonSet || 'Main').trim() || 'Main';
    c.buttonColor = String(c.buttonColor || 'Theme accent');
    c.style = String(c.style || 'Cards').toLowerCase();
    if (!STYLES.includes(c.style)) c.style = 'cards';
    c.showState = c.showState !== false && c.showState !== 'false';
    c.confirmRisky = c.confirmRisky !== false && c.confirmRisky !== 'false';
    return c;
  }

  function applyConfig(raw) {
    const prev = config;
    config = readConfig(raw);
    gotConfig = true;

    connections.apply(config);

    const setKey = 'buttons:' + config.buttonSet.toLowerCase();
    if (setKey !== selectionKey) {
      selectionKey = setKey;
      loadSelection(setKey, false);
    } else if (!pickerOpen && Date.now() - lastLoad > 4000) {
      loadSelection(setKey, true);
    }

    if (config.buttonColor !== prev.buttonColor || !colorApplied) applyColor();
    if (el.app.dataset.style !== config.style) {
      el.app.dataset.style = config.style;
      scheduleRender();
    }
    if (config.layout !== prev.layout || config.showState !== prev.showState || config.title !== prev.title) {
      scheduleRender();
    }
  }

  let colorApplied = false;
  function applyColor() {
    colorApplied = true;
    H.applyColor(config.buttonColor);
  }

  const applyTheme = H.applyTheme;
  const hostOf = H.hostOf;

  // Own URL + token, or (when blank) the connection another tile saved.
  const connections = H.connectionManager(client, (info) => {
    entities.clear();
    connection = { url: info.url || '', token: info.token || '', shared: info.shared };
    if (info.problem) setStatus(info.problem);
  });

  // ---------------------------------------------------------------------------
  // Selection storage
  // ---------------------------------------------------------------------------
  let lastLoad = 0;
  let savePending = false;

  // quiet: a background refresh that picks up changes made from another tile
  // using the same button set, without jumping back to the first page.
  async function loadSelection(key, quiet) {
    lastLoad = Date.now();
    let saved = null;
    try { saved = await ec.storage.get(key); } catch (e) { saved = null; }
    if (key !== selectionKey || savePending || (quiet && pickerOpen)) return;
    const next = Array.isArray(saved) ? saved.filter((x) => typeof x === 'string' && x.includes('.')) : [];
    if (quiet && next.join('\n') === selection.join('\n')) return;
    selection = next;
    if (!quiet) page = 0;
    scheduleRender();
  }

  let saveTimer = null;
  function saveSelection() {
    const key = selectionKey;
    const value = selection.slice();
    savePending = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      Promise.resolve(ec.storage.set(key, value))
        .catch(() => { /* storage unavailable; keep in memory */ })
        .then(() => { savePending = false; lastLoad = Date.now(); });
    }, 250);
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  // Ideal button shape per Style, for the Auto layout: width:height aspect,
  // smallest usable cell, and (for pills) the height a button stops growing at.
  const SHAPES = {
    cards: { aspect: 1.35, minW: 64, minH: 52, maxH: Infinity },
    dividers: { aspect: 1.35, minW: 64, minH: 52, maxH: Infinity },
    tinted: { aspect: 1.35, minW: 64, minH: 52, maxH: Infinity },
    minimal: { aspect: 1.1, minW: 60, minH: 56, maxH: Infinity },
    pills: { aspect: 3.2, minW: 110, minH: 34, maxH: 52 },
  };

  function gridFor(count, width, height) {
    const gap = parseFloat(getComputedStyle(el.grid).columnGap) || 0;
    const fixed = /^(\d+)\s*[×x]\s*(\d+)$/.exec(config.layout);
    if (fixed) {
      const cols = Math.max(1, +fixed[1]);
      const rows = Math.max(1, +fixed[2]);
      return { cols, rows, perPage: cols * rows };
    }
    // Auto: the arrangement that gives the largest buttons for this tile shape.
    const shape = SHAPES[config.style] || SHAPES.cards;
    const n = Math.max(1, count);
    const maxRows = Math.max(1, Math.floor((height + gap) / (shape.minH + gap)));
    const maxCols = Math.max(1, Math.floor((width + gap) / (shape.minW + gap)));
    const fitsAll = Math.min(n, maxRows * maxCols);
    let best = null;
    for (let rows = 1; rows <= maxRows; rows++) {
      const cols = Math.min(maxCols, Math.ceil(fitsAll / rows));
      if (cols * rows < fitsAll) continue;
      const cw = (width - gap * (cols - 1)) / cols;
      const ch = (height - gap * (rows - 1)) / rows;
      const score = Math.min(cw / shape.aspect, ch, shape.maxH) - (cols * rows - fitsAll) * 0.5;
      if (!best || score > best.score) best = { cols, rows, score };
    }
    if (!best) best = { cols: 1, rows: 1 };
    return { cols: best.cols, rows: best.rows, perPage: best.cols * best.rows };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function showMessage(title, detail, actionLabel, onAction) {
    el.message.hidden = false;
    el.msgTitle.textContent = title;
    el.msgDetail.textContent = detail || '';
    el.msgDetail.hidden = !detail;
    if (actionLabel) {
      el.msgAction.hidden = false;
      el.msgAction.textContent = actionLabel;
      el.msgAction.onclick = onAction;
    } else {
      el.msgAction.hidden = true;
      el.msgAction.onclick = null;
    }
  }

  const SETTINGS_HINT = H.SETTINGS_HINT;

  function render() {
    el.picker.hidden = !pickerOpen;
    if (pickerOpen) renderPicker();

    const hasHeader = gotConfig && !!config.title;
    el.header.hidden = !hasHeader;
    el.app.classList.toggle('has-header', hasHeader);
    if (hasHeader) el.headerTitle.textContent = config.title;

    el.message.hidden = true;
    el.dot.hidden = true;
    el.dot.className = '';
    const connected = status === 'connected';

    if (!gotConfig) {
      el.grid.replaceChildren();
      el.edit.hidden = true;
      el.pager.hidden = true;
      return;
    }

    if (status === 'unconfigured') {
      clearGrid();
      showMessage('Connect Home Assistant',
        'Add your Home Assistant URL and a long-lived access token here, or on any other Home Assistant tile. ' + SETTINGS_HINT);
      return;
    }
    if (status === 'bad_url') {
      clearGrid();
      showMessage('Check the Home Assistant URL', '"' + connection.url + '" isn’t a valid address. ' + SETTINGS_HINT);
      return;
    }
    if (status === 'auth_failed') {
      clearGrid();
      showMessage('Access token rejected',
        'Home Assistant at ' + hostOf(connection.url) + ' didn’t accept the token' +
        (connection.shared ? ' saved from another Home Assistant tile' : '') +
        '. Create a new long-lived token in your Home Assistant profile and paste it in. ' + SETTINGS_HINT);
      return;
    }

    if (!connected) {
      el.dot.hidden = false;
      el.dot.className = status === 'connecting' || status === 'loading' ? 'connecting' : 'error';
    }

    el.edit.hidden = pickerOpen;

    if (!selection.length) {
      clearGrid();
      if (connected) {
        showMessage('No buttons yet', 'Pick the scenes, scripts, automations and devices to show here.', 'Choose buttons', openPicker);
      } else if (status === 'unreachable' || status === 'lost') {
        showMessage('Can’t reach Home Assistant', 'Trying ' + hostOf(connection.url) + ' again…');
      } else {
        showMessage('Connecting to Home Assistant…', hostOf(connection.url));
      }
      return;
    }

    renderGrid();
  }

  function clearGrid() {
    el.grid.replaceChildren();
    el.pager.hidden = true;
    el.edit.hidden = true;
  }

  const buttonEls = new Map();

  function renderGrid() {
    const width = el.grid.clientWidth || innerWidth;
    const height = el.grid.clientHeight || innerHeight;
    const { cols, rows, perPage } = gridFor(selection.length, width, height);
    const pages = Math.max(1, Math.ceil(selection.length / perPage));
    page = Math.min(page, pages - 1);

    el.grid.style.setProperty('--cols', cols);
    el.grid.style.setProperty('--rows', rows);

    const visible = selection.slice(page * perPage, page * perPage + perPage);
    const keep = new Set(visible);
    for (const [id, node] of buttonEls) {
      if (!keep.has(id)) { node.remove(); buttonEls.delete(id); }
    }
    // Dividers draw a line to the right and below each button except along the
    // grid's last column and last filled row.
    const lastRow = Math.floor((visible.length - 1) / cols);
    visible.forEach((id, i) => {
      let node = buttonEls.get(id);
      if (!node) {
        node = createButton(id);
        buttonEls.set(id, node);
      }
      updateButton(node, id);
      if (i % cols === cols - 1 || i === visible.length - 1) node.classList.add('col-last');
      if (Math.floor(i / cols) === lastRow) node.classList.add('row-last');
      // Only move nodes that are out of place: moving one restarts its CSS
      // animations (the busy pulse, the failed shake).
      if (el.grid.children[i] !== node) el.grid.insertBefore(node, el.grid.children[i] || null);
    });

    renderPager(pages);
  }

  function createButton(id) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.dataset.id = id;
    b.innerHTML = '<span class="inner"><span class="icon"></span>' +
      '<span class="text"><span class="name"></span><span class="state"></span></span></span>';
    b.addEventListener('click', () => {
      if (suppressClick) return;
      pressButton(id);
    });
    return b;
  }

  function updateButton(b, id) {
    const ent = entities.get(id);
    const d = domainOf(id);
    const fb = feedback.get(id);
    const isAction = ACTION_DOMAINS.has(d);
    const on = !isAction && ent && ON_STATES.has(ent.state);
    const unavailable = status === 'connected' && (!ent || ent.state === 'unavailable');

    b.className = 'btn' +
      (isAction ? ' action' : '') +
      (on ? ' on' : '') +
      (unavailable ? ' unavailable' : '') +
      (fb ? ' ' + fb.kind : '');

    const iconHtml = iconFor(id, ent);
    const icon = b.querySelector('.icon');
    if (icon.dataset.html !== iconHtml) {
      icon.innerHTML = iconHtml;
      icon.dataset.html = iconHtml;
    }
    b.querySelector('.name').textContent = nameOf(ent, id);

    let st = '';
    if (fb && fb.text) st = fb.text;
    else if (status !== 'connected') st = status === 'connecting' || status === 'loading' ? 'Connecting' : 'Offline';
    else if (config.showState || !ent) st = stateText(id, ent);
    const stateEl = b.querySelector('.state');
    stateEl.textContent = st;
    stateEl.hidden = !st;
    b.title = nameOf(ent, id) + (ent ? ' — ' + id : '');
  }

  function renderPager(pages) {
    if (pages <= 1) {
      el.pager.hidden = true;
      el.pager.replaceChildren();
      return;
    }
    el.pager.hidden = false;
    const nodes = [];
    for (let i = 0; i < pages; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Page ' + (i + 1));
      b.innerHTML = '<span class="dot' + (i === page ? ' active' : '') + '"></span>';
      b.addEventListener('click', () => { page = i; scheduleRender(); });
      nodes.push(b);
    }
    el.pager.replaceChildren(...nodes);
  }

  // ---------------------------------------------------------------------------
  // Pressing buttons
  // ---------------------------------------------------------------------------
  function setFeedback(id, kind, text, ms) {
    const old = feedback.get(id);
    if (old) clearTimeout(old.timer);
    const entry = { kind, text };
    if (ms) entry.timer = setTimeout(() => { if (feedback.get(id) === entry) { feedback.delete(id); scheduleRender(); } }, ms);
    feedback.set(id, entry);
    scheduleRender();
  }

  function pressButton(id) {
    if (status !== 'connected') return;
    const ent = entities.get(id);
    if (!ent || ent.state === 'unavailable') {
      setFeedback(id, 'failed', ent ? 'Unavailable' : 'Not found', 1500);
      return;
    }
    const fb = feedback.get(id);
    if (fb && fb.kind === 'busy') return;

    const svc = serviceFor(id, ent);
    if (svc.risky && config.confirmRisky && !(fb && fb.kind === 'confirm')) {
      setFeedback(id, 'confirm', svc.risky, 4000);
      return;
    }

    setFeedback(id, 'busy', '');
    client.send({
      type: 'call_service',
      domain: svc.domain,
      service: svc.service,
      target: { entity_id: id },
    }).then(() => {
      setFeedback(id, 'done', ACTION_DOMAINS.has(domainOf(id)) ? 'Done' : '', 900);
    }).catch((err) => {
      setFeedback(id, 'failed', 'Failed', 2500);
      console.warn('Home Assistant call failed for ' + id + ': ' + err.message);
    });
  }

  // Horizontal drag across the grid flips pages (works with a mouse, and with
  // the system touch driver, which turns finger drags into mouse drags).
  let dragStart = null;
  let suppressClick = false;
  el.grid.addEventListener('pointerdown', (e) => { dragStart = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragStart = null;
    const pages = el.pager.hidden ? 1 : el.pager.childElementCount;
    if (pages > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      page = (page + (dx < 0 ? 1 : -1) + pages) % pages;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      scheduleRender();
    }
  });

  // ---------------------------------------------------------------------------
  // Picker
  // ---------------------------------------------------------------------------
  function openPicker() {
    pickerOpen = true;
    if (!selection.length) pickerTab = 'scene';
    scheduleRender();
  }

  function closePicker() {
    pickerOpen = false;
    scheduleRender();
  }

  el.edit.addEventListener('click', openPicker);
  el.done.addEventListener('click', closePicker);

  function entitiesIn(domains) {
    const set = new Set(domains);
    const out = [];
    for (const [id, ent] of entities) if (set.has(domainOf(id))) out.push({ id, ent, name: nameOf(ent, id) });
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return out;
  }

  function renderPicker() {
    // Tabs
    const tabs = CATEGORIES.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (c.key === pickerTab ? ' active' : '');
      b.textContent = c.label;
      if (c.key === 'selected') {
        const n = document.createElement('span');
        n.className = 'count';
        n.textContent = String(selection.length);
        b.appendChild(n);
      }
      b.addEventListener('click', () => { pickerTab = c.key; el.list.scrollTop = 0; scheduleRender(); });
      return b;
    });
    el.tabs.replaceChildren(...tabs);

    const rows = [];
    const empty = (text) => {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = text;
      return d;
    };

    if (status !== 'connected') {
      rows.push(empty('Connect to Home Assistant to choose buttons.'));
    } else if (pickerTab === 'selected') {
      if (!selection.length) rows.push(empty('Nothing selected yet. Pick buttons from the other tabs.'));
      selection.forEach((id, i) => rows.push(selectedRow(id, i)));
    } else if (pickerTab === 'device') {
      DEVICE_DOMAINS.forEach(([domain, label]) => {
        const items = entitiesIn([domain]);
        if (!items.length) return;
        const g = document.createElement('div');
        g.className = 'group';
        g.textContent = label;
        rows.push(g);
        items.forEach((it) => rows.push(choiceRow(it)));
      });
      if (!rows.length) rows.push(empty('No devices found.'));
    } else {
      const cat = CATEGORIES.find((c) => c.key === pickerTab);
      const items = entitiesIn(cat.domains);
      if (!items.length) rows.push(empty('No ' + cat.label.toLowerCase() + ' found in Home Assistant.'));
      items.forEach((it) => rows.push(choiceRow(it)));
    }
    el.list.replaceChildren(...rows);
  }

  function rowBase(id, ent, selected) {
    const r = document.createElement('div');
    r.className = 'row' + (selected ? ' selected' : '');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = iconFor(id, ent);
    const label = document.createElement('span');
    label.className = 'label';
    const n = document.createElement('div');
    n.className = 'n';
    n.textContent = nameOf(ent, id);
    const i = document.createElement('div');
    i.className = 'id';
    i.textContent = id;
    label.append(n, i);
    return { r, icon, label };
  }

  function choiceRow({ id, ent }) {
    const selected = selection.includes(id);
    const { r, icon, label } = rowBase(id, ent, selected);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = r.className;
    const check = document.createElement('span');
    check.className = 'check';
    if (selected) check.innerHTML = ICONS.check;
    row.append(check, icon, label);
    row.addEventListener('click', () => {
      const at = selection.indexOf(id);
      if (at >= 0) selection.splice(at, 1);
      else selection.push(id);
      saveSelection();
      scheduleRender();
    });
    return row;
  }

  function selectedRow(id, index) {
    const ent = entities.get(id);
    const { r, icon, label } = rowBase(id, ent, true);
    const ord = document.createElement('span');
    ord.className = 'ord';
    const mk = (iconHtml, title, disabled, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = title;
      b.innerHTML = iconHtml;
      b.disabled = disabled;
      b.addEventListener('click', fn);
      return b;
    };
    ord.append(
      mk(ICONS.left, 'Move earlier', index === 0, () => move(index, -1)),
      mk(ICONS.right, 'Move later', index === selection.length - 1, () => move(index, 1)),
      mk(ICONS.remove, 'Remove', false, () => {
        selection.splice(index, 1);
        saveSelection();
        scheduleRender();
      })
    );
    r.append(icon, label, ord);
    return r;
  }

  function move(index, delta) {
    const to = index + delta;
    if (to < 0 || to >= selection.length) return;
    const [item] = selection.splice(index, 1);
    selection.splice(to, 0, item);
    saveSelection();
    scheduleRender();
  }

  // ---------------------------------------------------------------------------
  // EdgeControl events
  // ---------------------------------------------------------------------------
  ec.on('update', (data) => {
    applyTheme(data && data.theme);
    applyConfig(data && data.config);
  });
  ec.on('resize', scheduleRender);
  ec.on('themeChange', (theme) => {
    applyTheme(theme);
    scheduleRender();
  });
  ec.on('visibilityChange', (visible) => {
    // Reconnect promptly when the page comes back if the socket dropped.
    if (visible && !client.connected && status !== 'auth_failed' && connection.url && connection.token) {
      const url = H.websocketUrl(connection.url);
      if (url) client.connect(url, connection.token);
    }
  });
  addEventListener('resize', scheduleRender);

  // EdgeControl delivers settings with its first data push. If they're already
  // in the snapshot (e.g. after a reload), use them straight away.
  applyTheme(ec.theme);
  if (ec.config && Object.keys(ec.config).length) applyConfig(ec.config);
  scheduleRender();
})();
