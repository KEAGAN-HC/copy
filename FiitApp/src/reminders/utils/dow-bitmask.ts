export type Dow = 0|1|2|3|4|5|6; // 0=Dom..6=Sáb

export function isDayEnabled(mask: number, dow: Dow): boolean {
  if (mask == null) return false;
  return ((mask >> dow) & 1) === 1;
}

export function nextEnabledDowFrom(mask: number, startDow: Dow): Dow | null {
  for (let i = 0; i < 7; i++) {
    const d = (startDow + i) % 7 as Dow;
    if (isDayEnabled(mask, d)) return d;
  }
  return null;
}
