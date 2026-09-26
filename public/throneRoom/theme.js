export const CASTLE_PALETTE = Object.freeze({
  void: '#05070d',
  voidWarm: '#121018',
  stoneDark: '#242a33',
  stoneMid: '#353d49',
  stoneLight: '#596371',
  mortar: 'rgba(12, 15, 21, 0.58)',
  marbleDark: '#545863',
  marbleMid: '#727681',
  marbleLight: '#9899a0',
  ivory: '#d7cfbd',
  goldDark: '#6f4c1d',
  gold: '#c99c43',
  goldLight: '#f2d48b',
  crimsonDark: '#4b1018',
  crimson: '#8f1827',
  crimsonLight: '#bc3040',
  royalBlueDark: '#0e203f',
  royalBlue: '#214d86',
  royalBlueLight: '#4d79aa',
  flame: '#ffd88a',
  flameHot: '#fff4c7'
});

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function hash2D(x, y, salt = 0) {
  let value = Math.imul((x | 0) + 0x7ed55d16 + salt, 0x85ebca6b);
  value ^= Math.imul((y | 0) + 0xc761c23c, 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x27d4eb2d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967295;
}

export function isCastleFloorType(tileType) {
  return tileType === 'castle_floor'
    || tileType === 'dais_floor'
    || tileType === 'marble_edge'
    || String(tileType || '').startsWith('marble_floor');
}

export function isCarpetType(tileType) {
  return tileType === 'royal_carpet'
    || String(tileType || '').startsWith('red_carpet');
}
