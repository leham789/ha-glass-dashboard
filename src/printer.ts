import type { HassEntity, HomeAssistant } from './ha.js';

export interface PrinterEntities {
  /** Status sensor (running, pause, finish, idle…), e.g. sensor.p1s_print_status. */
  printer_status?: string;
  printer_progress?: string;
  printer_remaining?: string;
  printer_task?: string;
}

export type PrinterPhase = 'printing' | 'paused' | 'done' | 'failed' | 'idle';

export interface PrinterState {
  status: HassEntity;
  phase: PrinterPhase;
  /** Printing or paused, or finished within the last two hours. */
  showFull: boolean;
  progress?: number;
  /** "1h 12m" */
  left: string;
  task: string;
}

const PRINTING = new Set(['running', 'printing', 'prepare', 'slicing', 'init', 'heating']);
const PAUSED = new Set(['pause', 'paused']);
const DONE = new Set(['finish', 'finished', 'completed', 'complete']);
const FAILED = new Set(['failed', 'error']);
const AFTER_PRINT_MS = 2 * 60 * 60 * 1000;

/** Where a 3D printer is up to, from its integration's sensors (Bambu Lab names by default). */
export function printerState(hass: HomeAssistant, c: PrinterEntities, now = new Date()): PrinterState | undefined {
  const status = hass.states[c.printer_status ?? ''];
  if (!status) return undefined;
  const s = status.state.toLowerCase();
  const phase: PrinterPhase = PRINTING.has(s) ? 'printing' : PAUSED.has(s) ? 'paused' : DONE.has(s) ? 'done' : FAILED.has(s) ? 'failed' : 'idle';
  const recent = now.getTime() - Date.parse(status.last_changed) < AFTER_PRINT_MS;
  const progress = Number(hass.states[c.printer_progress ?? '']?.state);
  const task = hass.states[c.printer_task ?? '']?.state;
  return {
    status,
    phase,
    showFull: phase === 'printing' || phase === 'paused' || ((phase === 'done' || phase === 'failed') && recent),
    progress: Number.isFinite(progress) ? progress : undefined,
    left: remaining(hass.states[c.printer_remaining ?? '']),
    task: task && task !== 'unknown' && task !== 'unavailable' ? task : '',
  };
}

/** "1h 12m" from a remaining-time sensor in minutes, hours or seconds. */
export function remaining(e?: HassEntity): string {
  const n = Number(e?.state);
  if (!e || !Number.isFinite(n) || n <= 0) return '';
  return minutesText(minutesOf(e));
}

/** The remaining time in minutes, whatever unit the sensor reports. */
export function minutesOf(e: HassEntity): number {
  const n = Number(e.state);
  const unit = String(e.attributes.unit_of_measurement ?? 'min').toLowerCase();
  return Math.round(unit.startsWith('h') ? n * 60 : unit.startsWith('s') ? n / 60 : n);
}

function minutesText(mins: number): string {
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}
