// Mock Home Assistant for testing the plugin without a real instance.
//
//   cd dev && npm install && npm start
//   open http://localhost:8124/dev/preview.html
//
// Serves the repo over HTTP and speaks just enough of Home Assistant's
// WebSocket API (auth, get_states, subscribe_events, call_service, ping) on
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
    ent('light.office', 'on', { friendly_name: 'Office', brightness: 153 }),
    ent('light.kitchen', 'off', { friendly_name: 'Kitchen' }),
    ent('light.living_room', 'on', { friendly_name: 'Living Room', brightness: 255 }),
    ent('switch.coffee_maker', 'off', { friendly_name: 'Coffee Maker' }),
    ent('fan.bedroom', 'off', { friendly_name: 'Bedroom Fan' }),
    ent('lock.front_door', 'locked', { friendly_name: 'Front Door' }),
    ent('cover.garage_door', 'closed', { friendly_name: 'Garage Door', device_class: 'garage' }),
    ent('cover.office_blinds', 'open', { friendly_name: 'Office Blinds', current_position: 70 }),
    ent('media_player.living_room_tv', 'paused', { friendly_name: 'Living Room TV', media_title: 'Nature Documentary' }),
    ent('input_boolean.guest_mode', 'off', { friendly_name: 'Guest Mode' }),
    ent('button.doorbell_chime', 'unknown', { friendly_name: 'Doorbell Chime' }),
    ent('climate.thermostat', 'heat', { friendly_name: 'Thermostat', current_temperature: 69 }),
    ent('sensor.outdoor_temperature', '58', { friendly_name: 'Outdoor Temperature', unit_of_measurement: '°F' }),
  ].map((e) => [e.entity_id, e])
);

// ---------------------------------------------------------------------------
// A plug-in hybrid from the Audi Connect integration (audiconnect/audi_connect_ha).
// unique_id = `${vin}_${platform}_${key}`, exactly as the integration builds it.
// ---------------------------------------------------------------------------
const AUDI_VIN = 'wauzzzfy1n2034567';
const AUDI_DEVICE = 'dev_audi_q5';
const AUDI = [
  // [domain, key, object_id, state, attributes]
  ['sensor', 'range', 'range', '312', { unit_of_measurement: 'mi', device_class: 'distance' }],
  ['sensor', 'primary_engine_range', 'primary_engine_range', '290', { unit_of_measurement: 'mi' }],
  ['sensor', 'secondary_engine_range', 'secondary_engine_range', '22', { unit_of_measurement: 'mi' }],
  ['sensor', 'tank_level', 'tank_level', '64', { unit_of_measurement: '%' }],
  ['sensor', 'state_of_charge', 'state_of_charge', '82', { unit_of_measurement: '%', device_class: 'battery' }],
  ['sensor', 'mileage', 'mileage', '18240', { unit_of_measurement: 'mi', device_class: 'distance' }],
  ['sensor', 'outdoor_temperature', 'outdoor_temperature', '58', { unit_of_measurement: '°F', device_class: 'temperature' }],
  ['sensor', 'charging_state', 'charging_state', 'notReadyForCharging', {}],
  ['sensor', 'charging_power', 'charging_power', '0', { unit_of_measurement: 'kW' }],
  ['sensor', 'remaining_charging_time', 'remaining_charging_time', '0', { unit_of_measurement: 'min' }],
  ['sensor', 'climatisation_state', 'climatisation_state', 'off', {}],
  ['sensor', 'last_update_time', 'last_update_time', new Date(Date.now() - 12 * 60000).toISOString(), { device_class: 'timestamp' }],
  ['binary_sensor', 'any_door_open', 'any_door_open', 'off', { device_class: 'door' }],
  ['binary_sensor', 'any_window_open', 'any_window_open', 'off', { device_class: 'window' }],
  ['binary_sensor', 'trunk_open', 'trunk_open', 'off', { device_class: 'opening' }],
  ['binary_sensor', 'hood_open', 'hood_open', 'off', { device_class: 'opening' }],
  ['binary_sensor', 'any_door_unlocked', 'any_door_unlocked', 'off', { device_class: 'lock' }],
  ['binary_sensor', 'plug_state', 'plug_state', 'off', { device_class: 'plug' }],
  ['binary_sensor', 'is_moving', 'is_moving', 'off', { device_class: 'moving' }],
  ['lock', 'lock', 'door_lock', 'locked', {}],
  ['climate', 'climatisation', 'climatisation', 'off', { hvac_modes: ['off', 'heat_cool'], temperature: 72, current_temperature: 58 }],
  ['button', 'refresh_vehicle_data', 'refresh_vehicle_data', 'unknown', {}],
  ['button', 'flash_lights', 'flash_lights', 'unknown', {}],
  ['device_tracker', 'position', 'position', 'not_home', { latitude: 39.9526, longitude: -75.1652, source_type: 'gps' }],
];
const entityRegistry = [];
for (const [domain, key, objectId, state, attrs] of AUDI) {
  const entityId = `${domain}.audi_q5_${objectId}`;
  const name = objectId.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  states.set(entityId, ent(entityId, state, { friendly_name: `Audi Q5 ${name}`, ...attrs }));
  entityRegistry.push({
    entity_id: entityId,
    unique_id: `${AUDI_VIN}_${domain}_${key}`,
    platform: 'audiconnect',
    device_id: AUDI_DEVICE,
    disabled_by: null,
    hidden_by: null,
  });
}
// Something from another integration, to prove the widget filters by platform.
entityRegistry.push({ entity_id: 'light.office', unique_id: 'hue-1', platform: 'hue', device_id: 'dev_hue', disabled_by: null });
const deviceRegistry = [
  { id: AUDI_DEVICE, name: 'Audi Q5', name_by_user: null, manufacturer: 'Audi', model: 'Q5 55 TFSI e', identifiers: [['audiconnect', AUDI_VIN.toUpperCase()]] },
  { id: 'dev_hue', name: 'Office light', manufacturer: 'Signify', model: 'Hue bulb', identifiers: [['hue', '1']] },
];
const audiId = (domain, objectId) => `${domain}.audi_q5_${objectId}`;

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
  // Audi Connect's own services target the car's device, not an entity.
  if (domain === 'audiconnect') {
    if (data.device_id !== AUDI_DEVICE) throw new Error('Unknown Audi device');
    if (service === 'refresh_vehicle_data') return setState(audiId('sensor', 'last_update_time'), now());
    if (service === 'execute_vehicle_action') {
      if (data.action === 'start_charger') {
        setState(audiId('binary_sensor', 'plug_state'), 'on');
        setState(audiId('sensor', 'charging_power'), '7.2');
        setState(audiId('sensor', 'remaining_charging_time'), '48');
        return setState(audiId('sensor', 'charging_state'), 'charging');
      }
      if (data.action === 'stop_charger') {
        setState(audiId('sensor', 'charging_power'), '0');
        setState(audiId('sensor', 'remaining_charging_time'), '0');
        return setState(audiId('sensor', 'charging_state'), 'readyForCharging');
      }
      throw new Error(`Action ${data.action} not supported by the mock`);
    }
    throw new Error(`Service audiconnect.${service} not supported by the mock`);
  }
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
      if (entityId === audiId('button', 'refresh_vehicle_data')) setState(audiId('sensor', 'last_update_time'), now());
      return setState(entityId, now());
    case 'climate.turn_on':
      setState(audiId('sensor', 'climatisation_state'), 'heating');
      return setState(entityId, 'heat_cool');
    case 'climate.turn_off':
      setState(audiId('sensor', 'climatisation_state'), 'off');
      return setState(entityId, 'off');
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
      case 'config/entity_registry/list': return reply(true, entityRegistry);
      case 'config/device_registry/list': return reply(true, deviceRegistry);
      case 'subscribe_events': ws.subs.add(msg.id); return reply(true, null);
      case 'ping': return ws.send(JSON.stringify({ id: msg.id, type: 'pong' }));
      case 'call_service': {
        const target = msg.target?.entity_id || msg.service_data?.entity_id;
        try {
          callService(msg.domain, msg.service, Array.isArray(target) ? target[0] : target, msg.service_data || {});
          console.log(`call_service ${msg.domain}.${msg.service} -> ${target}`);
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
