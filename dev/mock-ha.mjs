// Mock Home Assistant for testing the plugin without a real instance.
//
//   cd dev && npm install && npm start
//   open http://localhost:8124/dev/preview.html
//
// Serves the repo over HTTP and speaks just enough of Home Assistant's
// WebSocket API (auth, get_states, subscribe_events, call_service, ping, and
// the area, device and entity registries) on
// ws://localhost:8124/api/websocket. The only accepted token is "dev-token".

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8124);
const TOKEN = 'dev-token';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const now = () => new Date().toISOString();
const ent = (entity_id, state, attributes = {}) => ({
  entity_id,
  state,
  attributes,
  last_changed: now(),
  last_updated: now(),
  context: { id: Math.random().toString(36).slice(2), parent_id: null, user_id: null },
});

const states = new Map(
  [
    ent('scene.movie_night', 'unknown', { friendly_name: 'Movie Night' }),
    ent('scene.good_morning', 'unknown', { friendly_name: 'Good Morning' }),
    ent('scene.all_off', 'unknown', { friendly_name: 'All Off' }),
    ent('script.leaving_home', 'off', { friendly_name: 'Leaving Home' }),
    ent('script.bedtime', 'off', { friendly_name: 'Bedtime' }),
    ent('automation.porch_lights_at_sunset', 'on', { friendly_name: 'Porch Lights at Sunset' }),
    ent('automation.vacation_mode', 'off', { friendly_name: 'Vacation Mode' }),
    // Office: colour and white. Kitchen: white only. Living Room: dimmable.
    ent('light.office', 'on', {
      friendly_name: 'Office', brightness: 153, color_mode: 'hs', hs_color: [30, 80],
      supported_color_modes: ['color_temp', 'hs'], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500,
    }),
    ent('light.kitchen', 'off', {
      friendly_name: 'Kitchen', supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2700,
      max_color_temp_kelvin: 6500,
    }),
    ent('light.living_room', 'on', { friendly_name: 'Living Room', brightness: 255, supported_color_modes: ['brightness'] }),
    ent('light.porch', 'off', { friendly_name: 'Porch', supported_color_modes: ['onoff'] }),
    ent('switch.coffee_maker', 'off', { friendly_name: 'Coffee Maker' }),
    ent('fan.bedroom', 'off', { friendly_name: 'Bedroom Fan', percentage: 0, percentage_step: 25, supported_features: 1 }),
    ent('lock.front_door', 'locked', { friendly_name: 'Front Door' }),
    ent('cover.garage_door', 'closed', { friendly_name: 'Garage Door', device_class: 'garage' }),
    ent('cover.office_blinds', 'open', { friendly_name: 'Office Blinds', current_position: 70, supported_features: 15 }),
    ent('media_player.living_room_tv', 'paused', {
      friendly_name: 'Living Room TV', media_title: 'Nature Documentary', volume_level: 0.3, supported_features: 21429,
    }),
    ent('input_boolean.guest_mode', 'off', { friendly_name: 'Guest Mode' }),
    ent('button.doorbell_chime', 'unknown', { friendly_name: 'Doorbell Chime' }),
    ent('climate.thermostat', 'heat', {
      friendly_name: 'Thermostat', current_temperature: 69, temperature: 70, min_temp: 50, max_temp: 90,
      target_temp_step: 1, hvac_modes: ['off', 'heat', 'cool', 'auto'], supported_features: 1,
    }),
    ent('sensor.outdoor_temperature', '58', { friendly_name: 'Outdoor Temperature', unit_of_measurement: '°F' }),
  ].map((e) => [e.entity_id, e])
);

// Rooms, the way Home Assistant's registries describe them: an entity's area
// is its own, or its device's.
const areas = [
  { area_id: 'office', name: 'Office' },
  { area_id: 'kitchen', name: 'Kitchen' },
  { area_id: 'living_room', name: 'Living Room' },
  { area_id: 'bedroom', name: 'Bedroom' },
  { area_id: 'garage', name: 'Garage' },
];
const devices = [
  { id: 'dev-office-blinds', area_id: 'office', name: 'Office Blinds' },
  { id: 'dev-tv', area_id: 'living_room', name: 'Living Room TV' },
  { id: 'dev-garage', area_id: 'garage', name: 'Garage Door Opener' },
];
const entityAreas = [
  ['light.office', 'office', null], ['light.kitchen', 'kitchen', null], ['light.living_room', 'living_room', null],
  ['switch.coffee_maker', 'kitchen', null], ['fan.bedroom', 'bedroom', null], ['scene.movie_night', 'living_room', null],
  ['cover.office_blinds', null, 'dev-office-blinds'], ['media_player.living_room_tv', null, 'dev-tv'],
  ['cover.garage_door', null, 'dev-garage'],
];

const sockets = new Set();

function setState(id, state, attrs = {}) {
  const old = states.get(id);
  if (!old) return;
  const next = { ...old, state, attributes: { ...old.attributes, ...attrs }, last_changed: now(), last_updated: now() };
  states.set(id, next);
  for (const s of sockets) {
    if (!s.authed) continue;
    for (const subId of s.subs) {
      s.send(JSON.stringify({
        id: subId,
        type: 'event',
        event: { event_type: 'state_changed', data: { entity_id: id, old_state: old, new_state: next }, origin: 'LOCAL', time_fired: now() },
      }));
    }
  }
}

function callService(domain, service, entityId, data = {}) {
  const e = states.get(entityId);
  if (!e) throw new Error(`Entity ${entityId} not found`);
  const d = entityId.split('.')[0];
  const flip = (on, off) => setState(entityId, e.state === on ? off : on);
  switch (`${domain}.${service}`) {
    case 'homeassistant.toggle':
      if (d === 'light') return setState(entityId, e.state === 'on' ? 'off' : 'on', e.state === 'on' ? {} : { brightness: 200 });
      return flip('on', 'off');
    case 'scene.turn_on':
    case 'button.press':
    case 'input_button.press':
      return setState(entityId, now());
    case 'script.turn_on':
      setState(entityId, 'on');
      setTimeout(() => setState(entityId, 'off'), 1500);
      return;
    case 'automation.trigger':
      return;
    case 'lock.unlock': return setState(entityId, 'unlocked');
    case 'lock.lock': return setState(entityId, 'locked');
    case 'cover.toggle': return setState(entityId, e.state === 'closed' ? 'open' : 'closed');
    case 'media_player.media_play_pause': return flip('playing', 'paused');
    case 'media_player.volume_set': return setState(entityId, e.state, { volume_level: data.volume_level });
    case 'light.turn_on': {
      const a = {};
      if (data.brightness_pct !== undefined) a.brightness = Math.round(data.brightness_pct * 2.55);
      else if (e.state !== 'on') a.brightness = 200;
      if (data.color_temp_kelvin !== undefined) Object.assign(a, { color_mode: 'color_temp', color_temp_kelvin: data.color_temp_kelvin, hs_color: null });
      if (data.hs_color) Object.assign(a, { color_mode: 'hs', hs_color: data.hs_color, color_temp_kelvin: null });
      return setState(entityId, 'on', a);
    }
    case 'light.turn_off': return setState(entityId, 'off', { brightness: null });
    case 'fan.set_percentage':
      return setState(entityId, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage });
    case 'fan.turn_off': return setState(entityId, 'off', { percentage: 0 });
    case 'cover.set_cover_position':
      return setState(entityId, data.position > 0 ? 'open' : 'closed', { current_position: data.position });
    case 'cover.open_cover': return setState(entityId, 'open', { current_position: 100 });
    case 'cover.close_cover': return setState(entityId, 'closed', { current_position: 0 });
    case 'cover.stop_cover': return;
    case 'climate.set_temperature': return setState(entityId, e.state, { temperature: data.temperature });
    case 'climate.set_hvac_mode': return setState(entityId, data.hvac_mode);
    default:
      throw new Error(`Service ${domain}.${service} not supported by the mock`);
  }
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(401).end('401: Unauthorized');
    return;
  }
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/api/websocket' });
wss.on('connection', (ws) => {
  ws.authed = false;
  ws.subs = new Set();
  sockets.add(ws);
  ws.on('close', () => sockets.delete(ws));
  ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0-mock' }));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!ws.authed) {
      if (msg.type === 'auth' && msg.access_token === TOKEN) {
        ws.authed = true;
        ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0-mock' }));
      } else {
        ws.send(JSON.stringify({ type: 'auth_invalid', message: 'Invalid access token or password' }));
        ws.close();
      }
      return;
    }
    const reply = (success, result, error) => ws.send(JSON.stringify({ id: msg.id, type: 'result', success, result: result ?? null, ...(error ? { error } : {}) }));
    switch (msg.type) {
      case 'get_states': return reply(true, [...states.values()]);
      case 'config/area_registry/list': return reply(true, areas);
      case 'config/device_registry/list': return reply(true, devices);
      case 'config/entity_registry/list_for_display':
        return reply(true, {
          entity_categories: {},
          entities: [...states.keys()].map((ei) => {
            const [, ai, di] = entityAreas.find(([id]) => id === ei) || [];
            return { ei, ...(ai ? { ai } : {}), ...(di ? { di } : {}) };
          }),
        });
      case 'subscribe_events': ws.subs.add(msg.id); return reply(true, null);
      case 'ping': return ws.send(JSON.stringify({ id: msg.id, type: 'pong' }));
      case 'call_service': {
        const target = msg.target?.entity_id || msg.service_data?.entity_id;
        try {
          callService(msg.domain, msg.service, Array.isArray(target) ? target[0] : target, msg.service_data || {});
          console.log(`call_service ${msg.domain}.${msg.service} -> ${target} ${JSON.stringify(msg.service_data || {})}`);
          return reply(true, { context: { id: 'mock' } });
        } catch (err) {
          return reply(false, null, { code: 'home_assistant_error', message: err.message });
        }
      }
      default:
        return reply(false, null, { code: 'unknown_command', message: `Unknown command: ${msg.type}` });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mock Home Assistant on http://localhost:${PORT}  (token: ${TOKEN})`);
  console.log(`Preview: http://localhost:${PORT}/dev/preview.html`);
});
