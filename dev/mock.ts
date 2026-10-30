// Preview harness: a fake `hass` with a small house (floors, areas, lights,
// sensors) covering every state from the card library. Pages add cards with
// add() and then call start().
import '../src/index.js';
import type { EntityRegistryEntry, HassEntity, HomeAssistant } from '../src/ha.js';

// ?dark in the URL previews HA's dark theme.
const DARK = new URLSearchParams(location.search).has('dark');

type Def = [id: string, state: string, attrs?: Record<string, unknown>, area?: string, device?: string];

/** When some things last changed, in minutes ago (everything else: an hour ago). */
const CHANGED_MINS_AGO: Record<string, number> = {
  'binary_sensor.back_door_contact': 12,
  'binary_sensor.front_door_contact': 200,
  'binary_sensor.doorbell_motion': 4,
  'binary_sensor.doorbell_ding': 95,
  'binary_sensor.garden_turret_motion': 140,
};

function minsAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

/** A placeholder camera picture. */
const CAMERA_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6b7d"/><stop offset="1" stop-color="#2c3540"/></linearGradient></defs><rect width="16" height="9" fill="url(#g)"/><rect y="6" width="16" height="3" fill="#3d4a3a"/></svg>',
)}`;

/** A stand-in event thumbnail, its sky shaded by the event id. */
function snapshot(path: string): string {
  const hue = [...path].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="hsl(${hue} 25% 45%)"/><rect y="6" width="16" height="3" fill="#3d4a3a"/><circle cx="8" cy="5" r="1.4" fill="#d8d2c4"/></svg>`,
  )}`;
}

/** A date n days from today, as "YYYY-MM-DD". */
function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defs: Def[] = [
  // Living Room (downstairs)
  ['light.ambient', 'on', { friendly_name: 'Ambient', color_mode: 'hs', rgb_color: [255, 168, 84], hs_color: [30, 67], brightness: 112, supported_color_modes: ['color_temp', 'hs'], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, effect_list: ['Candle', 'Fireplace', 'Colorloop'], effect: 'off' }, 'living_room'],
  ['light.tv_strip', 'on', { friendly_name: 'TV Strip', color_mode: 'color_temp', color_temp_kelvin: 2700, brightness: 145, supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }, 'living_room'],
  ['light.christmas_tree', 'on', { friendly_name: 'Christmas Tree', color_mode: 'onoff', supported_color_modes: ['onoff'] }, 'living_room'],
  ['light.floor_lamp', 'off', { friendly_name: 'Floor Lamp', color_mode: null }, 'living_room'],
  ['light.ceiling_nook', 'unavailable', { friendly_name: 'Ceiling Nook' }, 'living_room'],
  ['light.living_room_hue', 'on', {
    friendly_name: 'Living Room Hue',
    color_mode: 'color_temp',
    color_temp_kelvin: 2700,
    supported_color_modes: ['color_temp', 'xy'],
    brightness: 199,
    entity_id: ['light.tv_strip', 'light.floor_lamp', 'light.ceiling_nook'],
  }, 'living_room'],
  ['sensor.living_room_temperature', '17.87', { friendly_name: 'Living Room Temperature', device_class: 'temperature' }, 'living_room', 'lr_climate'],
  ['sensor.living_room_humidity', '82.3', { friendly_name: 'Living Room Humidity', device_class: 'humidity' }, 'living_room', 'lr_climate'],
  ['scene.living_room_energise', '2026-10-29T08:00:00+00:00', { friendly_name: 'Living Room Energise' }, 'living_room'],
  ['scene.living_room_read', '2026-10-29T12:00:00+00:00', { friendly_name: 'Living Room Read' }, 'living_room'],
  ['scene.living_room_relax', new Date(Date.now() - 3600_000).toISOString(), { friendly_name: 'Living Room Relax' }, 'living_room'],
  ['scene.living_room_nightlight', 'unknown', { friendly_name: 'Living Room Nightlight' }, 'living_room'],
  ['media_player.living_room_tv', 'on', { friendly_name: 'Living Room TV' }, 'living_room'],
  ['media_player.living_room_ps5', 'off', { friendly_name: 'Living Room PS5' }, 'living_room'],
  // Hallway, Kitchen (downstairs)
  ['light.hallway_ceiling', 'off', { friendly_name: 'Hallway Ceiling' }, 'hallway'],
  ['binary_sensor.front_door_contact', 'off', { friendly_name: 'Front Door Contact', device_class: 'door' }, 'hallway'],
  ['media_player.sonos_kitchen', 'idle', { friendly_name: 'Sonos Kitchen' }, 'kitchen'],
  ['media_player.living_room_apple_tv', 'playing', {
    friendly_name: 'Living Room Apple TV',
    app_name: 'Plex',
    media_title: 'Backseat Driver',
    media_duration: 5400,
    media_position: 2052,
    media_position_updated_at: new Date().toISOString(),
    // pause · volume set · mute · previous · next · play
    supported_features: 1 | 4 | 8 | 16 | 32 | 16384,
    volume_level: 0.3,
  }, 'living_room'],
  ['media_player.spotify_alex', 'playing', {
    friendly_name: 'Spotify Alex',
    app_name: 'Spotify',
    media_title: 'Night Drive',
    media_artist: 'The Glass House',
    media_duration: 204,
    media_position: 71,
    media_position_updated_at: new Date().toISOString(),
    volume_level: 0.45,
    is_volume_muted: false,
    shuffle: false,
    repeat: 'off',
    source: 'Kitchen',
    source_list: ["Alex's iPhone", 'Kitchen', 'Living Room', 'Bedroom Echo'],
    // everything: seek, shuffle, repeat and choosing a speaker too
    supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 2048 | 16384 | 32768 | 262144,
  }],
  // Office (upstairs): a room sensor plus a 3D printer's own temperatures
  ['light.office_hue', 'on', { friendly_name: 'Office Hue', color_mode: 'color_temp', color_temp_kelvin: 5000, brightness: 255 }, 'office'],
  ['light.blue_example', 'on', { friendly_name: 'Blue example', color_mode: 'xy', rgb_color: [110, 150, 255], brightness: 178 }, 'office'],
  ['sensor.office_temperature', '14.92', { friendly_name: 'Office Temperature', device_class: 'temperature' }, 'office', 'office_climate'],
  ['sensor.office_humidity', '72.6', { friendly_name: 'Office Humidity', device_class: 'humidity' }, 'office', 'office_climate'],
  ['sensor.p1s_nozzle_temperature', '220', { friendly_name: 'P1S Nozzle', device_class: 'temperature' }, 'office', 'p1s'],
  ['sensor.p1s_bed_temperature', '60', { friendly_name: 'P1S Bed', device_class: 'temperature' }, 'office', 'p1s'],
  ['sensor.p1s_progress', '42', { friendly_name: 'P1S Progress' }, 'office', 'p1s'],
  ['light.p1s_chamber', 'on', { friendly_name: 'P1S Chamber light', color_mode: 'onoff' }, 'office', 'p1s'],
  // Office power, a bulb whose wall switch is off, and the printer's camera and readings
  ['switch.office_pc', 'on', { friendly_name: 'Office PC' }, 'office', 'pc_plug'],
  ['sensor.office_pc_power', '2.2', { friendly_name: 'Office PC Power', device_class: 'power', unit_of_measurement: 'W' }, 'office', 'pc_plug'],
  ['sensor.office_pc_energy', '3.69', { friendly_name: 'Office PC Energy', device_class: 'energy', state_class: 'total_increasing', unit_of_measurement: 'kWh' }, 'office', 'pc_plug'],
  ['switch.office_monitor_plug', 'off', { friendly_name: 'Office Monitor plug' }, 'office'],
  ['light.office_ceiling', 'unavailable', { friendly_name: 'Office Ceiling' }, 'office'],
  ['switch.office_ceiling_mains', 'off', { friendly_name: 'Office Ceiling mains' }, 'office'],
  ['camera.p1s_chamber', 'streaming', { friendly_name: 'P1S Chamber', entity_picture: CAMERA_PICTURE }, 'office', 'p1s'],
  ['sensor.p1s_ams_humidity', '38', { friendly_name: 'P1S AMS humidity', device_class: 'humidity', unit_of_measurement: '%' }, 'office', 'p1s'],
  // Bedroom (upstairs)
  ['light.bedroom_left', 'off', { friendly_name: 'Bedroom Left Side' }, 'bedroom'],
  ['light.bedroom_right', 'off', { friendly_name: 'Bedroom Right Side' }, 'bedroom'],
  ['sensor.bedroom_temperature', '16.13', { friendly_name: 'Bedroom Temperature', device_class: 'temperature' }, 'bedroom'],
  ['sensor.bedroom_humidity', '74', { friendly_name: 'Bedroom Humidity', device_class: 'humidity' }, 'bedroom'],
  // Outside
  ['light.garden_fence', 'on', { friendly_name: 'Garden Fence', color_mode: 'onoff' }, 'garden'],
  ['camera.doorbell', 'recording', { friendly_name: 'Doorbell', entity_picture: CAMERA_PICTURE }, 'front', 'doorbell'],
  ['event.doorbell_smart_detection', minsAgo(4), { event_id: 'ev-person', friendly_name: 'Doorbell Smart detection', event_type: 'person' }, 'front', 'doorbell'],
  ['event.doorbell_vehicle', minsAgo(160), { event_id: 'ev-vehicle', friendly_name: 'Doorbell Vehicle', event_type: 'detected', attributes: { objectType: 'vehicle' } }, 'front', 'doorbell'],
  ['event.doorbell_doorbell', minsAgo(95), { event_id: 'ev-ring', friendly_name: 'Doorbell Doorbell', event_type: 'ring' }, 'front', 'doorbell'],
  ['event.doorbell_sound', 'unknown', { friendly_name: 'Doorbell Sound detection', event_type: null }, 'front', 'doorbell'],
  ['light.front_porch', 'off', { friendly_name: 'Porch light' }, 'front'],
  ['light.garden_lights', 'off', { friendly_name: 'Garden lights' }, 'garden'],
  ['binary_sensor.doorbell_motion', 'off', { friendly_name: 'Doorbell Motion', device_class: 'motion' }, 'front'],
  ['binary_sensor.doorbell_ding', 'off', { friendly_name: 'Doorbell Ding', device_class: 'occupancy' }, 'front'],
  ['camera.garden_turret', 'idle', { friendly_name: 'Garden Turret', entity_picture: CAMERA_PICTURE }, 'garden', 'turret'],
  ['event.garden_turret_motion_detection', minsAgo(140), { event_id: 'ev-motion', friendly_name: 'Garden Turret Motion detection', event_type: 'motion' }, 'garden', 'turret'],
  ['event.garden_turret_smart_detection', minsAgo(3000), { event_id: 'ev-animal', friendly_name: 'Garden Turret Smart detection', event_type: 'animal' }, 'garden', 'turret'],
  ['binary_sensor.garden_turret_motion', 'off', { friendly_name: 'Garden Turret Motion', device_class: 'motion' }, 'garden'],
  ['binary_sensor.back_door_contact', 'on', { friendly_name: 'Back Door Contact', device_class: 'door' }, 'back'],
  // Batteries (diagnostic entities, as Zigbee devices report them)
  ['sensor.lr_remote_battery', '12', { friendly_name: 'Living Room Remote Battery', device_class: 'battery' }, 'living_room'],
  ['sensor.guest_remote_battery', '36', { friendly_name: 'Guest Remote Battery', device_class: 'battery' }],
  ['sensor.front_door_battery', '90', { friendly_name: 'Front Door Battery', device_class: 'battery' }, 'hallway'],
  ['sensor.alex_phone_battery_level', '45', { friendly_name: "Alex's Phone Battery level", device_class: 'battery' }, undefined, 'alex_phone'],
  // A warm room and the weather, for the temperatures pop-up
  ['sensor.kitchen_temperature', '23.4', { friendly_name: 'Kitchen Temperature', device_class: 'temperature' }, 'kitchen'],
  ['weather.home', 'partlycloudy', { friendly_name: 'Home', temperature: 11.3, humidity: 90 }],
  // Bins (one Waste Collection Schedule sensor per bin) and a 3D printer
  ['sensor.green_bin', inDays(2), { friendly_name: 'Green Bin' }],
  ['sensor.red_bin', inDays(2), { friendly_name: 'Red Bin' }],
  ['sensor.grey_bin', inDays(2), { friendly_name: 'Grey Bin' }],
  ['sensor.blue_bin', inDays(9), { friendly_name: 'Blue Bin' }],
  ['sensor.p1s_print_status', 'running', { friendly_name: 'P1S Print status' }, 'office', 'p1s'],
  ['sensor.p1s_print_progress', '42', { friendly_name: 'P1S Print progress', unit_of_measurement: '%' }, 'office', 'p1s'],
  ['sensor.p1s_remaining_time', '72', { friendly_name: 'P1S Remaining time', unit_of_measurement: 'min' }, 'office', 'p1s'],
  ['sensor.p1s_task_name', 'Plant-pot-plug', { friendly_name: 'P1S Task name' }, 'office', 'p1s'],
  // The Bambu Lab integration's layer, target and control entities on the same device
  ['sensor.p1s_current_layer', '16', { friendly_name: 'P1S Current layer' }, 'office', 'p1s'],
  ['sensor.p1s_total_layer_count', '37', { friendly_name: 'P1S Total layer count' }, 'office', 'p1s'],
  ['sensor.p1s_target_nozzle_temperature', '220', { friendly_name: 'P1S Target nozzle temperature', device_class: 'temperature' }, 'office', 'p1s'],
  ['sensor.p1s_target_bed_temperature', '60', { friendly_name: 'P1S Target bed temperature', device_class: 'temperature' }, 'office', 'p1s'],
  ['button.p1s_pause', 'unknown', { friendly_name: 'P1S Pause printing' }, 'office', 'p1s'],
  ['button.p1s_resume', 'unknown', { friendly_name: 'P1S Resume printing' }, 'office', 'p1s'],
  ['button.p1s_stop', 'unknown', { friendly_name: 'P1S Stop printing' }, 'office', 'p1s'],
  // Home header, favourites and the Heating & Energy tiles
  ['person.alex', 'home', { friendly_name: 'Alex Morgan', user_id: 'user-1', source: 'device_tracker.alex_phone' }],
  ['device_tracker.alex_phone', 'home', { friendly_name: "Alex's iPhone" }, undefined, 'alex_phone'],
  ['scene.relax', 'unknown', { friendly_name: 'Relax' }],
  ['switch.bookshelf', 'on', { friendly_name: 'Bookshelf' }],
  ['climate.living_room', 'heat', {
    friendly_name: 'Living Room thermostat',
    temperature: 17,
    current_temperature: 18.0,
    hvac_action: 'idle',
    hvac_modes: ['heat', 'off'],
    preset_modes: ['comfort', 'eco', 'boost', 'away'],
    preset_mode: 'comfort',
    min_temp: 10,
    max_temp: 30,
    target_temp_step: 0.5,
  }, 'living_room'],
  ['sensor.electricity_today', '15.3', { friendly_name: 'Electricity today', device_class: 'energy', unit_of_measurement: 'kWh' }],
  ['sensor.gas_today', '20.3', { friendly_name: 'Gas today', device_class: 'energy', unit_of_measurement: 'kWh' }],
  ['sensor.electricity_rate', '0.204', { friendly_name: 'Electricity rate', unit_of_measurement: 'GBP/kWh' }],
  ['sensor.octoplus_points', '612', { friendly_name: 'Octoplus points' }],
  ['sensor.house_power', '408', { friendly_name: 'House power', device_class: 'power', unit_of_measurement: 'W' }],
  ['sensor.electricity_cost_today', '3.59', { friendly_name: 'Electricity cost today', unit_of_measurement: 'GBP' }],
  ['sensor.gas_cost_today', '1.36', { friendly_name: 'Gas cost today', unit_of_measurement: 'GBP' }],
  // Not in a room: light-tile states only
  ['light.office_group', 'on', {
    friendly_name: 'Office Hue Group',
    color_mode: 'color_temp',
    color_temp_kelvin: 4500,
    brightness: 255,
    entity_id: ['light.ceiling_nook', 'light.floor_lamp'],
  }],
];

const states = Object.fromEntries(
  defs.map(([entity_id, state, attributes = {}]) => [
    entity_id,
    { entity_id, state, attributes, last_changed: minsAgo(CHANGED_MINS_AGO[entity_id] ?? 60), last_updated: '' } as HassEntity,
  ]),
);
const entities: Record<string, EntityRegistryEntry> = Object.fromEntries(
  defs.map(([entity_id, , , area, device]) => [
    entity_id,
    { entity_id, area_id: area ?? null, device_id: device ?? null, platform: entity_id.includes('phone') ? 'mobile_app' : entity_id.startsWith('event.') ? 'unifiprotect' : undefined },
  ]),
);
const floors = {
  downstairs: { floor_id: 'downstairs', name: 'Downstairs', level: 0 },
  upstairs: { floor_id: 'upstairs', name: 'Upstairs', level: 1 },
  outside: { floor_id: 'outside', name: 'Outside', level: null },
};
const area = (area_id: string, name: string, floor_id: string) => ({ area_id, name, floor_id });
const areas = {
  living_room: area('living_room', 'Living Room', 'downstairs'),
  hallway: area('hallway', 'Hallway', 'downstairs'),
  kitchen: area('kitchen', 'Kitchen', 'downstairs'),
  office: area('office', 'Office', 'upstairs'),
  bedroom: area('bedroom', 'Bedroom', 'upstairs'),
  garden: area('garden', 'Garden', 'outside'),
  front: area('front', 'Front', 'outside'),
  back: area('back', 'Back', 'outside'),
};

const userData: Record<string, unknown> = {};

let hass: HomeAssistant = makeHass(states);

function makeHass(states: Record<string, HassEntity>): HomeAssistant {
  return {
    states,
    themes: { darkMode: DARK },
    entities,
    devices: {
      lr_climate: { id: 'lr_climate', name: 'Living Room Thermometer' },
      office_climate: { id: 'office_climate', name: 'Office Climate' },
      p1s: { id: 'p1s', name: 'P1S' },
      pc_plug: { id: 'pc_plug', name: 'Office PC plug' },
      alex_phone: { id: 'alex_phone', name: "Alex's iPhone" },
      doorbell: { id: 'doorbell', name: 'Doorbell', config_entries: ['protect'] },
      turret: { id: 'turret', name: 'Garden Turret', config_entries: ['protect'] },
    },
    areas,
    floors,
    user: { id: 'user-1', name: 'Alex' },
    // History for the energy chart: a reading every 10 minutes, busier in the evening.
    async callWS<T>(msg: Record<string, unknown>) {
      // HA's per-user storage, kept in memory here.
      if (msg.type === 'frontend/get_user_data') return { value: userData[msg.key as string] ?? null } as T;
      if (msg.type === 'frontend/set_user_data') {
        userData[msg.key as string] = msg.value;
        return {} as T;
      }
      // Event thumbnails: a stand-in picture, a different shade per event.
      if (msg.type === 'auth/sign_path') return { path: snapshot(msg.path as string) } as T;
      const id = (msg.entity_ids as string[])[0];
      const start = Date.parse(msg.start_time as string);
      const points: { s: string; lu: number; a?: Record<string, unknown> }[] = [];
      if (id === 'sensor.electricity_today') {
        // kWh today: climbs through the day, busiest in the evening, resets at midnight.
        let kwh = 0;
        let day = new Date(start).getDate();
        for (let t = start; t < Date.now(); t += 900_000) {
          const d = new Date(t);
          if (d.getDate() !== day) (kwh = 0), (day = d.getDate());
          const h = d.getHours();
          kwh += (h >= 17 && h <= 21 ? 0.3 : h >= 7 ? 0.12 : 0.05) * (0.8 + Math.random() * 0.4);
          points.push({ s: kwh.toFixed(2), lu: t / 1000 });
        }
        return { [id]: points } as T;
      }
      const now = hass.states[id];
      const domain = id.split('.')[0];
      if (['binary_sensor', 'switch', 'input_boolean', 'person', 'light'].includes(domain)) {
        // A day of switching: on/open (or away) a few times, ending in the state it's in now.
        const on = domain === 'person' ? 'not_home' : 'on';
        const off = domain === 'person' ? 'home' : 'off';
        const flips = [6.9, 7.2, 8.6, 12.4, 13.1, 17.0, 18.0];
        let s = off;
        points.push({ s, lu: start / 1000 });
        for (let t = start; t < Date.now(); t += 3_600_000 / 4) {
          const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
          if (flips.some((f) => Math.abs(f - h) < 0.13)) points.push({ s: (s = s === on ? off : on), lu: t / 1000 });
        }
        if (now && now.state !== s) points.push({ s: now.state, lu: Date.parse(now.last_changed) / 1000 });
        return { [id]: points } as T;
      }
      if (domain === 'climate') {
        // Room temperature drifting down at night, heated morning and evening.
        for (let t = start; t < Date.now(); t += 1_800_000) {
          const h = new Date(t).getHours();
          const target = h >= 6 && h < 9 ? 18 : h >= 17 && h < 22 ? 19 : 16;
          const cur = 16.2 + (h >= 7 && h < 10 ? 1.8 : h >= 18 && h < 23 ? 2.2 : 0.4 * Math.sin(h));
          points.push({ s: 'heat', lu: t / 1000, a: { current_temperature: +cur.toFixed(1), temperature: target, hvac_action: cur < target ? 'heating' : 'idle' } } as never);
        }
        return { [id]: points } as T;
      }
      const base = Number(now?.state);
      if (Number.isFinite(base) && now?.attributes.device_class !== 'power') {
        for (let t = start; t < Date.now(); t += 1_800_000) {
          const h = new Date(t).getHours();
          points.push({ s: String(+(base * (1 + 0.06 * Math.sin((h / 24) * Math.PI * 2))).toFixed(2)), lu: t / 1000 });
        }
        points.push({ s: now!.state, lu: Date.now() / 1000 });
        return { [id]: points } as T;
      }
      for (let t = start; t < Date.now(); t += 600_000) {
        const hour = new Date(t).getHours();
        points.push({ s: String(150 + (hour >= 17 && hour <= 21 ? 900 : 200) * Math.random()), lu: t / 1000 });
      }
      return { [id]: points } as T;
    },
    async callService(domain, service, data) {
      const targets = [data?.entity_id].flat() as string[];
      log(`${domain}.${service} → ${targets.join(', ')}`);
      if (domain === 'media_player' && service === 'media_play_pause') {
        const p = hass.states[targets[0]];
        const state = p.state === 'playing' ? 'paused' : 'playing';
        hass = makeHass({ ...hass.states, [p.entity_id]: { ...p, state, last_changed: new Date().toISOString() } });
        render();
        return;
      }
      if (domain === 'homeassistant') {
        const id = targets[0];
        // Powering a bulb's mains switch brings the bulb back.
        if (id === 'switch.office_ceiling_mains' && service === 'turn_on') {
          hass = makeHass({
            ...hass.states,
            [id]: { ...hass.states[id], state: 'on' },
            'light.office_ceiling': { ...hass.states['light.office_ceiling'], state: 'off' },
          });
          render();
          return;
        }
        hass = makeHass({ ...hass.states, [id]: { ...hass.states[id], state: service === 'turn_on' ? 'on' : 'off' } });
        render();
        return;
      }
      if (domain === 'scene') {
        const id = targets[0];
        hass = makeHass({ ...hass.states, [id]: { ...hass.states[id], state: new Date().toISOString() } });
        render();
        return;
      }
      if (domain === 'media_player' && service !== 'media_play_pause') {
        const id = targets[0];
        const e = hass.states[id];
        const change: Record<string, unknown> = {
          shuffle_set: { shuffle: data?.shuffle },
          repeat_set: { repeat: data?.repeat },
          volume_set: { volume_level: data?.volume_level, is_volume_muted: false },
          volume_mute: { is_volume_muted: data?.is_volume_muted },
          select_source: { source: data?.source },
          media_seek: { media_position: data?.seek_position, media_position_updated_at: new Date().toISOString() },
        }[service] as Record<string, unknown>;
        if (change) {
          hass = makeHass({ ...hass.states, [id]: { ...e, attributes: { ...e.attributes, ...change } } });
          render();
          return;
        }
      }
      if (domain === 'button' && service === 'press') {
        // The printer's own buttons: pause, resume and stop change its status.
        const status = hass.states['sensor.p1s_print_status'];
        const next = targets[0].endsWith('_pause') ? 'pause' : targets[0].endsWith('_resume') ? 'running' : 'idle';
        hass = makeHass({ ...hass.states, [status.entity_id]: { ...status, state: next, last_changed: new Date().toISOString() } });
        render();
        return;
      }
      if (domain === 'climate' && service === 'set_preset_mode') {
        const id = targets[0];
        const e = hass.states[id];
        hass = makeHass({ ...hass.states, [id]: { ...e, attributes: { ...e.attributes, preset_mode: data!.preset_mode } } });
        render();
        return;
      }
      if (domain === 'climate' && service === 'set_hvac_mode') {
        const id = targets[0];
        hass = makeHass({ ...hass.states, [id]: { ...hass.states[id], state: data!.hvac_mode as string } });
        render();
        return;
      }
      if (domain === 'climate' && service === 'set_temperature') {
        const id = targets[0];
        const e = hass.states[id];
        hass = makeHass({ ...hass.states, [id]: { ...e, attributes: { ...e.attributes, temperature: data!.temperature } } });
        render();
        return;
      }
      if (domain === 'media_player' && (service === 'turn_on' || service === 'turn_off')) {
        const id = targets[0];
        hass = makeHass({ ...hass.states, [id]: { ...hass.states[id], state: service === 'turn_on' ? 'on' : 'off' } });
        render();
        return;
      }
      if (domain !== 'light') return;
      // Like HA: switching a group switches its reachable members too.
      const next = { ...hass.states };
      const state = service === 'toggle' ? (next[targets[0]]?.state === 'on' ? 'off' : 'on') : service === 'turn_on' ? 'on' : 'off';
      for (const id of targets) {
        for (const e of [id, ...((next[id]?.attributes.entity_id as string[] | undefined) ?? [])]) {
          if (next[e] && next[e].state !== 'unavailable') next[e] = { ...next[e], state };
        }
        // Brightness and colour presets, as HA would report them back.
        const attrs: Record<string, unknown> = {};
        if (typeof data?.brightness_pct === 'number') attrs.brightness = Math.round((data.brightness_pct / 100) * 255);
        if (typeof data?.color_temp_kelvin === 'number') Object.assign(attrs, { color_mode: 'color_temp', color_temp_kelvin: data.color_temp_kelvin });
        if (Array.isArray(data?.hs_color)) {
          const [h] = data.hs_color as number[];
          const f = (n: number) => Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - ((n + h / 30) % 12), 1))));
          Object.assign(attrs, { color_mode: 'hs', hs_color: data.hs_color, rgb_color: [f(0), f(8), f(4)] });
        }
        if (typeof data?.effect === 'string') attrs.effect = data.effect;
        if (next[id] && Object.keys(attrs).length) next[id] = { ...next[id], attributes: { ...next[id].attributes, ...attrs } };
      }
      hass = makeHass(next);
      render();
    },
  };
}

const cards: { hass?: HomeAssistant }[] = [];

export function add(containerId: string, type: string, config: Record<string, unknown>) {
  const card = document.createElement(type) as HTMLElement & { setConfig(c: unknown): void; hass?: HomeAssistant };
  card.setConfig({ type: `custom:${type}`, ...config });
  document.getElementById(containerId)!.appendChild(card);
  cards.push(card);
}

function render() {
  for (const card of cards) card.hass = hass;
}

function log(text: string) {
  document.getElementById('log')!.textContent = text;
}

export function start() {
  if (DARK) {
    document.body.style.background = '#141518';
    document.body.style.color = '#f2f3f5';
  }
  // A small Light / Dark switch for the preview pages.
  const toggle = document.createElement('a');
  const url = new URL(location.href);
  if (DARK) url.searchParams.delete('dark');
  else url.searchParams.set('dark', '');
  toggle.href = url.toString();
  toggle.textContent = DARK ? 'Light' : 'Dark';
  toggle.setAttribute('style', 'position:fixed;top:12px;right:12px;z-index:10;padding:6px 12px;border-radius:14px;font:13px Outfit,system-ui,sans-serif;text-decoration:none;background:#121316;color:#fff');
  document.body.appendChild(toggle);
  window.addEventListener('hass-more-info', (e) => log(`more-info → ${(e as CustomEvent).detail.entityId}`));
  render();
}
