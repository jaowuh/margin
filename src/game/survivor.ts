// @ts-nocheck
/* Tiny Vampire-Survivors-style game. One thumb moves the hero; attacks are automatic.
   Stats come from the player's real budget (see profile.ts). */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const WEAPONS = { arrow: 'Arrows', magic: 'Magic', sword: 'Sword' };
const WDESC = { arrow: 'More arrows per shot, and they pierce', magic: 'Bigger, stronger explosions', sword: 'More blades, wider circle' };
const UPGRADES = [
  { id: 'arrow', max: 6 }, { id: 'magic', max: 6 }, { id: 'sword', max: 6 },
  { id: 'dmg', name: 'Sharper edge', desc: '+25% damage to everything', max: 8 },
  { id: 'rate', name: 'Quick hands', desc: '+20% fire rate', max: 8 },
  { id: 'speed', name: 'Swift boots', desc: '+10% move speed', max: 5 },
  { id: 'hp', name: 'Vitality', desc: '+30 max health and heal 30', max: 6 },
  { id: 'magnet', name: 'Magnet', desc: '+40% gem pickup range', max: 4 },
  { id: 'heal', name: 'Snack', desc: 'Heal 40% of your health', max: 99 },
];
const PRIMARY = { archer: 'arrow', mage: 'magic', swordsman: 'sword' };

export function startGame(canvas, profile, opts, ui) {
  const D = opts.duration;                     // seconds for a full run
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, raf = 0, stopped = false, paused = false, last = performance.now();
  const resize = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);

  const P = { x: 0, y: 0, hp: profile.maxHp, maxHp: profile.maxHp, inv: 0, face: 1, level: 1, xp: 0, need: 8 };
  const main = PRIMARY[profile.job] || 'arrow';
  const up = { arrow: 0, magic: 0, sword: 0, dmg: 0, rate: 0, speed: 0, hp: 0, magnet: 0, heal: 0 };
  up[main] = profile.rank; // your job's weapon starts at your saver level
  const wmul = k => (k === main ? [1.3, 1.5, 1.8][profile.rank - 1] : 1);
  const R = profile.rank, isMain = k => k === main;
  const after = [], novas = [];
  let novaCd = 5;
  const booms = [];
  let t = 0, kills = 0, arrowCd = 0, magicCd = 0, orbAng = 0, spawnCd = 0, bossA = false, bossB = false, over = false;
  const enemies = [], shots = [], gems = [], pops = [];
  const keys = {};
  let joy = null; // {id, ox, oy, x, y}

  /* ---------- input ---------- */
  const down = e => { if (joy) return; canvas.setPointerCapture?.(e.pointerId); const r = canvas.getBoundingClientRect(); joy = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top }; e.preventDefault(); };
  const move = e => { if (!joy || e.pointerId !== joy.id) return; const r = canvas.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; };
  const end = e => { if (joy && e.pointerId === joy.id) joy = null; };
  const kd = e => { keys[e.key.toLowerCase()] = true; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault(); };
  const ku = e => { keys[e.key.toLowerCase()] = false; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const vis = () => { if (document.hidden) paused = true; };
  document.addEventListener('visibilitychange', vis);

  /* ---------- stats ---------- */
  const dmg = () => 10 * profile.damage * (1 + 0.25 * up.dmg);
  const rate = () => 1.1 * (1 + 0.2 * up.rate);
  const spd = () => 125 * profile.speed * (1 + 0.1 * up.speed);
  const magnet = () => 70 * (1 + 0.4 * up.magnet);
  const progress = () => clamp(t / D);

  /* ---------- spawning ---------- */
  const TYPES = {
    slime: { r: 11, hp: 14, sp: 38, dmg: 8, xp: 1 },
    bat: { r: 9, hp: 9, sp: 78, dmg: 6, xp: 1 },
    goblin: { r: 12, hp: 32, sp: 55, dmg: 11, xp: 2 },
    ogre: { r: 22, hp: 130, sp: 40, dmg: 20, xp: 6 },
    king: { r: 40, hp: 1500, sp: 42, dmg: 30, xp: 40, boss: true },
    dragon: { r: 52, hp: 3800, sp: 52, dmg: 38, xp: 80, boss: true },
  };
  function spawn(type, scale = 1) {
    const T = TYPES[type], a = rnd(0, Math.PI * 2), d = Math.max(W, H) / 2 + 50;
    const hpScale = (1 + progress() * 2.2) * scale;
    enemies.push({ type, x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, r: T.r, hp: T.hp * hpScale, maxHp: T.hp * hpScale, sp: T.sp * (1 + progress() * 0.35), dmg: T.dmg, xp: T.xp, boss: !!T.boss, hit: 0, ph: Math.random() * 6 });
  }
  function spawnWave(dt) {
    spawnCd -= dt;
    if (spawnCd > 0 || enemies.length > 170) return;
    const p = progress();
    spawnCd = Math.max(0.28, 1.1 - p * 0.85);
    const n = 1 + Math.floor(p * 4);
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      let type = 'slime';
      if (p > 0.08 && roll < 0.35) type = 'bat';
      if (p > 0.2 && roll < 0.22) type = 'goblin';
      if (p > 0.4 && roll < 0.08) type = 'ogre';
      spawn(type);
    }
    if (!bossA && p >= 0.5) { bossA = true; spawn('king'); ui.banner('The Ogre King approaches!'); }
    if (!bossB && p >= 0.9) { bossB = true; spawn('dragon'); ui.banner('The Dragon awakens!'); }
  }

  /* ---------- level up ---------- */
  function addXp(v) {
    P.xp += v;
    while (P.xp >= P.need) {
      P.xp -= P.need; P.level++; P.need = Math.round(8 + P.level * 5);
      const pool = UPGRADES.filter(u => up[u.id] < u.max).sort(() => Math.random() - 0.5).slice(0, 3);
      paused = true;
      ui.levelUp(pool.map(u => WEAPONS[u.id] ? ({ id: u.id, name: up[u.id] ? WEAPONS[u.id] : 'New: ' + WEAPONS[u.id], desc: WDESC[u.id], have: up[u.id], weapon: true }) : ({ ...u, have: up[u.id] })), id => {
        up[id]++;
        if (id === 'hp') { P.maxHp += 30; P.hp = Math.min(P.maxHp, P.hp + 30); }
        if (id === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4);
        paused = false; last = performance.now();
      });
      break;
    }
  }

  /* ---------- update ---------- */
  function update(dt) {
    t += dt;
    // move
    let mx = 0, my = 0;
    if (keys['arrowleft'] || keys['a']) mx -= 1; if (keys['arrowright'] || keys['d']) mx += 1;
    if (keys['arrowup'] || keys['w']) my -= 1; if (keys['arrowdown'] || keys['s']) my += 1;
    if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy); if (l > 6) { mx = dx / Math.max(l, 40); my = dy / Math.max(l, 40); } }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    P.x += mx * spd() * dt; P.y += my * spd() * dt; if (mx) P.face = mx > 0 ? 1 : -1;
    P.inv = Math.max(0, P.inv - dt);
    spawnWave(dt);

    // enemies
    for (const e of enemies) {
      const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1;
      e.x += (dx / l) * e.sp * dt; e.y += (dy / l) * e.sp * dt; e.hit = Math.max(0, e.hit - dt); e.ph += dt * 6;
      if (l < e.r + 10 && P.inv <= 0) { P.hp -= e.dmg; P.inv = 0.6; ui.shake(); if (P.hp <= 0) return finish(false); }
    }
    // soft separation so monsters don't stack into one dot
    for (let i = 0; i < enemies.length; i += 2) {
      const a = enemies[i], b = enemies[(i * 7 + 3) % enemies.length]; if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1, m = a.r + b.r;
      if (l < m) { const k = (m - l) / 2; a.x += (dx / l) * k * 0.5; a.y += (dy / l) * k * 0.5; b.x -= (dx / l) * k * 0.5; b.y -= (dy / l) * k * 0.5; }
    }

    // nearest monster
    let best = null, bd = 1e9;
    for (const e of enemies) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; if (d < bd) { bd = d; best = e; } }
    const inRange = best && bd < (Math.max(W, H) * 0.7) ** 2;
    const ang = inRange ? Math.atan2(best.y - P.y, best.x - P.x) : 0;
    // arrows: fast, fan out, pierce
    arrowCd -= dt;
    if (up.arrow > 0 && arrowCd <= 0) {
      if (inRange) {
        arrowCd = 0.85 / rate() / (isMain('arrow') && R >= 2 ? 1.15 : 1);
        const L = up.arrow, n = 1 + Math.floor((L - 1) / 2) + (L >= 6 ? 1 : 0);
        for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.14; shots.push({ kind: 'arrow', x: P.x, y: P.y, a, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.2, dmg: dmg() * wmul('arrow') * (1 + 0.12 * (L - 1)) * (isMain('arrow') && R >= 3 && Math.random() < 0.25 ? 2 : 1), crit: isMain('arrow') && R >= 3, pierce: 1 + Math.floor(L / 2) + (isMain('arrow') && R >= 2 ? 1 : 0), hit: [] }); }
      } else arrowCd = 0.15;
    }
    // magic: slow orb that explodes
    magicCd -= dt;
    if (up.magic > 0 && magicCd <= 0) {
      if (inRange) {
        magicCd = 1.7 / rate();
        const L = up.magic, n = L >= 4 ? 2 : 1;
        for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.35; shots.push({ kind: 'magic', x: P.x, y: P.y, a, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 1.6, dmg: dmg() * 2.3 * wmul('magic') * (1 + 0.18 * (L - 1)), rad: (46 + 7 * L) * (isMain('magic') && R >= 2 ? 1.25 : 1) }); }
      } else magicCd = 0.15;
    }
    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const e of enemies) {
        if (e.hp <= 0 || s.life <= 0) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + (s.kind === 'magic' ? 7 : 4)) ** 2) {
          if (s.kind === 'magic') {
            s.life = 0; booms.push({ x: s.x, y: s.y, r: s.rad, life: 0.3 }); if (isMain('magic') && R >= 3) after.push({ x: s.x, y: s.y, rad: s.rad, dmg: s.dmg * 0.6, at: t + 0.45 });
            for (const o of enemies) if (o.hp > 0 && (o.x - s.x) ** 2 + (o.y - s.y) ** 2 < (s.rad + o.r) ** 2) hurt(o, s.dmg);
          } else if (!s.hit.includes(e)) { s.hit.push(e); hurt(e, s.dmg); if (--s.pierce <= 0) s.life = 0; }
        }
      }
    }
    for (let i = after.length - 1; i >= 0; i--) { const f = after[i]; if (t >= f.at) { booms.push({ x: f.x, y: f.y, r: f.rad, life: 0.3 }); for (const o of enemies) if (o.hp > 0 && (o.x - f.x) ** 2 + (o.y - f.y) ** 2 < (f.rad + o.r) ** 2) hurt(o, f.dmg); after.splice(i, 1); } }
    for (let i = booms.length - 1; i >= 0; i--) { booms[i].life -= dt; if (booms[i].life <= 0) booms.splice(i, 1); }
    // sword nova (Super saver)
    if (isMain('sword') && R >= 3) { novaCd -= dt; if (novaCd <= 0) { novaCd = 5; novas.push({ x: P.x, y: P.y, life: 0.4 }); for (const o of enemies) if (o.hp > 0 && (o.x - P.x) ** 2 + (o.y - P.y) ** 2 < (115 + o.r) ** 2) hurt(o, dmg() * 3 * wmul('sword')); } }
    for (let i = novas.length - 1; i >= 0; i--) { novas[i].life -= dt; if (novas[i].life <= 0) novas.splice(i, 1); }
    // sword: blades circling the hero
    if (up.sword > 0) {
      orbAng += dt * (3 + up.sword * 0.15);
      const L = up.sword, n = 1 + Math.floor(L / 2) + (isMain('sword') && R >= 2 ? 1 : 0), rad = 42 + 3 * L;
      for (let k = 0; k < n; k++) {
        const a = orbAng + (k * Math.PI * 2) / n, ox = P.x + Math.cos(a) * rad, oy = P.y + Math.sin(a) * rad;
        for (const e of enemies) if (e.hp > 0 && (e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + 12 + L) ** 2 && (!e.swCd || e.swCd < t)) { e.swCd = t + 0.4; hurt(e, dmg() * 1.5 * wmul('sword') * (1 + 0.15 * (L - 1))); }
      }
    }
    // cleanup + gems
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp <= 0) {
        kills++; enemies.splice(i, 1);
        const n = e.boss ? 14 : 1; for (let k = 0; k < n; k++) gems.push({ x: e.x + rnd(-14, 14), y: e.y + rnd(-14, 14), v: e.boss ? Math.ceil(e.xp / 7) : e.xp });
        if (e.boss && e.type === 'dragon') return finish(true);
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i], dx = P.x - g.x, dy = P.y - g.y, l = Math.hypot(dx, dy) || 1;
      if (l < magnet()) { g.x += (dx / l) * 220 * dt; g.y += (dy / l) * 220 * dt; }
      if (l < 14) { gems.splice(i, 1); addXp(g.v); }
    }
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    if (t >= D && !bossB) { bossB = true; spawn('dragon'); ui.banner('The Dragon awakens!'); }
    if (t >= D + 45) finish(true); // you outlasted it
  }
  function hurt(e, d) { e.hp -= d; e.hit = 0.1; pops.push({ x: e.x, y: e.y - e.r, v: Math.round(d), life: 0.5 }); }
  function finish(won) { if (over) return; over = true; ui.end({ won, seconds: Math.min(t, D), kills, level: P.level }); stop(); }

  /* ---------- drawing ---------- */
  function monster(e, sx, sy) {
    const c = ctx, r = e.r, flash = e.hit > 0;
    c.save(); c.translate(sx, sy);
    const wob = Math.sin(e.ph) * 0.08;
    if (e.type === 'slime') {
      c.fillStyle = flash ? '#fff' : '#6FCF6F'; c.beginPath(); c.ellipse(0, r * 0.15, r * (1 + wob), r * (0.8 - wob), 0, Math.PI, 0); c.lineTo(r, r * 0.15); c.ellipse(0, r * 0.15, r * (1 + wob), r * 0.35, 0, 0, Math.PI); c.fill();
      eyes(c, r * 0.35, -r * 0.1, 2.2);
    } else if (e.type === 'bat') {
      const f = Math.sin(e.ph * 2) * 0.6; c.fillStyle = flash ? '#fff' : '#8B6FD0';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-r * 1.9, -r * (0.9 + f), -r * 1.5, r * 0.5); c.quadraticCurveTo(-r * 0.6, r * 0.1, 0, r * 0.4); c.quadraticCurveTo(r * 0.6, r * 0.1, r * 1.5, r * 0.5); c.quadraticCurveTo(r * 1.9, -r * (0.9 + f), 0, 0); c.fill();
      c.beginPath(); c.arc(0, 0, r * 0.55, 0, 7); c.fill(); eyes(c, r * 0.25, -r * 0.05, 1.8, '#F66');
    } else if (e.type === 'goblin') {
      c.fillStyle = flash ? '#fff' : '#7FA83A'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-r * 0.8, -r * 0.2); c.lineTo(-r * 1.6, -r * 0.7); c.lineTo(-r * 0.6, -r * 0.7); c.fill(); c.beginPath(); c.moveTo(r * 0.8, -r * 0.2); c.lineTo(r * 1.6, -r * 0.7); c.lineTo(r * 0.6, -r * 0.7); c.fill();
      eyes(c, r * 0.38, -r * 0.1, 2.4, '#FF0'); c.fillStyle = '#233'; c.fillRect(-r * 0.3, r * 0.3, r * 0.6, 2);
    } else if (e.type === 'ogre') {
      c.fillStyle = flash ? '#fff' : '#C9743E'; rr(c, -r, -r, r * 2, r * 2, 7); c.fill(); c.fillStyle = flash ? '#fff' : '#9C5427'; c.fillRect(-r, -r * 0.2, r * 2, r * 0.25);
      eyes(c, r * 0.4, -r * 0.4, 3, '#FFF'); c.fillStyle = '#FFF'; c.fillRect(-r * 0.45, r * 0.35, 4, 6); c.fillRect(r * 0.3, r * 0.35, 4, 6);
    } else if (e.type === 'king') {
      c.fillStyle = flash ? '#fff' : '#A8453A'; rr(c, -r, -r * 0.9, r * 2, r * 1.9, 12); c.fill();
      c.fillStyle = '#E0B04A'; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.9); c.lineTo(-r * 0.7, -r * 1.5); c.lineTo(-r * 0.35, -r * 1.1); c.lineTo(0, -r * 1.6); c.lineTo(r * 0.35, -r * 1.1); c.lineTo(r * 0.7, -r * 1.5); c.lineTo(r * 0.7, -r * 0.9); c.fill();
      eyes(c, r * 0.4, -r * 0.2, 5, '#FF0');
    } else {
      c.fillStyle = flash ? '#fff' : '#7A2E8C'; c.beginPath(); c.ellipse(0, 0, r, r * 0.85, 0, 0, 7); c.fill();
      const f = Math.sin(e.ph) * 0.35; c.fillStyle = flash ? '#fff' : '#5A1F6B';
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.lineTo(-r * 2, -r * (1 + f)); c.lineTo(-r * 1.3, r * 0.4); c.fill(); c.beginPath(); c.moveTo(r * 0.6, -r * 0.2); c.lineTo(r * 2, -r * (1 + f)); c.lineTo(r * 1.3, r * 0.4); c.fill();
      c.beginPath(); c.moveTo(-r * 0.5, -r * 0.7); c.lineTo(-r * 0.7, -r * 1.3); c.lineTo(-r * 0.2, -r * 0.8); c.fill(); c.beginPath(); c.moveTo(r * 0.5, -r * 0.7); c.lineTo(r * 0.7, -r * 1.3); c.lineTo(r * 0.2, -r * 0.8); c.fill();
      eyes(c, r * 0.35, -r * 0.15, 5, '#FFD34D');
    }
    c.restore();
    if (e.boss) { const w = r * 2.4; c.fillStyle = '#0008'; c.fillRect(sx - w / 2, sy - r * 1.8, w, 5); c.fillStyle = '#E24B3C'; c.fillRect(sx - w / 2, sy - r * 1.8, w * clamp(e.hp / e.maxHp), 5); }
  }
  function eyes(c, dx, y, s, col = '#FFF') { c.fillStyle = col; c.beginPath(); c.arc(-dx, y, s, 0, 7); c.arc(dx, y, s, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(-dx, y, s * 0.45, 0, 7); c.arc(dx, y, s * 0.45, 0, 7); c.fill(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function draw() {
    const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#1b1917'; c.fillRect(0, 0, W, H);
    const ox = W / 2 - P.x, oy = H / 2 - P.y, G = 64;
    c.fillStyle = '#2a2623';
    for (let gx = Math.floor((P.x - W / 2) / G) * G; gx < P.x + W / 2 + G; gx += G) for (let gy = Math.floor((P.y - H / 2) / G) * G; gy < P.y + H / 2 + G; gy += G) { c.beginPath(); c.arc(gx + ox, gy + oy, 2, 0, 7); c.fill(); }
    for (const g of gems) { c.fillStyle = '#6FC3FF'; c.beginPath(); c.moveTo(g.x + ox, g.y + oy - 5); c.lineTo(g.x + ox + 4, g.y + oy); c.lineTo(g.x + ox, g.y + oy + 5); c.lineTo(g.x + ox - 4, g.y + oy); c.fill(); }
    enemies.slice().sort((a, b) => a.y - b.y).forEach(e => monster(e, e.x + ox, e.y + oy));
    for (const s of shots) {
      const x = s.x + ox, y = s.y + oy;
      if (s.kind === 'magic') { c.fillStyle = '#B9A2FF'; c.shadowColor = '#9A86E0'; c.shadowBlur = 12; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.shadowBlur = 0; }
      else { c.save(); c.translate(x, y); c.rotate(s.a); c.fillStyle = s.crit ? '#FFC53D' : '#FFE08A'; if (s.crit) { c.shadowColor = '#FFC53D'; c.shadowBlur = 8; } c.fillRect(-9, -1.2, 14, 2.4); c.beginPath(); c.moveTo(5, -3.5); c.lineTo(10, 0); c.lineTo(5, 3.5); c.fill(); c.restore(); }
    }
    for (const nv of novas) { c.globalAlpha = clamp(nv.life * 2.5); c.strokeStyle = '#E8ECEF'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, H / 2, 115 * (1.1 - nv.life), 0, 7); c.stroke(); c.globalAlpha = 1; }
    for (const b of booms) { c.globalAlpha = clamp(b.life * 3) * 0.7; c.fillStyle = '#B9A2FF'; c.beginPath(); c.arc(b.x + ox, b.y + oy, b.r * (1.15 - b.life), 0, 7); c.fill(); c.globalAlpha = 1; }
    if (up.sword > 0) {
      const n = 1 + Math.floor(up.sword / 2) + (isMain('sword') && R >= 2 ? 1 : 0), rad = 42 + 3 * up.sword;
      for (let k = 0; k < n; k++) {
        const a = orbAng + (k * Math.PI * 2) / n; c.save(); c.translate(W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad); c.rotate(a + Math.PI / 2);
        c.fillStyle = '#E8ECEF'; c.shadowColor = '#fff'; c.shadowBlur = 8; c.beginPath(); c.moveTo(0, -16); c.lineTo(4, 4); c.lineTo(-4, 4); c.fill(); c.shadowBlur = 0; c.fillStyle = '#B9684D'; c.fillRect(-6, 4, 12, 3); c.fillRect(-1.5, 7, 3, 6); c.restore();
      }
    }
    // hero
    c.save(); c.translate(W / 2, H / 2); if (P.inv > 0 && Math.floor(t * 20) % 2) c.globalAlpha = 0.45;
    c.fillStyle = profile.color; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill();
    c.fillStyle = '#171717'; c.beginPath(); c.arc(P.face * 4, -2, 2.4, 0, 7); c.arc(P.face * 4 + (P.face > 0 ? -7 : 7), -2, 2.4, 0, 7); c.fill();
    c.fillStyle = '#B9684D'; c.beginPath(); c.arc(0, -10, 6, Math.PI, 0); c.fill();
    c.restore();
    for (const p of pops) { c.globalAlpha = clamp(p.life * 2); c.fillStyle = '#fff'; c.font = '700 11px system-ui'; c.textAlign = 'center'; c.fillText(p.v, p.x + ox, p.y + oy - (0.5 - p.life) * 30); c.globalAlpha = 1; }
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
    if (hudT <= 0) { hudT = 0.1; ui.hud({ hp: P.hp, maxHp: P.maxHp, xp: P.xp, need: P.need, level: P.level, t, D, kills }); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    stopped = true; cancelAnimationFrame(raf); ro.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', vis);
  }
  return { stop, pause: v => { paused = v; last = performance.now(); }, isPaused: () => paused, debug: { P, enemies, kill: () => { t = D * 0.95; } } };
}
