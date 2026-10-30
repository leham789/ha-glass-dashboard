// Room screen preview (the Living Room).
import { add, start } from './mock.js';

add('header', 'glass-room-header', {
  area: 'living_room',
  room_path: '/dev/{area}',
  pinned: ['living_room', 'bedroom', 'office'],
});
add('brightness', 'glass-brightness', { entity: 'light.living_room_hue', name: 'Living Room Hue group' });
add('lights', 'glass-room-lights', { area: 'living_room' });
add('scenes', 'glass-scenes', {
  entities: ['scene.living_room_energise', 'scene.living_room_read', 'scene.living_room_relax', 'scene.living_room_nightlight'],
  title: 'Hue scenes',
});
add('climate', 'glass-thermostat-row', { entity: 'climate.living_room' });
add('media', 'glass-media', {
  entity: 'media_player.living_room_apple_tv',
  buttons: ['media_player.living_room_tv', 'media_player.living_room_ps5'],
});
add('music', 'glass-media', { entity: 'media_player.sonos_kitchen', style: 'light' });
add('menu', 'glass-menu', {
  home_path: '/dev/index.html',
  rooms_path: '/dev/room.html',
  energy_path: '/dev/energy',
  security_path: '/dev/security',
});

start();
