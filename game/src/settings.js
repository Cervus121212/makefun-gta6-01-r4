// Porto Vela — settings: every tuneable number, name and story beat in one place.
// Anchor quoted in this session, as the kit requires:
// makefun anchor 17b138850fe459bff90c181758b7e073e54f3aa1 round 34084966
export const WORLD = {
  block: 64, road: 16, half: 288,
  gridLines: [-256, -192, -128, -64, 0, 64, 128, 192, 256],
  beachZ: 224, docksX: 224, seaZ: 296,
  dayLength: 480, // game-seconds per full daylight slide
  startCash: 0,
};

export const PLAYER = {
  walkSpeed: 7, runSpeed: 11, turnSpeed: 3.4,
  hp: 100, armour: 50,
  spawn: { x: -60, z: -150, heading: Math.PI / 2 },
  safehouseDoor: { x: -60, z: -168 },
};

export const DRIVE = {
  accel: 16, brake: 30, reverse: 9, maxSpeed: 42, maxReverse: 12,
  steer: 1.9, grip: 6, drag: 0.35,
};

export const GARAGE = { x: -120, z: 24 };
export const YACHT = { x: 60, z: 232 };
export const MARINA = { x: 60, z: 232 };

// Eight districts, north (z-) to south (z+). streetAt() resolves names from coords.
export const DISTRICTS = [
  { name: 'North Gate', blurb: 'Truck yards and the last cheap fuel in Vela.', z0: -288, z1: -192 },
  { name: 'Old Mill', blurb: 'Warehouses, pawn shops and tired neon.', z0: -192, z1: -128 },
  { name: 'Coral Row', blurb: 'Apartments stacked over corner stores.', z0: -128, z1: -64 },
  { name: 'Plaza Mayor', blurb: 'The cathedral, the market, the mayor\'s cameras.', z0: -64, z1: 0 },
  { name: 'La Luna', blurb: 'Bars that never close and doors that never open.', z0: 0, z1: 64 },
  { name: 'Palm Court', blurb: 'Hotels with pools and guests with secrets.', z0: 64, z1: 128 },
  { name: 'Miramar Strip', blurb: 'Boardwalk lights and the smell of fried plantain.', z0: 128, z1: 192 },
  { name: 'Coral Shore', blurb: 'Sand, surf and the last road out of town.', z0: 192, z1: 288 },
];

export const STREETS_X = ['Harbor Ave', 'Gull St', 'Paloma Blvd', 'Calle Luna', 'Ocean Blvd', 'Marlin Way', 'Coral Ave', 'Dune Rd', 'Pier St'];
export const STREETS_Z = ['North Gate Rd', 'Mill St', 'Coral Row', 'Plaza Way', 'Luna St', 'Palm Dr', 'Miramar Blvd', 'Shore Ave', 'Boardwalk'];

// Mission definitions: step is 1-based. Rewards total $19,000.
export const MISSIONS = [
  { name: 'First Wheels', chapter: 'CH 1', reward: 500,
    brief: 'Steal the coupe from the garage, then bring it home.',
    next: 'Take the coupe to the safehouse.',
    garage: { x: -120, z: 24 }, home: { x: -60, z: -168 } },
  { name: 'The Pickup', chapter: 'CH 2', reward: 800,
    brief: 'A package waits at the docks. Collect it, come home.',
    next: 'Collect the package at the docks.',
    pickup: { x: 264, z: 60 }, home: { x: -60, z: -168 } },
  { name: 'Hot Pursuit', chapter: 'CH 3', reward: 1200,
    brief: 'Three stars on you. Lose the heat — all of it.',
    next: 'Lose the cops. Get to zero stars.',
    startStars: 3 },
  { name: 'Dockside Deal', chapter: 'CH 4', reward: 2000,
    brief: 'Four of Mara\'s men guard the cash at the docks. Drop them.',
    next: 'Take out all four guards, then grab the cash.',
    arena: { x: 264, z: 120 }, guards: 4 },
  { name: 'Getaway Driver', chapter: 'CH 5', reward: 2500,
    brief: 'Pick up the courier at the marina. North gate, 90 seconds.',
    next: 'Reach the north gate before the clock dies.',
    pickup: { x: 60, z: 232 }, dest: { x: -150, z: -232 }, limit: 90 },
  { name: 'The Informant', chapter: 'CH 6', reward: 3000,
    brief: 'A green sedan circles the plaza. Ram it until it talks.',
    next: 'Ram the green sedan until it stops.',
    center: { x: 40, z: 80 }, rx: 70, rz: 55, speed: 0.12, hp: 120 },
  { name: 'Beachfront Heist', chapter: 'CH 7', reward: 4000,
    brief: 'Steal the van on the beach, then lose three stars at home.',
    next: 'Steal the van, then get home with the heat on.',
    van: { x: -180, z: 232 }, home: { x: -60, z: -168 } },
  { name: 'King of Vela', chapter: 'CH 8', reward: 5000,
    brief: 'Survive a full minute at four stars. Then sail home.',
    next: 'Survive 60 seconds at four stars.',
    startStars: 4, survive: 60, yacht: { x: 60, z: 232 } },
];

export const WEAPONS = [
  { name: 'PISTOL', dmg: 34, range: 42, rate: 0.32, ammo: Infinity, auto: false },
  { name: 'SMG', dmg: 22, range: 36, rate: 0.11, ammo: 120, auto: true },
];
export const ENEMY_SHOT_DMG = 2;

export const RADIO = [
  { name: 'COSTA 88', dj: 'DJ Neon', track: 'Neon Drive — Pink Horizon', bpm: 112, wave: 'sawtooth' },
  { name: 'LA VOZ 104', dj: 'La Voz', track: 'Calle Luna — Rosa Del Mar', bpm: 96, wave: 'square' },
  { name: 'ONDA 97', dj: 'DJ Marea', track: 'Tide Runner — Coral Ghosts', bpm: 124, wave: 'triangle' },
];

// Police callsigns — original, sea-animal Spanish names.
export const CALLSIGNS = ['ALBATROS', 'ANCHOA', 'BAGRE', 'CALAMAR', 'DORADA', 'ESTURION', 'FOCA', 'GAMBAS'];
export const POLICE_TAGS = ['RAMMING', 'CUTTING OFF', 'PURSUIT', 'EN ROUTE', 'SPOTLIGHT ON YOU'];

export const CAR_NAMES = ['VELA GT', 'COSTA S', 'MARINA X', 'SOLANO', 'BRISA 2', 'TIBURON'];
export const PLAYER_CAR_NAME = 'VELA GT';

export const MINIMAP_COLORS = {
  land: '#4d555e', road: '#9aa3ad', sand: '#dcc78f', sea: '#2a7a9e',
  park: '#6a9a5a', docks: '#96999e', building: '#3a4048',
};

export const SUN = {
  pos: [-260, 78, 330], discR: 36, discColor: 0xff8a1e, duskColor: 0xff5a14,
  haloR: 58, haloOpacity: 0.28,
};

export const SAVE_KEY = 'portovela-save-v3';
export const CLOCK_START_MIN = 18 * 60 + 53; // 18:53
export const CLOCK_RATE = 0.25; // minutes per game-second

export function repRank(rep) {
  if (rep >= 1280) return 'KING OF VELA';
  if (rep >= 480) return 'DRIVER';
  return 'ROOKIE';
}
