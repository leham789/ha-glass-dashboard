// Home screen preview.
import { add, start } from './mock.js';

add('header', 'glass-home-header', { area: 'living_room' });
add('favourites', 'glass-favourites', { entities: ['light.living_room_hue', 'switch.bookshelf', 'light.floor_lamp', 'scene.relax'] });
add('energy', 'glass-energy-tiles', {
  climate: 'climate.living_room',
  power: 'sensor.house_power',
  cost_entities: ['sensor.electricity_cost_today', 'sensor.gas_cost_today'],
  cost_label: 'elec + gas',
  navigation_path: '/dev/energy',
});
add('chips', 'glass-status-chips', { security_path: '/dev/security', energy_path: '/dev/energy' });
add('goodnight', 'glass-goodnight', { areas: ['living_room', 'hallway', 'kitchen', 'office'], always_show: true });
add('playing', 'glass-now-playing', {});
add('around', 'glass-around', {
  bins: ['sensor.green_bin', 'sensor.red_bin', 'sensor.grey_bin', 'sensor.blue_bin'],
  printer_status: 'sensor.p1s_print_status',
  printer_progress: 'sensor.p1s_print_progress',
  printer_remaining: 'sensor.p1s_remaining_time',
  printer_task: 'sensor.p1s_task_name',
  printer_name: 'P1S',
});
add('rooms', 'glass-rooms', {});
add('menu', 'glass-menu', {
  home_path: location.pathname,
  rooms_path: '/dev/living_room',
  energy_path: '/dev/energy',
  security_path: '/dev/security',
});
for (const id of ['ambient', 'blue_example', 'tv_strip', 'office_hue', 'christmas_tree', 'living_room_hue', 'office_group', 'floor_lamp', 'ceiling_nook']) {
  add('tiles', 'glass-light-tile', { entity: `light.${id}` });
}

start();
