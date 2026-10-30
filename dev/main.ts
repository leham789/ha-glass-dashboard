// Preview harness: a fake `hass` with a small house (floors, areas, lights,
// sensors) covering every state from the card library.
import '../src/index.js';
import type { EntityRegistryEntry, HassEntity, HomeAssistant } from '../src/ha.js';

type Def = [id: string, state: string, attrs?: Record<string, unknown>, area?: string, device?: string];

const defs: Def[] = [
  // Living Room (downstairs)
  ['light.ambient', 'on', { friendly_name: 'Ambient', color_mode: 'hs', rgb_color: [255, 168, 84], brightness: 112 }, 'living_room'],
  ['light.tv_strip', 'on', { friendly_name: 'TV Strip', color_mode: 'color_temp', color_temp_kelvin: 2700, brightness: 145 }, 'living_room'],
  ['light.christmas_tree', 'on', { friendly_name: 'Christmas Tree', color_mode: 'onoff' }, 'living_room'],
  ['light.floor_lamp', 'off', { friendly_name: 'Floor Lamp', color_mode: null }, 'living_room'],
  ['light.ceiling_nook', 'unavailable', { friendly_name: 'Ceiling Nook' }, 'living_room'],
  ['light.living_room_hue', 'on', {
    friendly_name: 'Living Room Hue',
    color_mode: 'brightness',
    brightness: 199,
    entity_id: ['light.tv_strip', 'light.floor_lamp', 'light.ceiling_nook'],
  }, 'living_room'],
  ['sensor.living_room_temperature', '17.87', { friendly_name: 'Living Room Temperature', device_class: 'temperature' }, 'living_room', 'lr_climate'],
  ['sensor.living_room_humidity', '82.3', { friendly_name: 'Living Room Humidity', device_class: 'humidity' }, 'living_room', 'lr_climate'],
  // Hallway, Kitchen (downstairs)
  ['light.hallway_ceiling', 'off', { friendly_name: 'Hallway Ceiling' }, 'hallway'],
  ['binary_sensor.front_door_contact', 'off', { friendly_name: 'Front Door Contact', device_class: 'door' }, 'hallway'],
  ['media_player.sonos_kitchen', 'idle', { friendly_name: 'Sonos Kitchen' }, 'kitchen'],
  // Office (upstairs): a room sensor plus a 3D printer's own temperatures
  ['light.office_hue', 'on', { friendly_name: 'Office Hue', color_mode: 'color_temp', color_temp_kelvin: 5000, brightness: 255 }, 'office'],
  ['light.blue_example', 'on', { friendly_name: 'Blue example', color_mode: 'xy', rgb_color: [110, 150, 255], brightness: 178 }, 'office'],
  ['sensor.office_temperature', '14.92', { friendly_name: 'Office Temperature', device_class: 'temperature' }, 'office', 'office_climate'],
  ['sensor.office_humidity', '72.6', { friendly_name: 'Office Humidity', device_class: 'humidity' }, 'office', 'office_climate'],
  ['sensor.p1s_nozzle_temperature', '220', { friendly_name: 'P1S Nozzle', device_class: 'temperature' }, 'office', 'p1s'],
  ['sensor.p1s_bed_temperature', '60', { friendly_name: 'P1S Bed', device_class: 'temperature' }, 'office', 'p1s'],
  ['sensor.p1s_progress', '42', { friendly_name: 'P1S Progress' }, 'office', 'p1s'],
  ['light.p1s_chamber', 'on', { friendly_name: 'P1S Chamber light', color_mode: 'onoff' }, 'office', 'p1s'],
  // Bedroom (upstairs)
  ['light.bedroom_left', 'off', { friendly_name: 'Bedroom Left Side' }, 'bedroom'],
  ['light.bedroom_right', 'off', { friendly_name: 'Bedroom Right Side' }, 'bedroom'],
  ['sensor.bedroom_temperature', '16.13', { friendly_name: 'Bedroom Temperature', device_class: 'temperature' }, 'bedroom'],
  ['sensor.bedroom_humidity', '74', { friendly_name: 'Bedroom Humidity', device_class: 'humidity' }, 'bedroom'],
  // Outside
  ['light.garden_fence', 'on', { friendly_name: 'Garden Fence', color_mode: 'onoff' }, 'garden'],
  ['binary_sensor.back_door_contact', 'on', { friendly_name: 'Back Door Contact', device_class: 'door' }, 'back'],
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
    { entity_id, state, attributes, last_changed: '', last_updated: '' } as HassEntity,
  ]),
);
const entities: Record<string, EntityRegistryEntry> = Object.fromEntries(
  defs.map(([entity_id, , , area, device]) => [entity_id, { entity_id, area_id: area ?? null, device_id: device ?? null }]),
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
  back: area('back', 'Back', 'outside'),
};

let hass: HomeAssistant = makeHass(states);

function makeHass(states: Record<string, HassEntity>): HomeAssistant {
  return {
    states,
    entities,
    devices: {},
    areas,
    floors,
    async callService(domain, service, data) {
      const targets = [data?.entity_id].flat() as string[];
      log(`${domain}.${service} → ${targets.join(', ')}`);
      if (domain !== 'light') return;
      // Like HA: switching a group switches its reachable members too.
      const state = service === 'turn_on' ? 'on' : 'off';
      const next = { ...hass.states };
      for (const id of targets) {
        for (const e of [id, ...((next[id]?.attributes.entity_id as string[] | undefined) ?? [])]) {
          if (next[e] && next[e].state !== 'unavailable') next[e] = { ...next[e], state };
        }
      }
      hass = makeHass(next);
      render();
    },
  };
}

const cards: { hass?: HomeAssistant }[] = [];

function add(containerId: string, type: string, config: Record<string, unknown>) {
  const card = document.createElement(type) as HTMLElement & { setConfig(c: unknown): void; hass?: HomeAssistant };
  card.setConfig({ type: `custom:${type}`, ...config });
  document.getElementById(containerId)!.appendChild(card);
  cards.push(card);
}

add('rooms', 'glass-rooms', {});
for (const id of ['ambient', 'blue_example', 'tv_strip', 'office_hue', 'christmas_tree', 'living_room_hue', 'office_group', 'floor_lamp', 'ceiling_nook']) {
  add('tiles', 'glass-light-tile', { entity: `light.${id}` });
}

function render() {
  for (const card of cards) card.hass = hass;
}

function log(text: string) {
  document.getElementById('log')!.textContent = text;
}

window.addEventListener('hass-more-info', (e) => log(`more-info → ${(e as CustomEvent).detail.entityId}`));
render();
