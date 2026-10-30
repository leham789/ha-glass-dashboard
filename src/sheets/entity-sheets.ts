// Our own sheets in place of HA's more-info dialog. Importing this module makes
// openMoreInfo() (ha.ts) open them; anything without a sheet still gets HA's.
import { type HomeAssistant, setEntityOpener } from '../ha.js';
import { GlassSheet } from '../elements/glass-sheet.js';
import { GlassCameraFull } from '../elements/glass-camera-full.js';
import type { GlassEntitySheet } from './entity-sheet.js';
import './media-sheet.js';
import './light-sheet.js';
import './heating-sheet.js';
import './sensor-sheet.js';
import './person-sheet.js';
import './switch-sheet.js';

const SHEETS: Record<string, string> = {
  media_player: 'glass-media-sheet',
  light: 'glass-light-sheet',
  climate: 'glass-heating-sheet',
  sensor: 'glass-sensor-sheet',
  binary_sensor: 'glass-sensor-sheet',
  person: 'glass-person-sheet',
  switch: 'glass-switch-sheet',
  input_boolean: 'glass-switch-sheet',
};

setEntityOpener((node, entityId) => {
  const hass = (node as { hass?: HomeAssistant }).hass;
  if (!hass?.states[entityId]) return false;
  const domain = entityId.split('.')[0];
  if (domain === 'camera') {
    GlassCameraFull.open(hass, [{ entity: entityId }]);
    return true;
  }
  const tag = SHEETS[domain];
  if (!tag) return false;
  const sheet = GlassSheet.open<GlassEntitySheet>(tag, hass);
  sheet.entityId = entityId;
  return true;
});
