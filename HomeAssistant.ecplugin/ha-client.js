/* Home Assistant client for the Home Assistant Buttons plugin.
 *
 * Talks to Home Assistant over its WebSocket API (/api/websocket) with a
 * long-lived access token, the same way Itsyhome does. WebSocket rather than
 * REST because plugin pages load from file:// URLs, and Home Assistant's REST
 * API would reject them on CORS; WebSockets are not subject to CORS.
 *
 * Kept with the shared plugin code so it stays in step with ec-common.js.
 * Load after ec-common.js. Exposes window.HAShared = ECShared + the client.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Home Assistant WebSocket client
  // ---------------------------------------------------------------------------
  function websocketUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol === 'https:') u.protocol = 'wss:';
    else if (u.protocol === 'http:') u.protocol = 'ws:';
    else if (u.protocol !== 'wss:' && u.protocol !== 'ws:') return null;
    let path = u.pathname.replace(/\/+$/, '');
    if (!/\/api\/websocket$/.test(path)) path += '/api/websocket';
    u.pathname = path;
    u.search = '';
    u.hash = '';
    return u.toString();
  }

  function hostOf(raw) {
    try { return new URL(/^[a-z]+:\/\//i.test(raw) ? raw : 'https://' + raw).host; } catch (e) { return raw; }
  }

  const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];

  class HAClient {
    constructor(handlers) {
      this.h = handlers;
      this.ws = null;
      this.authed = false;
      this.nextId = 1;
      this.pending = new Map();
      this.retry = 0;
      this.stopped = true;
    }

    connect(url, token) {
      this.disconnect();
      this.url = url;
      this.token = token;
      this.stopped = false;
      this.retry = 0;
      this._open();
    }

    disconnect() {
      this.stopped = true;
      clearTimeout(this.retryTimer);
      clearInterval(this.pingTimer);
      clearTimeout(this.pongTimer);
      const ws = this.ws;
      this.ws = null;
      this.authed = false;
      if (ws) { try { ws.close(); } catch (e) { /* already closed */ } }
      this._failPending('Disconnected');
    }

    get connected() { return !!(this.ws && this.authed); }

    send(payload, timeoutMs) {
      return new Promise((resolve, reject) => {
        if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Not connected'));
          return;
        }
        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('Home Assistant did not respond'));
        }, timeoutMs || 15000);
        this.pending.set(id, { resolve, reject, timer });
        this._raw(Object.assign({}, payload, { id }));
      });
    }

    _open() {
      this.h.onStatus('connecting');
      let ws;
      try {
        ws = new WebSocket(this.url);
      } catch (e) {
        this.stopped = true;
        this.h.onStatus('bad_url');
        return;
      }
      this.ws = ws;
      this.authed = false;
      ws.onmessage = (ev) => {
        if (ws !== this.ws) return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        (Array.isArray(msg) ? msg : [msg]).forEach((m) => this._handle(m));
      };
      ws.onclose = () => this._closed(ws);
      ws.onerror = () => { /* onclose follows and handles the retry */ };
    }

    _handle(msg) {
      switch (msg.type) {
        case 'auth_required':
          this._raw({ type: 'auth', access_token: this.token });
          break;
        case 'auth_ok':
          this.authed = true;
          this.retry = 0;
          this._startPing();
          this.h.onAuthed(msg.ha_version);
          break;
        case 'auth_invalid':
          // Don't retry: repeated bad logins can get this Mac's IP banned by
          // Home Assistant. Wait for the token to be changed in settings.
          this.stopped = true;
          this.h.onStatus('auth_failed');
          try { this.ws.close(); } catch (e) { /* ignore */ }
          break;
        case 'result': {
          const p = this.pending.get(msg.id);
          if (!p) break;
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.success) p.resolve(msg.result);
          else p.reject(new Error((msg.error && msg.error.message) || 'Request failed'));
          break;
        }
        case 'event':
          if (msg.event && msg.event.event_type === 'state_changed') this.h.onStateChanged(msg.event.data);
          break;
        case 'pong':
          clearTimeout(this.pongTimer);
          break;
      }
    }

    _raw(obj) {
      try { this.ws.send(JSON.stringify(obj)); } catch (e) { /* socket closing; onclose handles it */ }
    }

    _startPing() {
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (!this.connected) return;
        this._raw({ id: this.nextId++, type: 'ping' });
        clearTimeout(this.pongTimer);
        this.pongTimer = setTimeout(() => { try { this.ws.close(); } catch (e) { /* ignore */ } }, 10000);
      }, 30000);
    }

    _failPending(reason) {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error(reason));
      }
      this.pending.clear();
    }

    _closed(ws) {
      if (ws !== this.ws) return;
      clearInterval(this.pingTimer);
      clearTimeout(this.pongTimer);
      const wasAuthed = this.authed;
      this.ws = null;
      this.authed = false;
      this._failPending('Connection lost');
      if (this.stopped) return;
      this.h.onStatus(wasAuthed ? 'lost' : 'unreachable');
      const delay = RETRY_DELAYS[Math.min(this.retry, RETRY_DELAYS.length - 1)];
      this.retry++;
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => { if (!this.stopped) this._open(); }, delay);
    }
  }

  // ---------------------------------------------------------------------------
  // Shared connection
  //
  // Plugin storage is shared by every tile of the same plugin (not across
  // plugins). A tile that has a URL and token in its own settings saves them
  // under "connection"; a tile of that plugin whose URL and token are blank
  // uses the saved connection, so they only need entering once per plugin.
  // ---------------------------------------------------------------------------
  const SHARED_KEY = 'connection';

  /**
   * Keeps `client` connected to whatever the tile's settings (or the shared
   * connection) point at. `onChange(info)` is called whenever the target
   * changes, before connecting: info = { url, token, shared, problem }, where
   * problem is 'unconfigured' or 'bad_url' when there's nothing to connect to.
   */
  function connectionManager(client, onChange) {
    const ec = window.edgecontrol;
    let currentKey = null;
    let lastSharedSave = null;
    let lastSharedCheck = 0;
    let checking = false;

    function connectTo(url, token, shared) {
      const key = (url || '') + '\n' + (token || '');
      if (key === currentKey) return;
      currentKey = key;
      if (!url || !token) {
        client.disconnect();
        onChange({ url, token, shared, problem: 'unconfigured' });
        return;
      }
      const wsUrl = websocketUrl(url);
      if (!wsUrl) {
        client.disconnect();
        onChange({ url, token, shared, problem: 'bad_url' });
        return;
      }
      onChange({ url, token, shared, problem: null });
      client.connect(wsUrl, token);
    }

    return {
      apply(config) {
        if (config.haUrl && config.accessToken) {
          const saveKey = config.haUrl + '\n' + config.accessToken;
          if (saveKey !== lastSharedSave) {
            lastSharedSave = saveKey;
            Promise.resolve(ec.storage.set(SHARED_KEY, { haUrl: config.haUrl, accessToken: config.accessToken }))
              .catch(() => { /* storage unavailable; this tile still works */ });
          }
          connectTo(config.haUrl, config.accessToken, false);
          return;
        }
        // Blank settings: use (and keep re-checking) the shared connection.
        if (checking || (currentKey !== null && Date.now() - lastSharedCheck < 5000)) return;
        checking = true;
        lastSharedCheck = Date.now();
        Promise.resolve(ec.storage.get(SHARED_KEY))
          .catch(() => null)
          .then((shared) => {
            checking = false;
            if (config.haUrl && config.accessToken) return; // settings filled in meanwhile
            const ok = shared && shared.haUrl && shared.accessToken;
            connectTo(ok ? shared.haUrl : config.haUrl, ok ? shared.accessToken : config.accessToken, !!ok);
          });
      },
    };
  }

  window.HAShared = Object.assign({}, window.ECShared, {
    websocketUrl,
    hostOf,
    HAClient,
    connectionManager,
  });
})();
