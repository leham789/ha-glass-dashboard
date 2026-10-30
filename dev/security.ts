// Security screen preview.
import { add, start } from './mock.js';

add('doors', 'glass-doors', {
  title: 'Security',
  entities: ['binary_sensor.front_door_contact', 'binary_sensor.back_door_contact'],
});
add('doorbell', 'glass-camera', {
  entity: 'camera.doorbell',
  motion_entity: 'binary_sensor.doorbell_motion',
  ding_entity: 'binary_sensor.doorbell_ding',
  heading: 'Cameras',
});
add('turret', 'glass-camera', { entity: 'camera.garden_turret', motion_entity: 'binary_sensor.garden_turret_motion' });
add('menu', 'glass-menu', {
  home_path: '/dev/index.html',
  rooms_path: '/dev/room.html',
  energy_path: '/dev/energy',
  security_path: '/dev/security.html',
});

start();
