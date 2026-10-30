// Preview harness: a fake `hass` with one light per state from the card library.
import '../src/index.js';
import type { HassEntity, HomeAssistant } from '../src/ha.js';

const light = (id: string, name: string, state: string, attrs: Record<string, unknown> = {}): HassEntity => ({
  entity_id: `light.${id}`,
  state,
  attributes: { friendly_name: name, ...attrs },
  last_changed: '',
  last_updated: '',
});

const entities: HassEntity[] = [
  light('ambient', 'Ambient', 'on', { color_mode: 'hs', rgb_color: [255, 168, 84], brightness: 112 }),
  light('blue_example', 'Blue example', 'on', { color_mode: 'xy', rgb_color: [110, 150, 255], brightness: 178 }),
  light('tv_strip', 'TV Strip', 'on', { color_mode: 'color_temp', color_temp_kelvin: 2700, brightness: 145 }),
  light('office_hue', 'Office Hue', 'on', { color_mode: 'color_temp', color_temp_kelvin: 5000, brightness: 255 }),
  light('christmas_tree', 'Christmas Tree', 'on', { color_mode: 'onoff' }),
  light('living_room_hue', 'Living Room Hue', 'on', {
    color_mode: 'brightness',
    brightness: 199,
    entity_id: ['light.lr_1', 'light.lr_2', 'light.lr_3', 'light.lr_4'],
  }),
  light('lr_1', 'LR 1', 'on'),
  light('lr_2', 'LR 2', 'on'),
  light('lr_3', 'LR 3', 'on'),
  light('lr_4', 'LR 4', 'off'),
  light('floor_lamp', 'Floor Lamp', 'off', { color_mode: null }),
  light('ceiling_nook', 'Ceiling Nook', 'unavailable'),
];

const tiles = ['ambient', 'blue_example', 'tv_strip', 'office_hue', 'christmas_tree', 'living_room_hue', 'floor_lamp', 'ceiling_nook'];

let hass: HomeAssistant = makeHass(Object.fromEntries(entities.map((e) => [e.entity_id, e])));

function makeHass(states: Record<string, HassEntity>): HomeAssistant {
  return {
    states,
    async callService(domain, service, data) {
      log(`${domain}.${service} → ${data?.entity_id}`);
      const id = data?.entity_id as string;
      const cur = hass.states[id];
      if (domain === 'light' && service === 'toggle' && cur) {
        const next = { ...cur, state: cur.state === 'on' ? 'off' : 'on' };
        hass = makeHass({ ...hass.states, [id]: next });
        render();
      }
      return undefined;
    },
  };
}

const grid = document.getElementById('tiles')!;
const cards = tiles.map((id) => {
  const card = document.createElement('glass-light-tile');
  card.setConfig({ type: 'custom:glass-light-tile', entity: `light.${id}` });
  grid.appendChild(card);
  return card;
});

function render() {
  for (const card of cards) card.hass = hass;
}

function log(text: string) {
  document.getElementById('log')!.textContent = text;
}

window.addEventListener('hass-more-info', (e) => log(`more-info → ${(e as CustomEvent).detail.entityId}`));
render();
