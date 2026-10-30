// Office screen preview: printer, power and the room alert.
import { add, start } from './mock.js';

add('header', 'glass-room-header', { area: 'office', room_path: '/dev/{area}', pinned: ['living_room', 'bedroom', 'office'] });
add('alert', 'glass-room-alert', { light: 'light.office_ceiling', switch: 'switch.office_ceiling_mains' });
add('printer', 'glass-printer', {
  name: 'P1S',
  printer_status: 'sensor.p1s_print_status',
  printer_progress: 'sensor.p1s_print_progress',
  printer_remaining: 'sensor.p1s_remaining_time',
  printer_task: 'sensor.p1s_task_name',
  camera: 'camera.p1s_chamber',
  chamber_light: 'light.p1s_chamber',
  nozzle_temp: 'sensor.p1s_nozzle_temperature',
  bed_temp: 'sensor.p1s_bed_temperature',
  ams_humidity: 'sensor.p1s_ams_humidity',
});
add('power', 'glass-switch-rows', { entities: ['switch.office_pc', 'switch.office_monitor_plug'] });
add('menu', 'glass-menu', {
  home_path: '/dev/index.html',
  rooms_path: '/dev/room.html',
  energy_path: '/dev/energy.html',
  security_path: '/dev/security.html',
});

start();
