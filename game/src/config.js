// NOVA DRIFT — tuning, palette and wave table.
// Every number that shapes the game lives here so balance can be read at a glance.

export const VIEW = { w: 1280, h: 720 };

export const PALETTE = {
  bg0: '#04060f',
  bg1: '#0a1030',
  nebulaA: '#1b2a6b',
  nebulaB: '#3a1b5e',
  nebulaC: '#0e3a4d',
  star: '#cfe6ff',
  player: '#5df2ff',
  playerCore: '#eafcff',
  bullet: '#ffe066',
  bulletCore: '#fff7c0',
  enemyDrone: '#ff5d7a',
  enemyWeaver: '#c77dff',
  enemyBrute: '#ff9f43',
  enemyBoss: '#ff2e63',
  salvage: '#7dffb2',
  hullCell: '#ff8fa3',
  shield: '#4d7cff',
  text: '#dff3ff',
  dim: '#8fb4d8',
  gold: '#ffd166',
  danger: '#ff4d6d',
};

export const PLAYER = {
  radius: 16,
  accel: 1500,
  maxSpeed: 340,
  damping: 0.90, // velocity kept per 1/60s tick when no thrust
  hullMax: 100,
  shieldMax: 50,
  shieldRegen: 2.2, // per second, after 4s without damage
  fireInterval: 0.14, // seconds between shots
  bulletSpeed: 720,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 1.6,
  dashInvuln: 0.25,
  pickupRadius: 34,
  magnetRadius: 110,
};

export const ENEMIES = {
  drone: {
    label: 'DRONE', radius: 15, hull: 22, speed: 150, score: 100,
    salvage: 3, touchDamage: 10, color: PALETTE.enemyDrone, fireInterval: 0,
  },
  weaver: {
    label: 'WEAVER', radius: 16, hull: 34, speed: 120, score: 150,
    salvage: 4, touchDamage: 10, color: PALETTE.enemyWeaver, fireInterval: 2.4,
    bulletSpeed: 240, bulletDamage: 8,
  },
  brute: {
    label: 'BRUTE', radius: 26, hull: 120, speed: 62, score: 300,
    salvage: 8, touchDamage: 18, color: PALETTE.enemyBrute, fireInterval: 0,
  },
  boss: {
    label: 'LEVIATHAN', radius: 64, hull: 2400, speed: 46, score: 5000,
    salvage: 120, touchDamage: 26, color: PALETTE.enemyBoss, fireInterval: 1.15,
    bulletSpeed: 260, bulletDamage: 12,
  },
};

// Waves 1..10. `spawn` entries are [type, count] pairs released over the wave.
// Wave 10 is the boss wave: the Leviathan plus a drone escort.
export const WAVES = [
  { spawn: [['drone', 8]], trickle: 1.1 },
  { spawn: [['drone', 10], ['weaver', 2]], trickle: 1.0 },
  { spawn: [['drone', 12], ['weaver', 4]], trickle: 0.95 },
  { spawn: [['drone', 10], ['weaver', 6], ['brute', 1]], trickle: 0.9 },
  { spawn: [['drone', 14], ['weaver', 6], ['brute', 2]], trickle: 0.85 },
  { spawn: [['drone', 16], ['weaver', 8], ['brute', 3]], trickle: 0.8 },
  { spawn: [['drone', 14], ['weaver', 10], ['brute', 4]], trickle: 0.75 },
  { spawn: [['drone', 18], ['weaver', 10], ['brute', 5]], trickle: 0.7 },
  { spawn: [['drone', 20], ['weaver', 12], ['brute', 6]], trickle: 0.65 },
  { spawn: [['boss', 1], ['drone', 10], ['weaver', 4]], trickle: 1.4 },
];

export const BOSS_WAVE = 10;
export const FINAL_WAVE = 10;
export const SHOP_SECONDS = 12; // seconds the salvage shop stays open between waves

// Shop catalogue: id, key, name, description, base cost, cost growth, max level.
export const SHOP = [
  { id: 'repair', key: '1', name: 'HULL REPAIR', desc: 'Restore 40 hull', cost: 12, growth: 1.25, max: 99 },
  { id: 'damage', key: '2', name: 'HEAVY ROUNDS', desc: '+25% bullet damage', cost: 25, growth: 1.6, max: 6 },
  { id: 'rapid', key: '3', name: 'RAPID CYCLER', desc: '+18% fire rate', cost: 25, growth: 1.6, max: 6 },
  { id: 'shield', key: '4', name: 'AEGIS PLATING', desc: '+25 max shield', cost: 20, growth: 1.5, max: 5 },
  { id: 'magnet', key: '5', name: 'TRACTOR COIL', desc: '+60% pickup radius', cost: 15, growth: 1.5, max: 4 },
];

export const COMBO_WINDOW = 4; // seconds to keep the kill chain alive
export const COMBO_STEP = 0.1; // +10% score per chain step, capped at +100%
export const SALVAGE_VALUE = 1;

export const STORAGE_BEST_KEY = 'nova-drift-best-score';
