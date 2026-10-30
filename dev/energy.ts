// Heating & Energy screen preview.
import { add, start } from './mock.js';

add('title', 'glass-title', { title: 'Heating & Energy' });
add('dial', 'glass-thermostat-dial', { entity: 'climate.living_room' });
add('temps', 'glass-room-temps', {});
add('electricity', 'glass-electricity', { energy: 'sensor.electricity_today', cost: 'sensor.electricity_cost_today' });
add('stats', 'glass-stat-tiles', {
  tiles: [
    { entity: 'sensor.gas_cost_today', name: 'Gas', secondary: 'sensor.gas_today', icon: 'flame' },
    { entity: 'sensor.electricity_rate', icon: 'zap' },
    { entity: 'sensor.octoplus_points', icon: 'gift', dark: true },
  ],
});
add('menu', 'glass-menu', {
  home_path: '/dev/index.html',
  rooms_path: '/dev/room.html',
  energy_path: '/dev/energy.html',
  security_path: '/dev/security.html',
});

start();
