// Bedroom screen preview: lamp tiles, climate tiles and the devices row.
import { add, start } from './mock.js';

add('header', 'glass-room-header', { area: 'bedroom', room_path: '/dev/{area}', pinned: ['living_room', 'bedroom', 'office'] });
add('brightness', 'glass-brightness', { entity: 'light.bedroom_hue', name: 'Bedroom Hue group', lamps: true });
add('climate', 'glass-room-climate', { area: 'bedroom' });
add('devices', 'glass-room-devices', { area: 'bedroom' });
add('menu', 'glass-menu', {
  home_path: '/dev/index.html',
  rooms_path: '/dev/room.html',
  energy_path: '/dev/energy.html',
  security_path: '/dev/security.html',
});

start();
