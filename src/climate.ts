/**
 * Temperature bands from the design review. The pill names the band; only the
 * extremes (Cold, Warm, Hot) get a faint 18% tint in the tile's top-left corner.
 */
export type Band = 'Cold' | 'Cool' | 'Comfy' | 'Warm' | 'Hot';

export function tempBand(t: number): Band {
  if (t < 16.5) return 'Cold';
  if (t > 25) return 'Hot';
  if (t > 22) return 'Warm';
  if (t < 18) return 'Cool';
  return 'Comfy';
}

const BANDS: Record<Band, { pillBg: string; pillFg: string; tint?: string }> = {
  Cold: { pillBg: '#E3EEFB', pillFg: '#1F4E8C', tint: '156, 195, 242' },
  Cool: { pillBg: '#F1F1F4', pillFg: '#45484F' },
  Comfy: { pillBg: '#F1F1F4', pillFg: '#45484F' },
  Warm: { pillBg: '#FCEDE6', pillFg: '#8A3A1C', tint: '247, 170, 120' },
  Hot: { pillBg: '#FDE7E7', pillFg: '#9B1C1C', tint: '229, 72, 77' },
};

export function bandStyle(band: Band) {
  const b = BANDS[band];
  return {
    ...b,
    background: b.tint
      ? `radial-gradient(circle at 0% 0%, rgba(${b.tint}, 0.18) 0%, rgba(${b.tint}, 0) 55%), var(--glass-surface)`
      : 'var(--glass-surface)',
  };
}

/** Lucide battery icon by charge: full 70%+, medium 40–69, low 15–39, warning under 15. */
export function batteryIcon(level: number) {
  if (level >= 70) return 'battery-full' as const;
  if (level >= 40) return 'battery-medium' as const;
  if (level >= 15) return 'battery-low' as const;
  return 'battery-warning' as const;
}
