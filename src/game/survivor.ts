// @ts-nocheck
/* Tiny Vampire-Survivors-style game. One thumb moves the hero; attacks are automatic.
   Stats come from the player's real budget (see profile.ts). */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const WNAMES = { arrow: 'Bow', magic: 'Magic', sword: 'Sword', potion: 'Potion', lightning: 'Lightning', axe: 'Axe', boomerang: 'Boomerang', laser: 'Laser' };
const WIDS = Object.keys(WNAMES);
const SLOTS = 3; // weapons a hero can carry at once
// What reaching each weapon level gives (index = level)
const LV = {
  arrow: [null, 'Arrows fly the way you face', '+1 arrow per shot', 'Arrows pierce 1 more monster', '+1 arrow per shot', 'Faster arrows and a 15% chance for a double-damage crit', 'Pierce 2 more monsters', 'MAX Arrow Storm: a rapid wall of 7 arrows'],
  magic: [null, 'Homing bolts that each hit one monster', '+1 bolt per cast', 'Small blast: monsters next to the target take 35% damage', '+1 bolt per cast', 'Faster, sharper homing', 'Bigger blast, 50% damage', 'MAX Seeker Swarm: every hit splits into 2 homing shards, +1 bolt'],
  sword: [null, 'Blades circle you', '+1 blade', 'Blades spin 25% faster, are longer and orbit wider', '+1 blade', 'Bloodlust: blades turn crimson and every 20th hit heals you 2% HP', '+1 blade', 'MAX Blade Tempest: a second ring spinning the other way'],
  potion: [null, 'Flasks make slowing, poisonous puddles', '+1 flask', 'Bigger puddles', '+1 flask', 'Stronger poison (+40%); monsters that die in poison leave a small puddle', 'Puddles last 60% longer and slow harder', 'MAX Toxic Fog: flasks sweep a clockwise ring all around you'],
  axe: [null, 'A heavy swing in a wide arc where you face', 'Double swing: forward, then a backswing', 'A shockwave rolls forward after the swing', 'Wider arc', 'Half-second stun on hit', 'Bigger shockwave that travels further', 'MAX Earthsplitter: the shockwave crosses the whole map'],
  boomerang: [null, 'Thrown at the nearest monster, flies its full range, then returns, hitting both ways (range grows a little each level); the next throw waits for it', '+1 boomerang', 'Ricochet: bounces to 1 other monster after its first hit', '+1 boomerang', 'The return trip hits 50% harder', 'Faster, bigger arc and 2 bounces', 'MAX Rampage: your throws fly 60% farther, bigger, through every monster; extra boomerangs roam the arena on their own, bouncing toward the crowd'],
  laser: [null, 'An orb circles you and zaps a straight beam toward the nearest monster, full reach', '+1 orb', 'Burn: monsters it hits keep burning, longer reach', '+1 orb', 'Burning monsters take 40% more beam damage', 'Shorter rest between beams, longer reach', 'MAX Worldbreaker: +1 orb, beams run to the wall, almost no rest'],
  lightning: [null, 'Lightning strikes and jumps to a nearby monster', '+1 strike', '+1 chain', '+1 strike', 'Wider strike zone', 'Chains keep full damage and +1 chain', 'MAX Thunderstorm: 4 strikes at once, chains to 6'],
};
const GENERIC = [
  { id: 'dup', name: 'Duplicate', desc: '+1 projectile, blade or strike for all weapons', max: 2, rare: 0.22 },
  { id: 'multi', name: 'Multishot', desc: 'Every attack repeats once more right after', max: 2, rare: 0.22 },
  { id: 'dmg', name: 'Sharper edge', desc: '+7% damage to everything', max: 8 },
  { id: 'rate', name: 'Quick hands', desc: '+20% fire rate (blades spin faster too)', max: 8 },
  { id: 'speed', name: 'Swift boots', desc: '+10% move speed', max: 5 },
  { id: 'hp', name: 'Vitality', desc: '+30 max health and heal 30', max: 6 },
  { id: 'magnet', name: 'Magnet', desc: '+40% gem pickup range', max: 4 },
  { id: 'heal', name: 'Snack', desc: 'Heal 40% of your health', max: 99 },
];
const PRIMARY = { archer: 'arrow', mage: 'magic', swordsman: 'sword' };
const GLYPH = { heart: '❤️', magnet: '🧲', shield: '🛡️', boots: '⚡', chest: '🎁' };
const AX = 800, AY = 280; // the play field is a long hallway running across the map: x from -AX to AX, y from -AY to AY
const MAX_BLADES_PER_RING = 6; // 12 blades total with the second ring

export function startGame(canvas, profile, opts, ui) {
  const D = opts.duration;                     // seconds for a full run
  const ctx = canvas.getContext('2d');
  const SP = opts.sprites;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, raf = 0, stopped = false, paused = false, last = performance.now();
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);

  const FX = opts.fx || { dmg: 0, rate: 0, hp: 0, speed: 0, magnet: 0, xp: 0, drop: 0, revive: 0, guard: 0 };
  const HARD = { hp: 1.2, dmg: 1.3, wave: 1.2 }; // base difficulty: harsh for new players, relics bring it back down
  let revived = false;
  const P = { x: 0, y: 0, hp: profile.maxHp + FX.hp, maxHp: profile.maxHp + FX.hp, inv: 0, face: 1, dir: 0, level: 1, xp: 0, need: 3 };
  const main = PRIMARY[profile.job] || 'arrow';
  const R = profile.rank, isMain = k => k === main;
  const up = { arrow: 0, magic: 0, sword: 0, potion: 0, lightning: 0, axe: 0, boomerang: 0, laser: 0, dup: 0, multi: 0, dmg: 0, rate: 0, speed: 0, hp: 0, magnet: 0, heal: 0 };
  up[main] = profile.rank; // your job's weapon starts at your saver level
  const wmul = k => (k === main ? [1.3, 1.5, 1.8][profile.rank - 1] : 1);
  const owned = () => WIDS.filter(k => up[k] > 0);

  let swHits = 0, redSword = null;
  let warned = false, firstDone = false, sweep = 0, t = 0, kills = 0, arrowCd = 0, magicCd = 0, potionCd = 1, lightCd = 1, orbAng = 0, spawnCd = 0, novaCd = 5, bossA = false, bossB = false, over = false;
  let nextMini = D / 5, nextSwarm = D * 0.3, miniN = 0;
  const buffs = { inv: 0, speed: 0 };
  const enemies = [], shots = [], gems = [], pops = [], items = [], puddles = [], flasks = [], bolts = [], novas = [], delayed = [];
  const fxs = [], waves = [], swings = [], scars = [], booms = [], loopers = [], beams = [];
  let orbL = 0, axeCd = 1.5, boomCd = 1, laserOn = false, laserT = 1, laserTick = 0, loopA = 0;
  const keys = {};
  let joy = null; // {id, ox, oy, x, y}

  const distSeg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1; const u = clamp(((px - x1) * dx + (py - y1) * dy) / l2); return Math.hypot(px - (x1 + dx * u), py - (y1 + dy * u)); };
  const later = (d, fn) => delayed.push({ at: t + d, fn });
  const volley = fire => { fire(); for (let i = 1; i <= up.multi; i++) later(0.14 * i, fire); };
  const onScreen = e => Math.abs(e.x - P.x) < W / 2 && Math.abs(e.y - P.y) < H / 2;
  const inView = e => Math.abs(e.x - P.x) < W * 0.62 && Math.abs(e.y - P.y) < H * 0.62;

  /* ---------- input ---------- */
  const noSel = e => e.preventDefault();
  const down = e => { window.getSelection?.()?.removeAllRanges(); if (joy) return; canvas.setPointerCapture?.(e.pointerId); const r = canvas.getBoundingClientRect(); joy = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top }; e.preventDefault(); };
  const move = e => { if (!joy || e.pointerId !== joy.id) return; const r = canvas.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; };
  const end = e => { if (joy && e.pointerId === joy.id) joy = null; };
  const kd = e => { keys[e.key.toLowerCase()] = true; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault(); };
  const ku = e => { keys[e.key.toLowerCase()] = false; };
  canvas.addEventListener('contextmenu', noSel); canvas.addEventListener('selectstart', noSel); canvas.addEventListener('dragstart', noSel);
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const vis = () => { if (document.hidden) paused = true; };
  document.addEventListener('visibilitychange', vis);

  /* ---------- stats ---------- */
  const dmg = () => 10 * profile.damage * (1 + 0.07 * up.dmg) * (1 + FX.dmg) * (1 - 0.68 * Math.pow(progress(), 1.1)); // damage eases off late so late monsters don't melt
  const rate = () => 1.1 * (1 + 0.2 * up.rate) * (1 + FX.rate);
  const spd = () => 125 * profile.speed * (1 + 0.1 * up.speed) * (1 + FX.speed) * (buffs.speed > 0 ? 1.5 : 1);
  const magnet = () => 70 * (1 + 0.4 * up.magnet) * (1 + FX.magnet);
  const progress = () => clamp(t / D);

  /* ---------- spawning ---------- */
  const TYPES = {
    slime: { r: 11, hp: 14, sp: 38, dmg: 8, xp: 1 },
    bat: { r: 9, hp: 9, sp: 78, dmg: 6, xp: 1 },
    goblin: { r: 12, hp: 32, sp: 55, dmg: 11, xp: 2 },
    skeleton: { r: 13, hp: 26, sp: 48, dmg: 9, xp: 2 },
    mushroom: { r: 12, hp: 44, sp: 44, dmg: 10, xp: 2 },
    ogre: { r: 22, hp: 130, sp: 40, dmg: 20, xp: 6 },
    king: { r: 40, hp: 4500, sp: 42, dmg: 30, xp: 40, boss: true },
    dragon: { r: 52, hp: 24000, sp: 52, dmg: 38, xp: 80, boss: true },
  };
  function spawn(type, o = {}) {
    const T = TYPES[type], a = o.angle ?? rnd(0, Math.PI * 2), d = o.dist ?? Math.max(W, H) / 2 + 50;
    const p = progress();
    // early monsters are soft (die in one hit); late ones get much tougher and hit harder
    const hpScale = (T.boss ? 1 + p * 4 : (0.5 + 5 * Math.pow(p, 1.5) + 45 * Math.pow(p, 3)) * HARD.hp) * (o.hp || 1), dmgScale = (0.8 + 1.4 * p) * HARD.dmg;
    const big = o.mini ? 2.1 : 1;
    let sx = P.x + Math.cos(a) * d, sy = P.y + Math.sin(a) * d;
    if (Math.abs(sx) > AX) sx = P.x - Math.cos(a) * d;
    if (Math.abs(sy) > AY) sy = P.y - Math.sin(a) * d;
    sx = clamp(sx, -AX, AX); sy = clamp(sy, -AY, AY);
    enemies.push({ type, x: sx, y: sy, r: T.r * big, hp: T.hp * hpScale, maxHp: T.hp * hpScale, sp: T.sp * (1 + progress() * 0.7) * (o.sp || 1), dmg: T.dmg * dmgScale * (o.mini ? 1.5 : 1), xp: T.xp * (o.mini ? 4 : 1), boss: !!T.boss || !!o.mini, mini: !!o.mini, hit: 0, ph: Math.random() * 6, slow: 0 });
  }
  function pickType(p) {
    const roll = Math.random();
    let type = 'slime';
    if (p > 0.08 && roll < 0.35) type = 'bat';
    if (p > 0.12 && roll < 0.3) type = 'skeleton';
    if (p > 0.25 && roll < 0.2) type = 'mushroom';
    if (p > 0.2 && roll < 0.22) type = 'goblin';
    if (p > 0.35 && roll < 0.05 + p * 0.12) type = 'ogre';
    return type;
  }
  // Monsters come in bursts from one side. Gaps get shorter and bursts bigger; the next burst never waits for you to clear the last.
  function spawnWave(dt) {
    const p = progress();
    spawnCd -= dt;
    if (spawnCd <= 0 && enemies.length < 450) {
      const first = !firstDone; firstDone = true;
      spawnCd = 1.2 + 4 * Math.pow(1 - p, 1.3);
      const n = first ? 4 : Math.round((4 + Math.floor(Math.pow(p, 1.5) * 85) + Math.floor(p * 6)) * HARD.wave * (1 + 0.8 * p)), a0 = rnd(0, Math.PI * 2), main = pickType(p);
      for (let i = 0; i < n; i++) spawn(Math.random() < 0.7 ? main : pickType(p), { angle: a0 + rnd(-0.7, 0.7), dist: Math.max(W, H) / 2 + 50 + rnd(0, 90) });
    }
    if (!bossA && p >= 0.5) { bossA = true; spawn('king'); ui.banner('The Ogre King approaches!'); }
    if (!bossB && p >= 0.9) { bossB = true; spawn('dragon'); ui.banner('The Dragon awakens!'); }
    // a champion every D/5 (2 minutes in a full run); each drops a treasure chest
    if (t >= nextMini && p < 0.86) { nextMini += D / 5; const ty = ['goblin', 'skeleton', 'mushroom', 'ogre'][miniN++ % 4]; spawn(ty, { mini: true, hp: 40, sp: 0.9 }); ui.banner('A champion appears!'); }
    // a swarm every 0.3D (3 minutes in a full run)
    if (t >= nextSwarm && p < 0.86) { nextSwarm += D * 0.22; swarm(); }
  }
  function swarm() {
    const n = 40 + Math.floor(progress() * 90), dist = Math.max(W, H) * 0.55;
    for (let i = 0; i < n; i++) spawn(Math.random() < 0.65 ? 'bat' : (progress() > 0.4 && Math.random() < 0.3 ? 'goblin' : 'slime'), { angle: (i / n) * Math.PI * 2, dist, hp: 0.6, sp: 1.15 });
    ui.banner('A swarm is coming!');
  }

  /* ---------- level up and rewards ---------- */
  const wl = L => (1 + 0.12 * (L - 1)) * (L >= 7 ? 1.15 : 1); // weapon damage grows with level, with a bonus at max
  const wopt = k => ({ id: k, weapon: true, name: up[k] ? `${WNAMES[k]} Lv ${up[k] + 1}` : `New: ${WNAMES[k]}`, desc: LV[k][up[k] + 1] + (up[k] >= 1 && up[k] < 6 ? ' · +12% damage' : up[k] === 6 ? ' · +32% damage' : ''), have: up[k] });
  function choices() {
    const slotsFree = owned().length < SLOTS, list = [];
    for (const k of WIDS) if ((up[k] > 0 && up[k] < 7) || (up[k] === 0 && slotsFree)) list.push(wopt(k));
    for (const u of GENERIC) if (up[u.id] < u.max) list.push({ ...u, have: up[u.id] });
    const out = [];
    while (out.length < 3 && list.length) {   // weighted draw: Duplicate and Multishot are rare
      const w = list.map(o => o.rare || 1), sum = w.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum, i = 0; while (i < list.length - 1 && (r -= w[i]) > 0) i++;
      out.push(list.splice(i, 1)[0]);
    }
    return out;
  }
  function applyChoice(id) {
    up[id]++;
    if (LV[id] && up[id] === 7) ui.banner(LV[id][7].split(':')[0].replace('MAX ', 'MAX: ') + '!');
    if (id === 'hp') { P.maxHp += 30; P.hp = Math.min(P.maxHp, P.hp + 30); }
    if (id === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4);
  }
  function showChoices(title) {
    const opts2 = choices();
    if (opts2.length === 1 && opts2[0].id === 'heal') {   // nothing left to upgrade: heal automatically, no pause
      const before = P.hp; applyChoice('heal'); ui.banner(`${title} Healed ${Math.round(P.hp - before)} HP`); return;
    }
    paused = true;
    ui.levelUp(opts2, id => { applyChoice(id); paused = false; last = performance.now(); }, title);
  }
  function addXp(v) {
    P.xp += v * (1 + FX.xp);
    if (P.xp >= P.need) { P.xp -= P.need; P.level++; P.need = Math.round(8 + P.level * 5 + Math.pow(P.level, 1.7) * 0.9); showChoices('Level up!'); }
  }
  function openChest() {
    const r = Math.random();
    if (r < 0.3) { P.hp = P.maxHp; ui.banner('Treasure: full health!'); return; }
    if (r < 0.65) {
      const slotsFree = owned().length < SLOTS, cand = WIDS.filter(k => (up[k] > 0 && up[k] < 7) || (up[k] === 0 && slotsFree));
      if (cand.length) { const k = pick(cand); up[k]++; ui.banner(up[k] === 1 ? `Treasure: new weapon, ${WNAMES[k]}!` : `Treasure: ${WNAMES[k]} is now Lv ${up[k]}!`); return; }
    }
    showChoices('Treasure!');
  }
  function collect(it) {
    if (it.type === 'heart') { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.2); pop(P.x, P.y - 20, '+HP'); }
    else if (it.type === 'magnet') { for (const g of gems) g.vac = true; ui.banner('Magnet!'); }
    else if (it.type === 'shield') { buffs.inv = 6; ui.banner('Invincible!'); }
    else if (it.type === 'boots') { buffs.speed = 8; ui.banner('Speed boost!'); }
    else if (it.type === 'chest') openChest();
  }
  function dropFor(e) {
    if (e.mini) { items.push({ x: e.x, y: e.y, type: 'chest', life: 1e9 }); return; }
    if (e.boss) return;
    const low = P.hp < P.maxHp * 0.4;
    if (Math.random() > (low ? 0.022 : 0.014) * (1 + FX.drop) / (1 + 5 * Math.pow(progress(), 1.5))) return; // fewer drops per kill late, when there are far more kills
    const w = [['heart', low ? 0.3 : 0.1], ['magnet', 0.25], ['shield', 0.25], ['boots', 0.25]], sum = w.reduce((s, x) => s + x[1], 0);
    let r = Math.random() * sum, type = 'heart';
    for (const [k, v] of w) { if ((r -= v) <= 0) { type = k; break; } }
    items.push({ x: e.x, y: e.y, type, life: 25 });
  }

  /* ---------- weapons ---------- */
  /* ----- axe: heavy cleave where you face; shockwave from L3 ----- */
  const kbNudge = (e, px, py, dist) => { if (e.boss || e.kbCd > t) return; e.kbCd = t + 1.5; const dx = e.x - px, dy = e.y - py, l = Math.hypot(dx, dy) || 1; e.x = clamp(e.x + (dx / l) * dist, -AX, AX); e.y = clamp(e.y + (dy / l) * dist, -AY, AY); };
  function axeSwing(a) {
    const L = up.axe, half = L >= 4 ? 1.15 : 0.9, reach = 95, d0 = dmg() * 4.5 * wl(L);
    swings.push({ x: P.x, y: P.y, a, half, reach, life: 0.26, dur: 0.26 }); fx('slash', P.x + Math.cos(a) * reach * 0.5, P.y + Math.sin(a) * reach * 0.5, reach * 1.9, { a, dur: 0.26 });
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - P.x, dy = e.y - P.y, l = Math.hypot(dx, dy);
      if (l > reach + e.r) continue;
      let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > half && l > e.r + 20) continue;
      hurt(e, d0); kbNudge(e, P.x, P.y, 26);
      if (L >= 5 && !e.boss && !(e.stunCd > t)) { e.stun = t + 0.5; e.stunCd = t + 1.6; }
    }
    if (L >= 3) waves.push({ x0: P.x, y0: P.y, a, s: 20, max: L >= 7 ? 1e9 : L >= 6 ? 360 : 200, w: L >= 7 ? 95 : L >= 6 ? 62 : 46, d: d0 * (L >= 7 ? 0.9 : 0.6), full: L >= 7, hit: new Set() });
  }
  function axeAttack() {
    const L = up.axe, dirs = [P.dir, P.dir + Math.PI, P.dir + Math.PI / 2].slice(0, 1 + up.dup);
    dirs.forEach((a, i) => { axeSwing(a); if (L >= 2 && i === 0) later(0.25, () => axeSwing(a + Math.PI)); });
  }
  /* ----- boomerang: curves out, returns; hits both ways. L7 = loops around you ----- */
  function throwBooms() {
    const L = up.boomerang, n = 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0) + up.dup;
    let ba = P.dir, bd = 1e9;   // aim at the nearest monster in view; face the way you move if none
    for (const e of enemies) if (e.hp > 0 && inView(e)) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; if (d < bd) { bd = d; ba = Math.atan2(e.y - P.y, e.x - P.x); } }
    for (let i = 0; i < n; i++) {
      const a = ba + (i % 2 ? -0.25 : 0.25) * Math.floor((i + 1) / 2);
      booms.push({ x: P.x, y: P.y, a, sp: 340 * (L >= 6 ? 1.3 : 1), curve: 0, phase: 0, t: 0, out: (130 + 10 * (L - 1)) * (L >= 7 ? 1.6 : 1) / (340 * (L >= 6 ? 1.3 : 1)), hit: new Set(), r: L >= 7 ? 21 : L >= 6 ? 14 : 10, spin: 0, bounces: L >= 7 ? 0 : L >= 6 ? 2 : L >= 3 ? 1 : 0 });
    }
  }
  /* ----- laser: a beam that locks on and burns the whole line ----- */
  const laserOrbs = () => (up.laser >= 7 ? 4 : 1 + (up.laser >= 2 ? 1 : 0) + (up.laser >= 4 ? 1 : 0)) + up.dup;
  const laserRange = () => up.laser >= 7 ? 1e9 : [0, 260, 300, 340, 380, 450, 520][up.laser] || 260;   // how far it can lock on AND how far the beam reaches
  const orbPos = i => { const n = laserOrbs(), a = orbL + (i * Math.PI * 2) / n; return [P.x + Math.cos(a) * 46, P.y + Math.sin(a) * 46]; };
  const laserLen = (x0, y0, a) => {   // max level: the beam runs on until it hits a wall
    if (up.laser < 7) return laserRange();
    const ux = Math.cos(a), uy = Math.sin(a), tx = ux > 1e-6 ? (AX - x0) / ux : ux < -1e-6 ? (-AX - x0) / ux : 1e9, ty = uy > 1e-6 ? (AY - y0) / uy : uy < -1e-6 ? (-AY - y0) / uy : 1e9;
    return Math.max(40, Math.min(tx, ty));
  };
  const inLaser = e => e.hp > 0 && onScreen(e) && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < laserRange() ** 2;   // only monsters you can see, and inside its reach
  function pickLaserTarget(i, taken) {   // nearest monster in range that no other beam is using
    let best = null, bd = 1e18; const [ox0, oy0] = orbPos(i);
    for (const e of enemies) { if (!inLaser(e) || taken.has(e)) continue; const d = (e.x - ox0) ** 2 + (e.y - oy0) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function startLaser() {   // each orb locks its target's direction now; the beam keeps that angle, following only your movement
    beams.length = 0; const taken = new Set(), n = laserOrbs();
    for (let i = 0; i < n; i++) {
      const e = pickLaserTarget(i, taken) || pickLaserTarget(i, new Set()); if (!e) continue; taken.add(e);
      const [x0, y0] = orbPos(i); beams.push({ i, dx: x0 - P.x, dy: y0 - P.y, a: Math.atan2(e.y - y0, e.x - x0) });
    }
  }
  function fireArrows() {
    const L = up.arrow, storm = L >= 7, n = storm ? 7 + up.dup : 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0) + up.dup;
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2, a = storm ? P.dir + rnd(-0.03, 0.03) : P.dir + off * 0.14;
      const px = storm ? P.x - Math.sin(P.dir) * off * 8 : P.x, py = storm ? P.y + Math.cos(P.dir) * off * 8 : P.y;
      const crit = Math.random() < (isMain('arrow') && R >= 3 ? 0.25 : 0) + (L >= 5 ? 0.15 : 0);
      shots.push({ kind: 'arrow', x: px, y: py, a, vx: Math.cos(a) * 420 * (L >= 5 ? 1.25 : 1), vy: Math.sin(a) * 420 * (L >= 5 ? 1.25 : 1), life: 1.2, dmg: dmg() * wmul('arrow') * wl(L) * (storm ? 0.6 : 1) * (crit ? 2 : 1), crit: crit || storm, pierce: 1 + (L >= 3 ? 1 : 0) + (L >= 6 ? 2 : 0) + (isMain('arrow') && R >= 2 ? 1 : 0), hit: [] });
    }
  }
  function fireMagic() {
    // like arrows: only fires when a monster is on screen, nearest first, one bolt per monster
    const L = up.magic, want = (L >= 7 ? 4 : 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0)) + up.dup;
    const near = enemies.filter(e => e.hp > 0 && inView(e)).sort((a, b) => (a.x - P.x) ** 2 + (a.y - P.y) ** 2 - (b.x - P.x) ** 2 - (b.y - P.y) ** 2);
    const n = Math.min(want, near.length);
    for (let i = 0; i < n; i++) {
      const e = near[i], a = Math.atan2(e.y - P.y, e.x - P.x), up2 = isMain('magic') && R >= 2 ? 1.25 : 1;
      shots.push({ kind: 'magic', x: P.x, y: P.y, a, sp: 150 * up2 * (L >= 5 ? 1.2 : 1), target: e, turn: 4 * up2 * (L >= 5 ? 1.5 : 1), life: 3.6, dmg: dmg() * 3.2 * wmul('magic') * wl(L), reseek: isMain('magic') && R >= 3 ? 1 : 0 });
    }
  }
  function shards(from, d) {
    const others = enemies.filter(o => o !== from && o.hp > 0 && (o.x - from.x) ** 2 + (o.y - from.y) ** 2 < 260 * 260).sort((a, b) => (a.x - from.x) ** 2 + (a.y - from.y) ** 2 - (b.x - from.x) ** 2 - (b.y - from.y) ** 2).slice(0, 2);
    for (const o of others) shots.push({ kind: 'magic', shard: true, x: from.x, y: from.y, a: Math.atan2(o.y - from.y, o.x - from.x), sp: 230, target: o, turn: 7, life: 1.4, dmg: d, reseek: 0 });
  }
  const anyInView = () => enemies.some(e => e.hp > 0 && inView(e));
  const potionR = L => 36 * (L >= 3 ? 1.3 : 1) * (L >= 7 ? 1.2 : 1);
  function throwPotions() {
    // Flasks land around you, roughly on the 8 compass directions. Low level = loose and random, high level = a tidy ring. Never on top of another puddle.
    const L = up.potion, n = (L >= 7 ? 5 : 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0)) + up.dup, r = potionR(L), pred = clamp((L - 1) / 6);
    if (L >= 7) {   // max level: flasks fly out one after another in a clockwise ring that surrounds you
      sweep += Math.PI / n;
      for (let i = 0; i < n; i++) later(i * 0.1, () => {
        const a = sweep + (i * Math.PI * 2) / n, d = 70 + r, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
        flasks.push({ x0: P.x, y0: P.y, x, y, at: t + 0.55, dur: 0.55, L, r });
      });
      return;
    }
    const start = Math.floor(Math.random() * 8);
    const taken = (x, y) => puddles.some(q => (q.x - x) ** 2 + (q.y - y) ** 2 < ((q.r + r) * 0.8) ** 2) || flasks.some(q => (q.x - x) ** 2 + (q.y - y) ** 2 < ((q.r + r) * 0.8) ** 2);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const slot = tries === 0 && Math.random() < 0.35 + 0.65 * pred ? (start + Math.round((i * 8) / n)) % 8 : Math.floor(Math.random() * 8);
        const a = slot * Math.PI / 4 + rnd(-1, 1) * (1 - pred) * 0.45, d = (70 + r) * (1 + (1 - pred) * rnd(-0.25, 0.35));
        const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
        if (taken(x, y)) continue;
        flasks.push({ x0: P.x, y0: P.y, x, y, at: t + 0.55, dur: 0.55, L, r });
        break;
      }
    }
  }
  function strikeLightning() {
    const L = up.lightning, n = (L >= 7 ? 4 : 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0)) + up.dup, chain = L >= 7 ? 6 : 1 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0), zone = L >= 5 ? 55 : 36;
    const near = enemies.filter(e => e.hp > 0 && onScreen(e));
    for (let i = 0; i < n; i++) {
      let x, y;
      if (near.length && Math.random() < 0.5 + 0.35 * clamp((L - 1) / 6)) { const e = pick(near); x = e.x; y = e.y; } else { const a = rnd(0, Math.PI * 2), d = rnd(40, 190); x = clamp(P.x + Math.cos(a) * d, P.x - W / 2 + 15, P.x + W / 2 - 15); y = clamp(P.y + Math.sin(a) * d, P.y - H / 2 + 15, P.y + H / 2 - 15); }
      const d0 = dmg() * 3 * wl(L), hit = new Set(), pts = [[x, y]];
      let cx = x, cy = y;
      for (const e of enemies) if (e.hp > 0 && onScreen(e) && (e.x - x) ** 2 + (e.y - y) ** 2 < (zone + e.r) ** 2) { hurt(e, d0); hit.add(e); e.shock = t + 0.55; }
      for (let c = 0; c < chain; c++) {
        let best = null, bd = 130 * 130;
        for (const e of enemies) { if (e.hp <= 0 || hit.has(e) || !onScreen(e)) continue; const d = (e.x - cx) ** 2 + (e.y - cy) ** 2; if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        hurt(best, d0 * (L >= 6 ? 1 : 0.7)); best.shock = t + 0.55; hit.add(best); cx = best.x; cy = best.y; pts.push([cx, cy]);
      }
      bolts.push({ x, y, pts, life: 0.28, seed: Math.random() * 99 }); fx('strike', x, y + 14, zone * 3.4);
    }
  }

  /* ---------- update ---------- */
  function update(dt) {
    t += dt;
    for (const k in buffs) buffs[k] = Math.max(0, buffs[k] - dt);
    // move
    let mx = 0, my = 0;
    if (keys['arrowleft'] || keys['a']) mx -= 1; if (keys['arrowright'] || keys['d']) mx += 1;
    if (keys['arrowup'] || keys['w']) my -= 1; if (keys['arrowdown'] || keys['s']) my += 1;
    if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy); if (l > 6) { mx = dx / Math.max(l, 40); my = dy / Math.max(l, 40); } }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    P.x = clamp(P.x + mx * spd() * dt, -AX, AX); P.y = clamp(P.y + my * spd() * dt, -AY, AY);
    if (ml > 0.05) { P.dir = Math.atan2(my, mx); if (Math.abs(mx) > 0.05) P.face = mx > 0 ? 1 : -1; }
    P.inv = Math.max(0, P.inv - dt);
    spawnWave(dt);
    for (let i = delayed.length - 1; i >= 0; i--) if (t >= delayed[i].at) { const f = delayed[i].fn; delayed.splice(i, 1); f(); }

    // enemies
    for (const e of enemies) {
      const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1, k = e.stun > t ? 0 : e.slow > t ? (e.slowK || 0.45) : 1;
      e.x = clamp(e.x + (dx / l) * e.sp * k * dt, -AX - 20, AX + 20); e.y = clamp(e.y + (dy / l) * e.sp * k * dt, -AY - 20, AY + 20); e.vx = dx; e.hit = Math.max(0, e.hit - dt); e.ph += dt * 6;
      if (e.burn > t) { e.bt = (e.bt || 0) - dt; if (e.bt <= 0) { e.bt = 0.5; hurt(e, e.burnD); } }
      if (l < e.r + 10 && P.inv <= 0 && buffs.inv <= 0) { P.hp -= e.dmg * (1 - FX.guard); P.inv = 0.6; ui.shake(); if (P.hp <= 0) { if (FX.revive && !revived) { revived = true; P.hp = P.maxHp * 0.5; P.inv = 2.5; ui.banner('Phoenix Ledger: back on your feet!'); } else return finish(false); } }
    }
    // soft separation so monsters don't stack into one dot
    for (let i = 0; i < enemies.length; i += 2) {
      const a = enemies[i], b = enemies[(i * 7 + 3) % enemies.length]; if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1, m = a.r + b.r;
      if (l < m) { const k = (m - l) / 2; a.x += (dx / l) * k * 0.5; a.y += (dy / l) * k * 0.5; b.x -= (dx / l) * k * 0.5; b.y -= (dy / l) * k * 0.5; }
    }

    // arrows: only in the direction you face. Level 7 = Arrow Storm
    arrowCd -= dt;
    if (up.arrow > 0 && arrowCd <= 0) {
      arrowCd = 0.85 / rate() / (isMain('arrow') && R >= 2 ? 1.15 : 1) / (up.arrow >= 7 ? 2.5 : 1);
      volley(fireArrows);
    }
    // magic: homing bolts, one monster each. Level 7 = Seeker Swarm
    magicCd -= dt;
    if (up.magic > 0 && magicCd <= 0 && anyInView()) { magicCd = 2.1 / rate(); volley(fireMagic); }
    // potion
    potionCd -= dt;
    if (up.potion > 0 && potionCd <= 0) { potionCd = 3.2 / rate(); volley(throwPotions); }
    // lightning
    lightCd -= dt;
    if (up.lightning > 0 && lightCd <= 0) { lightCd = 3.6 / rate(); volley(strikeLightning); }

    // axe
    axeCd -= dt;
    if (up.axe > 0 && axeCd <= 0 && anyInView()) { axeCd = Math.max(1.5, 3.5 / rate()); volley(axeAttack); }
    for (let i = swings.length - 1; i >= 0; i--) { swings[i].life -= dt; if (swings[i].life <= 0) swings.splice(i, 1); }
    for (let i = scars.length - 1; i >= 0; i--) { scars[i].life -= dt; if (scars[i].life <= 0) scars.splice(i, 1); }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.s += 480 * dt;
      const ux = Math.cos(w.a), uy = Math.sin(w.a), fx = w.x0 + ux * w.s, fy = w.y0 + uy * w.s;
      for (const e of enemies) {
        if (e.hp <= 0 || w.hit.has(e)) continue;
        const rx = e.x - w.x0, ry = e.y - w.y0, u = rx * ux + ry * uy, v = -rx * uy + ry * ux;
        if (Math.abs(v) < w.w + e.r && Math.abs(u - w.s) < 28 + e.r) { w.hit.add(e); hurt(e, w.full ? w.d : w.d * (1 - 0.6 * (w.s / w.max))); }
      }
      if (w.s > w.max || Math.abs(fx) > AX + 60 || Math.abs(fy) > AY + 60) { if (w.full) { const L2 = Math.hypot(fx - w.x0, fy - w.y0), nx = -(fy - w.y0) / (L2 || 1), ny = (fx - w.x0) / (L2 || 1), pts = []; for (let d = 0; d <= L2; d += 36) { const j = d === 0 || d + 36 > L2 ? 0 : rnd(-9, 9); pts.push([w.x0 + (fx - w.x0) * d / (L2 || 1) + nx * j, w.y0 + (fy - w.y0) * d / (L2 || 1) + ny * j]); } scars.push({ pts, life: 1.3 }); } waves.splice(i, 1); }
    }
    // boomerang
    if (!booms.length) boomCd -= dt;   // the next throw waits until the last one is back
    if (up.boomerang > 0 && !booms.length && boomCd <= 0 && anyInView()) { boomCd = 0.45 / rate(); volley(throwBooms); }
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]; b.t += dt; b.spin += dt * 16;
      if (b.phase === 0) { b.a += b.curve * dt; if (b.t > b.out) { b.phase = 1; b.hit = new Set(); } }
      else { let df = Math.atan2(P.y - b.y, P.x - b.x) - b.a; df = Math.atan2(Math.sin(df), Math.cos(df)); b.a += clamp(df, -26 * dt, 26 * dt); b.sp = Math.min(b.sp + 400 * dt, 520); }
      b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt;
      for (const e of enemies) if (e.hp > 0 && !b.hit.has(e) && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) { b.hit.add(e); hurt(e, dmg() * 3 * wl(up.boomerang) * (b.phase && up.boomerang >= 5 ? 1.5 : 1));
        if (b.phase === 0 && b.bounces > 0) {   // ricochet to the nearest monster it hasn't hit yet
          let nx = null, nd = 110 * 110; for (const o of enemies) { if (o.hp <= 0 || b.hit.has(o)) continue; const d = (o.x - b.x) ** 2 + (o.y - b.y) ** 2; if (d < nd) { nd = d; nx = o; } }
          if (nx) { b.bounces--; b.a = Math.atan2(nx.y - b.y, nx.x - b.x); b.curve = 0; b.out = Math.max(b.out, b.t + 0.2); }
        } }
      if ((b.phase === 1 && Math.hypot(P.x - b.x, P.y - b.y) < 18) || b.t > 4 || up.boomerang >= 7) booms.splice(i, 1);
    }
    if (up.boomerang >= 7) {   // max: boomerangs never come back; they bounce off the arena walls on their own
      const nR = 3 + up.dup;
      while (loopers.length < nR) { const a = rnd(0, Math.PI * 2); loopers.push({ x: P.x, y: P.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, spin: 0, r: 20 }); }
      for (const b of loopers) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 16;
        const wob = () => { let sx = 0, sy = 0, k = 0; for (const e of enemies) if (e.hp > 0 && inView(e)) { sx += e.x; sy += e.y; k++; } const a = (k ? Math.atan2(sy / k - b.y, sx / k - b.x) : Math.atan2(b.vy, b.vx)) + rnd(-0.4, 0.4), v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; };   // random turn on each wall bounce so the paths don't repeat
        if (b.x < -AX) { b.x = -AX; b.vx = Math.abs(b.vx); wob(); b.vx = Math.max(b.vx, 40); } if (b.x > AX) { b.x = AX; b.vx = -Math.abs(b.vx); wob(); b.vx = Math.min(b.vx, -40); }
        if (b.y < -AY) { b.y = -AY; b.vy = Math.abs(b.vy); wob(); b.vy = Math.max(b.vy, 40); } if (b.y > AY) { b.y = AY; b.vy = -Math.abs(b.vy); wob(); b.vy = Math.min(b.vy, -40); }
        for (const e of enemies) if (e.hp > 0 && (!e.bmCd || e.bmCd < t) && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 22) ** 2) { e.bmCd = t + 0.4; hurt(e, dmg() * 4.2 * wl(7)); }
      }
    }
    // laser: orbs circle you; each locks the direction of its target, shows a warning line, then fires a straight beam that does not turn
    if (up.laser > 0) {
      const L = up.laser; laserT -= dt; orbL += dt * (0.9 + 0.3 * rate());
      if (!laserOn) { if (laserT <= 0 && enemies.some(inLaser)) { laserOn = true; laserT = 0.15; startLaser(); } }
      else {
        for (const b of beams) {   // one instant zap along the full reach
          if (b.done) continue; b.done = true;
          const x0 = P.x + b.dx, y0 = P.y + b.dy, len = laserLen(x0, y0, b.a), ex = x0 + Math.cos(b.a) * len, ey = y0 + Math.sin(b.a) * len;
          for (const e of enemies) if (e.hp > 0 && onScreen(e) && distSeg(e.x, e.y, x0, y0, ex, ey) < 7 + e.r * 0.75) { hurt(e, dmg() * 5 * wl(L) * (L >= 5 && e.burn > t ? 1.4 : 1)); if (L >= 3) { e.burn = t + 1.5; e.burnD = dmg() * 0.25 * wl(L); } }
        }
        if (laserT <= 0) { laserOn = false; beams.length = 0; laserT = (L >= 7 ? 0.4 : L >= 6 ? 0.7 : 1.0) * (1 - 0.15 * up.multi); }
      }
    }
    for (const s of shots) {
      if (s.kind === 'magic') {
        if (s.target && s.target.hp <= 0) {   // target already dead: fly on, or seek one new monster (Archmage)
          s.target = null;
          if (s.reseek > 0) { s.reseek--; let b = null, bd = 1e9; for (const e of enemies) { if (e.hp <= 0 || !inView(e)) continue; const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2; if (d < bd) { bd = d; b = e; } } s.target = b; }
        }
        if (s.target) { const want = Math.atan2(s.target.y - s.y, s.target.x - s.x); let df = want - s.a; df = Math.atan2(Math.sin(df), Math.cos(df)); s.a += clamp(df, -s.turn * dt, s.turn * dt); }
        s.vx = Math.cos(s.a) * s.sp; s.vy = Math.sin(s.a) * s.sp;
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const e of enemies) {
        if (e.hp <= 0 || s.life <= 0) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + (s.kind === 'magic' ? 6 : 4)) ** 2) {
          if (s.kind === 'magic') {
            if (s.target && e !== s.target) continue; // seekers only hit their own target
            hurt(e, s.dmg); s.life = 0;
            if (!s.shard && up.magic >= 3) { const big = up.magic >= 6; for (const o of enemies) if (o !== e && o.hp > 0 && (o.x - s.x) ** 2 + (o.y - s.y) ** 2 < ((big ? 44 : 30) + o.r) ** 2) hurt(o, s.dmg * (big ? 0.5 : 0.35)); } // blast is a magic upgrade (L4, bigger at L6)
            if (up.magic >= 7 && !s.shard) shards(e, s.dmg * 0.6);
          } else if (!s.hit.includes(e)) { s.hit.push(e); hurt(e, s.dmg); if (--s.pierce <= 0) s.life = 0; }
        }
      }
    }
    // potions in flight, then puddles
    for (let i = flasks.length - 1; i >= 0; i--) {
      const f = flasks[i];
      if (t >= f.at) {
        puddles.push({ x: f.x, y: f.y, r: f.r, life: 3.5 * (f.L >= 6 ? 1.6 : 1), tick: 0, L: f.L, dmg: dmg() * 0.45 * wl(f.L) * (f.L >= 5 ? 1.4 : 1) });
        fx('splash', f.x, f.y - 6, f.r * 3.4); flasks.splice(i, 1);
      }
    }
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i]; p.life -= dt; p.tick -= dt;
      const doTick = p.tick <= 0; if (doTick) p.tick = 0.5;
      for (const e of enemies) if (e.hp > 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (p.r + e.r) ** 2) { e.slow = t + 0.3; e.slowK = p.L >= 6 ? 0.3 : 0.45; e.poison = t + 0.4; if (doTick) hurt(e, p.dmg); }
      if (p.life <= 0) puddles.splice(i, 1);
    }
    for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1); }
    // sword nova (Super saver)
    if (isMain('sword') && R >= 3) { novaCd -= dt; if (novaCd <= 0) { novaCd = 5; novas.push({ x: P.x, y: P.y, life: 0.4 }); for (const o of enemies) if (o.hp > 0 && (o.x - P.x) ** 2 + (o.y - P.y) ** 2 < (115 + o.r) ** 2) hurt(o, dmg() * 4.5 * wmul('sword')); } }
    for (let i = novas.length - 1; i >= 0; i--) { novas[i].life -= dt; if (novas[i].life <= 0) novas.splice(i, 1); }
    // sword: blades circling the hero (the whole blade hits). Faster fire rate = faster spin
    if (up.sword > 0) {
      orbAng += dt * (2.2 + 1.3 * rate()) * (up.sword >= 3 ? 1.25 : 1);
      const L = up.sword;
      for (const ring of rings()) {
        const half = ring.size * 0.46;
        for (let k = 0; k < ring.n; k++) {
          const a = orbAng * ring.dir + (k * Math.PI * 2) / ring.n, ux = Math.cos(a), uy = Math.sin(a);
          const cx = P.x + ux * ring.rad, cy = P.y + uy * ring.rad;
          for (const e of enemies) if (e.hp > 0 && (!e.swCd || e.swCd < t) && distSeg(e.x, e.y, cx - ux * half, cy - uy * half, cx + ux * half, cy + uy * half) < e.r + 3) { e.swCd = t + 0.4; hurt(e, dmg() * 2.4 * wmul('sword') * wl(L)); if (L >= 5 && ++swHits % 20 === 0) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.02); pop(P.x, P.y - 20, '+HP'); } }
        }
      }
    }
    // cleanup + gems + drops
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp <= 0) {
        kills++; enemies.splice(i, 1);
        if (e.poison > t && up.potion >= 5 && puddles.length < 40) puddles.push({ x: e.x, y: e.y, r: 24, life: 1.8, tick: 0, L: up.potion, dmg: dmg() * 0.45 * wl(up.potion) * 0.6 });
        const n = e.boss ? 14 : 1; for (let k = 0; k < n; k++) gems.push({ x: e.x + rnd(-14, 14), y: e.y + rnd(-14, 14), v: e.boss ? Math.ceil(e.xp / 7) : e.xp });
        dropFor(e);
        if (e.boss && e.type === 'dragon') return finish(true);
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i], dx = P.x - g.x, dy = P.y - g.y, l = Math.hypot(dx, dy) || 1;
      if (g.vac) { g.x += (dx / l) * 520 * dt; g.y += (dy / l) * 520 * dt; } else if (l < magnet()) { g.x += (dx / l) * 220 * dt; g.y += (dy / l) * 220 * dt; }
      if (l < 14) { gems.splice(i, 1); addXp(g.v); }
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; it.life -= dt;
      if (Math.hypot(P.x - it.x, P.y - it.y) < 24) { items.splice(i, 1); collect(it); } else if (it.life <= 0) items.splice(i, 1);
    }
    for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.life -= dt; if (f.follow) { f.x = P.x; f.y = P.y; } if (f.life <= 0) fxs.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    if (t >= D && !bossB) { bossB = true; spawn('dragon'); ui.banner('The Dragon awakens!'); }
    if (t >= D - 30 && !warned) { warned = true; ui.banner('30 seconds left to slay the Dragon!'); }
    if (t >= D) finish(false, true); // time is up and the Dragon still lives
  }
  function swordImg() {   // from level 5 the blades turn crimson (tinted copy made once)
    if (up.sword < 5) return SP.sword;
    if (!redSword) { const cv = document.createElement('canvas'); cv.width = SP.sword.width || 32; cv.height = SP.sword.height || 32; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(SP.sword, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(210,25,55,0.55)'; x.fillRect(0, 0, cv.width, cv.height); redSword = cv; }
    return redSword;
  }
  const rings = () => {
    const L = up.sword; if (L <= 0) return [];
    const n = Math.min(MAX_BLADES_PER_RING, 1 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0) + (L >= 6 ? 1 : 0) + (isMain('sword') && R >= 2 ? 1 : 0) + up.dup), size = 34 * (L >= 3 ? 1.25 : 1);
    const r = [{ rad: 42 + (L >= 3 ? 14 : 0), n, dir: 1, size }];
    if (L >= 7) r.push({ rad: 90, n: Math.min(MAX_BLADES_PER_RING, n - up.dup + 2), dir: -0.8, size });
    return r;
  };
  function pop(x, y, v) { if (pops.length < 60) pops.push({ x, y, v, life: 0.5 }); }
  function hurt(e, d, k) { e.hp -= d; e.hit = 0.1; pop(e.x, e.y - e.r, Math.round(d)); if (k && !(e.fxT > t)) { e.fxT = t + 0.22; fx(k, e.x, e.y, e.r * 2 + 34); } }
  function fx(k, x, y, size, o = {}) { if (SP && SP.fx && SP.fx.rows[k] && fxs.length < 60) fxs.push({ k, x, y, s: size, a: o.a || 0, dur: o.dur || SP.fx.rows[k].n / 22, life: o.dur || SP.fx.rows[k].n / 22, follow: !!o.follow }); }
  function finish(won, timeout) { if (over) return; over = true; ui.end({ won, timeout: !!timeout, seconds: Math.min(t, D), kills, level: P.level }); stop(); }

  /* ---------- drawing ---------- */
  function statusFx(e, sx, sy) {   // small status icons float above the monster's head (stun keeps its spinning stars)
    if (!SP || !SP.fx || !SP.status) return;
    ctx.imageSmoothingEnabled = false;
    const list = [];
    if (e.burn > t) list.push(0); if (e.poison > t) list.push(1); else if (e.slow > t && !(e.stun > t)) list.push(2); if (e.shock > t) list.push(3);
    const sz = 18, top = sy - e.r - sz - 4 + Math.sin(t * 6 + e.ph) * 2;
    list.forEach((k, i) => { const x = sx + (i - (list.length - 1) / 2) * (sz + 2) - sz / 2; ctx.globalAlpha = k === 0 ? 0.8 + 0.2 * Math.sin(t * 20 + e.ph) : 1; ctx.drawImage(SP.status, k * 16, 0, 16, 16, x, top, sz, sz); });
    ctx.globalAlpha = 1;
    if (e.stun > t) {
      const row = SP.fx.rows.stun, fw = row.w, fh = row.h, k0 = Math.floor(t * 14 + e.ph * 3) % row.n, dw = Math.max(34, e.r * 2.4), dh = dw * fh / fw;
      ctx.drawImage(SP.fx.img, k0 * fw, row.y, fw, fh, sx - dw * row.ax, sy - e.r * 0.9 - dh * row.ay, dw, dh);
    }
  }
  function monster(e, sx, sy) { monster0(e, sx, sy); statusFx(e, sx, sy); }
  function monster0(e, sx, sy) {
    const c = ctx, r = e.r, flash = e.hit > 0;
    c.save(); c.translate(sx, sy);
    const AN = SP && SP.anim && SP.anim[e.type === 'bat' ? 'eye' : e.type];
    if (e.mini) { c.shadowColor = '#ff4d3d'; c.shadowBlur = 14; }
    if (AN) {
      const k = (e.r * 2.7) / Math.max(AN.w, AN.h), n = AN.frames.length, fi = Math.floor(t * 10 + e.ph * 3) % n, bob = e.type === 'bat' ? Math.sin(e.ph) * 3 : 0;
      c.imageSmoothingEnabled = false; c.save(); if (e.vx < 0) c.scale(-1, 1);
      c.drawImage((flash ? AN.flash : AN.frames)[fi] || AN.frames[0], -AN.w * k / 2, -AN.h * k / 2 + bob, AN.w * k, AN.h * k); c.restore(); c.restore();
      hpBar(e, sx, sy); return;
    }
    if (SP && SP.mon[e.type]) {
      const sz = e.r * (e.type === 'bat' ? 3.4 : e.type === 'slime' ? 3.2 : 2.9), bob = Math.sin(e.ph) * 1.5;
      c.imageSmoothingEnabled = false; c.save(); if (e.vx > 0) c.scale(-1, 1); c.drawImage(flash ? SP.flash[e.type] : SP.mon[e.type], -sz / 2, -sz / 2 + bob, sz, sz); c.restore(); c.restore();
      hpBar(e, sx, sy); return;
    }
    c.fillStyle = flash ? '#fff' : '#8a8a8a'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore();
    hpBar(e, sx, sy);
  }
  function hpBar(e, sx, sy) { if (!e.boss) return; const c = ctx, w = e.r * 2.4; c.fillStyle = '#0008'; c.fillRect(sx - w / 2, sy - e.r * 1.8, w, 5); c.fillStyle = e.mini ? '#ff7a3d' : '#E24B3C'; c.fillRect(sx - w / 2, sy - e.r * 1.8, w * clamp(e.hp / e.maxHp), 5); }

  function bolt(c, b, ox, oy) {
    c.globalAlpha = clamp(b.life * 4); c.strokeStyle = '#d8ecff'; c.shadowColor = '#7fc4ff'; c.shadowBlur = 10; c.lineWidth = 2.5;
    const x = b.x + ox, y = b.y + oy; c.beginPath(); c.moveTo(x + Math.sin(b.seed) * 20, y - 260);
    for (let i = 1; i <= 7; i++) c.lineTo(x + Math.sin(b.seed * i) * 14 * (1 - i / 8), y - 260 + (260 * i) / 7);
    c.stroke();
    if (b.pts.length > 1) { c.beginPath(); b.pts.forEach((p, i) => (i ? c.lineTo(p[0] + ox, p[1] + oy) : c.moveTo(p[0] + ox, p[1] + oy))); c.stroke(); }
    c.fillStyle = '#bfe3ff'; c.beginPath(); c.arc(x, y, 14 * (1 - b.life * 2), 0, 7); c.fill();
    c.shadowBlur = 0; c.globalAlpha = 1;
  }

  function draw() {
    const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, W, H);
    const ox = W / 2 - P.x, oy = H / 2 - P.y, G = 64;
    c.fillStyle = '#1b1917'; c.fillRect(-AX + ox, -AY + oy, AX * 2, AY * 2);
    c.fillStyle = '#2a2623';
    for (let gx = Math.floor((P.x - W / 2) / G) * G; gx < P.x + W / 2 + G; gx += G) for (let gy = Math.floor((P.y - H / 2) / G) * G; gy < P.y + H / 2 + G; gy += G) { if (Math.abs(gx) > AX || Math.abs(gy) > AY) continue; c.beginPath(); c.arc(gx + ox, gy + oy, 2, 0, 7); c.fill(); }
    c.strokeStyle = '#B9684D'; c.lineWidth = 6; c.shadowColor = '#B9684D'; c.shadowBlur = 14; c.strokeRect(-AX + ox, -AY + oy, AX * 2, AY * 2); c.shadowBlur = 0;
    for (const p of puddles) { c.globalAlpha = clamp(p.life, 0, 1) * 0.45; c.fillStyle = '#6fd36f'; c.beginPath(); c.arc(p.x + ox, p.y + oy, p.r, 0, 7); c.fill(); c.globalAlpha = clamp(p.life, 0, 1) * 0.8; c.strokeStyle = '#b8f5a8'; c.lineWidth = 2; c.stroke(); for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * 1.5; c.beginPath(); c.arc(p.x + ox + Math.cos(a) * p.r * 0.5, p.y + oy + Math.sin(a * 1.3) * p.r * 0.5, 3, 0, 7); c.fillStyle = '#d6ffcf'; c.fill(); } c.globalAlpha = 1; }
    for (const g of gems) { c.fillStyle = '#6FC3FF'; c.beginPath(); c.moveTo(g.x + ox, g.y + oy - 5); c.lineTo(g.x + ox + 4, g.y + oy); c.lineTo(g.x + ox, g.y + oy + 5); c.lineTo(g.x + ox - 4, g.y + oy); c.fill(); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const it of items) {
      const bob = Math.sin(t * 5 + it.x) * 2, x = it.x + ox, y = it.y + oy + bob;
      if (it.life < 5 && Math.floor(t * 6) % 2) continue; // blink before it vanishes
      c.fillStyle = it.type === 'chest' ? '#e0a94f55' : '#ffffff22'; c.beginPath(); c.arc(x, y, it.type === 'chest' ? 17 : 13, 0, 7); c.fill();
      c.font = (it.type === 'chest' ? 24 : 17) + 'px system-ui'; c.fillText(GLYPH[it.type], x, y + 1);
    }
    for (const f of flasks) { const u = clamp(1 - (f.at - t) / f.dur), x = f.x0 + (f.x - f.x0) * u + ox, y = f.y0 + (f.y - f.y0) * u + oy - Math.sin(u * Math.PI) * 40; c.font = '14px system-ui'; c.fillText('🧪', x, y); }
    enemies.slice().sort((a, b) => a.y - b.y).forEach(e => monster(e, e.x + ox, e.y + oy));
    for (const s of shots) {
      const x = s.x + ox, y = s.y + oy;
      if (s.kind === 'magic') { c.fillStyle = '#B9A2FF'; c.shadowColor = '#9A86E0'; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
      else { c.save(); c.translate(x, y); c.rotate(s.a); c.fillStyle = s.crit ? '#FFC53D' : '#FFE08A'; if (s.crit) { c.shadowColor = '#FFC53D'; c.shadowBlur = 8; } c.fillRect(-9, -1.2, 14, 2.4); c.beginPath(); c.moveTo(5, -3.5); c.lineTo(10, 0); c.lineTo(5, 3.5); c.fill(); c.restore(); }
    }
    for (const nv of novas) { c.globalAlpha = clamp(nv.life * 2.5); c.strokeStyle = '#E8ECEF'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, H / 2, 115 * (1.1 - nv.life), 0, 7); c.stroke(); c.globalAlpha = 1; }
    for (const ring of rings()) {
      for (let k = 0; k < ring.n; k++) {
        const a = orbAng * ring.dir + (k * Math.PI * 2) / ring.n; c.save(); c.translate(W / 2 + Math.cos(a) * ring.rad, H / 2 + Math.sin(a) * ring.rad); c.rotate(a + Math.PI / 2);
        if (SP) { c.imageSmoothingEnabled = false; c.rotate(Math.PI / 4); if (up.sword >= 7) { c.shadowColor = '#9fd4ff'; c.shadowBlur = 10; } const z = ring.size; c.drawImage(swordImg(), -z / 2, -z / 2, z, z); c.restore(); continue; }
        c.fillStyle = '#E8ECEF'; c.beginPath(); c.moveTo(0, -16); c.lineTo(4, 4); c.lineTo(-4, 4); c.fill(); c.restore();
      }
    }
    // axe, boomerang, laser
    for (const sc of scars) {   // the ground cracks along the wave's path and the crack fades
      c.lineCap = 'round'; c.lineJoin = 'round'; const a = clamp(sc.life / 1.3);
      for (const [col, wd, al] of [['#2a1c12', 5, 0.75], ['#8a5a30', 2, 0.5]]) { c.globalAlpha = a * al; c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); sc.pts.forEach((q, k) => k ? c.lineTo(q[0] + ox, q[1] + oy) : c.moveTo(q[0] + ox, q[1] + oy)); c.stroke(); }
      c.globalAlpha = 1;
    }
    for (const w of waves) {   // the shockwave is a crescent slash flying forward, with fading copies behind it
      const ux = Math.cos(w.a), uy = Math.sin(w.a), row = SP && SP.fx && SP.fx.rows.wave; if (!row) continue;
      const fade = w.full ? 1 : 1 - 0.65 * clamp(w.s / w.max), sz = w.w * 2.8;
      c.imageSmoothingEnabled = false;
      for (let k = 2; k >= 0; k--) {
        const s0 = w.s - k * 22; if (s0 < 0) continue;
        c.save(); c.translate(w.x0 + ux * s0 + ox, w.y0 + uy * s0 + oy); c.rotate(w.a); c.globalAlpha = fade * (k === 0 ? 1 : k === 1 ? 0.45 : 0.2);
        c.drawImage(SP.fx.img, 3 * 64, row.y, 64, 64, -sz * 0.35, -sz / 2, sz, sz); c.restore();
      }
    }
    for (const sw of swings) {   // the axe sprite sweeps through the arc, leaving a fading crescent trail
      const u = clamp(1 - sw.life / sw.dur), e = 1 - (1 - u) * (1 - u), ang = sw.a - sw.half + 2 * sw.half * e, cx = P.x + ox, cy = P.y + oy, rr = sw.reach * 0.62;
      c.globalAlpha = clamp(sw.life * 10);
      if (SP && SP.icons) { c.save(); c.translate(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); c.rotate(ang + Math.PI * 0.75); c.imageSmoothingEnabled = false; c.drawImage(SP.icons, 5 * 32, 0, 32, 32, -22, -22, 44, 44); c.restore(); }
      c.globalAlpha = 1;
    }
    for (const b of booms.concat(loopers)) { if (SP && SP.icons) { c.save(); c.translate(b.x + ox, b.y + oy); c.rotate(b.spin); c.imageSmoothingEnabled = false; if (up.boomerang >= 7) { c.shadowColor = '#ffd36b'; c.shadowBlur = 10; } const z = (b.r || 14) * 3.2; c.drawImage(SP.icons, 6 * 32, 0, 32, 32, -z / 2, -z / 2, z, z); c.restore(); continue; } c.save(); c.translate(b.x + ox, b.y + oy); c.rotate(b.spin); c.strokeStyle = '#d49a5a'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; if (up.boomerang >= 7) { c.shadowColor = '#ffd36b'; c.shadowBlur = 10; } c.beginPath(); c.moveTo(-10, -6); c.lineTo(0, 4); c.lineTo(10, -6); c.stroke(); c.restore(); }
    if (up.laser > 0) {
      for (let i = 0; i < laserOrbs(); i++) { const [x0, y0] = orbPos(i); c.fillStyle = '#ff7a5a'; c.shadowColor = '#ff5a3d'; c.shadowBlur = 12; c.beginPath(); c.arc(x0 + ox, y0 + oy, 6, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.arc(x0 + ox, y0 + oy, 2.5, 0, 7); c.fill(); }
      if (laserOn) for (const b of beams) {
        const x0 = P.x + b.dx, y0 = P.y + b.dy, len = laserLen(x0, y0, b.a), sx = x0 + ox, sy = y0 + oy, ex = sx + Math.cos(b.a) * len, ey = sy + Math.sin(b.a) * len;
        c.lineCap = 'round';
                c.shadowColor = '#ff5a3d'; c.shadowBlur = 14; c.strokeStyle = '#ff5a3d'; c.globalAlpha = 0.85 * clamp(laserT / 0.15); c.lineWidth = 12; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
        c.shadowBlur = 0; c.globalAlpha = clamp(laserT / 0.15); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      }
    }
    if (SP && SP.fx) for (const f of fxs) {
      const row = SP.fx.rows[f.k], k = Math.min(row.n - 1, Math.floor((1 - f.life / f.dur) * row.n));
      c.save(); c.translate(f.x + ox, f.y + oy); if (f.a) c.rotate(f.a); c.imageSmoothingEnabled = false; const fw = row.w || 64, fh = row.h || 64, dh = f.s * fh / fw; c.drawImage(SP.fx.img, k * fw, row.y, fw, fh, -f.s * (row.ax ?? 0.5), -dh * (row.ay ?? 0.5), f.s, dh); c.restore();
    }
    // hero
    c.save(); c.translate(W / 2, H / 2); if (P.inv > 0 && Math.floor(t * 20) % 2) c.globalAlpha = 0.45;
    // facing marker (arrows fly this way)
    if (up.arrow > 0) { c.save(); c.rotate(P.dir); c.fillStyle = '#ffffff44'; c.beginPath(); c.moveTo(34, 0); c.lineTo(26, -5); c.lineTo(26, 5); c.fill(); c.restore(); }
    if (SP && SP.anim) {
      const moving = !!(joy || keys['a'] || keys['d'] || keys['w'] || keys['s']);
      const AN = (!moving && SP.anim[profile.job + '_idle']) || SP.anim[profile.job];
      const k = 1.0 + (profile.rank - 1) * 0.08, fi = Math.floor(t * (moving ? 12 : 8)) % AN.frames.length;
      const flip = P.face < 0;
      const aura = ['#B9684D', '#cfd4d8', '#e0a94f'][profile.rank - 1];
      // no coloured ground shadow: it would show as a brown blob on the dark floor
      c.imageSmoothingEnabled = false; c.save(); if (flip) c.scale(-1, 1);
      if (profile.rank >= 3) { c.shadowColor = aura; c.shadowBlur = 10; }
      c.drawImage(AN.frames[fi] || AN.frames[0], -AN.w * k / 2, -AN.h * k / 2, AN.w * k, AN.h * k); c.restore();
    } else {
      c.fillStyle = profile.color; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill();
    }
    if (buffs.inv > 0) { c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 8); c.strokeStyle = '#ffd36b'; c.lineWidth = 3; c.shadowColor = '#ffd36b'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.stroke(); c.shadowBlur = 0; }
    c.restore(); c.globalAlpha = 1;
    for (const b of bolts) bolt(c, b, ox, oy);
    c.font = '700 11px system-ui';
    for (const p of pops) { c.globalAlpha = clamp(p.life * 2); c.fillStyle = '#fff'; c.fillText(p.v, p.x + ox, p.y + oy - (0.5 - p.life) * 30); c.globalAlpha = 1; }
    if (joy) { c.strokeStyle = '#ffffff55'; c.lineWidth = 2; c.beginPath(); c.arc(joy.ox, joy.oy, 40, 0, 7); c.stroke(); const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.min(40, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); c.fillStyle = '#ffffff55'; c.beginPath(); c.arc(joy.ox + Math.cos(a) * l, joy.oy + Math.sin(a) * l, 16, 0, 7); c.fill(); }
  }

  /* ---------- loop ---------- */
  let hudT = 0;
  function frame(now) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && !over) update(dt);
    draw();
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; ui.hud({ hp: P.hp, maxHp: P.maxHp, xp: P.xp, need: P.need, level: P.level, t, D, kills, weapons: owned().map(k => ({ id: k, name: WNAMES[k], level: up[k] })), slots: SLOTS, buffs: { inv: buffs.inv, speed: buffs.speed } }); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    stopped = true; cancelAnimationFrame(raf); ro.disconnect();
    canvas.removeEventListener('contextmenu', noSel); canvas.removeEventListener('selectstart', noSel); canvas.removeEventListener('dragstart', noSel); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', vis);
  }
  return {
    stop, pause: v => { paused = v; last = performance.now(); }, isPaused: () => paused,
    debug: { loopers, laser: () => ({ on: laserOn, beams: beams.length }), P, enemies, items, gems, buffs, up, kill: () => { t = D * 0.95; }, setT: v => { t = v; }, lvl: (k, L) => { up[k] = L; }, drop: type => items.push({ x: P.x + 30, y: P.y, type, life: 25 }), swarm, mini: () => spawn('ogre', { mini: true, hp: 40, sp: 0.9 }) },
  };
}
