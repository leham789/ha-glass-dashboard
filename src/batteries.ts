import type { HomeAssistant } from './ha.js';
import { areaOf, shortName } from './rooms.js';

export const LOW_BATTERY = 40;

export interface Battery {
  id: string;
  level: number;
  /** The room it's in, or for a phone the phone's name. */
  room: string;
  /** What it is: "Remote", "Motion", "Phone". */
  device: string;
  phone: boolean;
}

/** Every battery sensor in HA, lowest first. Phones (the HA app) are marked. */
export function batteries(hass: HomeAssistant): Battery[] {
  return Object.values(hass.states)
    .filter((e) => {
      const level = Number(e.state);
      return (
        e.entity_id.startsWith('sensor.') &&
        e.attributes.device_class === 'battery' &&
        e.state !== '' &&
        Number.isFinite(level) &&
        !hass.entities?.[e.entity_id]?.hidden
      );
    })
    .map((e) => {
      const phone = hass.entities?.[e.entity_id]?.platform === 'mobile_app';
      const areaId = areaOf(hass, e.entity_id);
      const areaName = areaId ? (hass.areas?.[areaId]?.name ?? '') : '';
      const name = withoutBattery(shortName(e, areaName));
      return {
        id: e.entity_id,
        level: Math.round(Number(e.state)),
        room: phone ? name : areaName || name,
        device: phone ? 'Phone' : areaName ? name : '',
        phone,
      };
    })
    .sort((a, b) => a.level - b.level);
}

/** "Remote Battery" → "Remote", "Liam's iPhone Battery level" → "Liam's iPhone". */
function withoutBattery(name: string): string {
  return name.replace(/\s*battery(\s+level)?$/i, '').trim() || name;
}
