import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Swords, X } from 'lucide-react';
import type { Job } from '../game/profile';
import { JOB_IDS, JOBS } from '../game/profile';
import { useActive, useStore } from '../lib/store';
import { TIERS, chestFor, loadSave, profileFor, RELICS, RELIC_FX, RELIC_SLOTS, relicFx, writeSave } from '../game/profile';
import type { GameSave, Tier } from '../game/profile';
import { startGame } from '../game/survivor';
import { loadSprites } from '../game/sprites';
import weaponIcons from '../assets/weapon-icons.png';
import itemIcons from '../assets/item-icons.png';
const WICON = ['arrow', 'magic', 'sword', 'potion', 'lightning', 'axe', 'boomerang', 'laser'];
const IICON = ['dup', 'multi', 'ricochet', 'pierce', 'chill', 'ignite', 'enlarge', 'crit'];
const WIcon = ({ id, size = 22 }: { id: string; size?: number }) => {
  const w = WICON.indexOf(id), it = IICON.indexOf(id), n = w >= 0 ? w : it;
  return n < 0 ? null : <i className="mg-wico" style={{ width: size, height: size, backgroundImage: `url(${w >= 0 ? weaponIcons : itemIcons})`, backgroundSize: `${size * 8}px ${size}px`, backgroundPositionX: -n * size }} />;
};
import type { Sprites } from '../game/sprites';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const duration = () => { try { const v = Number(localStorage.getItem('margin:game-test')); if (v > 0) return v; } catch { /* ignore */ } return 600; };

/** Small Overview shortcut to the Play tab. */
export function GameCard({ month, go }: { month: string; go: () => void }) {
  const { data } = useStore();
  const { ws } = useActive();
  const save = loadSave();
  const profile = profileFor(data, ws.id, month, save.job);
  return (
    <section className="card game-card" aria-label="Monster hunt">
      <div className="card-head">
        <div><h2>Monster hunt</h2><p>Your {profile.title.toLowerCase()} is ready. A quick 10-minute run.</p></div>
        <button className="btn small primary" onClick={go}><Swords size={14} /> Play</button>
      </div>
    </section>
  );
}

/** The Play tab: pick a job, see stats and the chest at stake, start a run. */
export function PlayTab({ month }: { month: string }) {
  const { data } = useStore();
  const { ws } = useActive();
  const [save, setSave] = useState(loadSave);
  const [running, setRunning] = useState(false);
  const [sp, setSp] = useState<Sprites | null>(null);
  useEffect(() => { loadSprites().then(setSp).catch(() => null); }, []);
  const profile = profileFor(data, ws.id, month, save.job);
  const D = duration();
  const preview = chestFor(profile, false, D, D, 0);
  const choose = (job: Job) => { const n = { ...save, job }; setSave(n); writeSave(n); };
  return (
    <div className="page">
      <div className="page-head"><div><div className="eyebrow">{ws.name.toUpperCase()}</div><h1>Play</h1></div></div>
      <section className="card">
        <div className="card-head"><div><h2>Pick your job</h2><p>Saving more upgrades your title and your main weapon.</p></div></div>
        <div className="mg-jobs">
          {JOB_IDS.map(j => (
            <button key={j} className={`mg-job ${save.job === j ? 'on' : ''}`} style={{ borderColor: save.job === j ? JOBS[j].color : undefined }} onClick={() => choose(j)} aria-pressed={save.job === j}>
              {sp && <img className="mg-sprite" alt="" src={sp.anim[j].frames[0].toDataURL()} />}
              <strong style={{ color: JOBS[j].color }}>{JOBS[j].titles[profile.rank - 1]}</strong>
              <span>{JOBS[j].weapon}</span>
              <em>{JOBS[j].titles.join(' → ')}</em>
            </button>
          ))}
        </div>
        <p className="mg-blurb" style={{ marginTop: 12 }}>{profile.weapon}: {profile.blurb}.</p>
      </section>
      <section className="card">
        <div className="card-head"><div><h2>{profile.title}</h2><p>{profile.notes.rank}</p></div></div>
        <ul className="mg-stats">
          <li><span>Health</span><strong>{profile.maxHp}</strong><em>{profile.notes.hp}</em></li>
          <li><span>Damage</span><strong>×{profile.damage.toFixed(2)}</strong><em>{profile.notes.damage}</em></li>
          <li><span>Speed</span><strong>×{profile.speed.toFixed(2)}</strong></li>
          <li><span>Luck</span><strong>×{profile.luck.toFixed(2)}</strong><em>{profile.notes.luck}</em></li>
        </ul>
        <ul className="mg-perks">
          {JOBS[profile.job].perks.map((t, i) => <li key={i} className={i < profile.rank ? 'on' : ''}><b>{['Starter', 'Steady', 'Super'][i]} saver</b> {t}</li>)}
        </ul>
        <div className={`mg-chest t-${preview.tier}`}><span>Chest at stake</span><strong>{preview.tier}{profile.tier !== 'gold' ? ' → better if you win' : ' → legendary if you win'}</strong></div>
        <p className="mg-how">Drag anywhere to move. You attack on your own. Survive {fmt(D)} and beat the dragon.</p>
        <button className="btn primary mg-go" onClick={() => setRunning(true)}><Play size={16} /> Start run</button>
      </section>
      <section className="card">
        <div className="card-head"><div><h2>Your loot</h2><p>{save.coins} coins · best {save.runs > 0 ? fmt(save.bestSeconds) : '–'} · {save.runs} runs</p></div></div>
        {save.relics.length > 0 ? (
          <>
            <p className="muted">Equip up to {RELIC_SLOTS} relics ({save.equipped.length}/{RELIC_SLOTS}). They help in every run.</p>
            <div className="mg-relicgrid">
              {save.relics.map(r => {
                const on = save.equipped.includes(r), full = !on && save.equipped.length >= RELIC_SLOTS;
                return (
                  <button key={r} className={`mg-relic ${on ? 'on' : ''}`} disabled={full} onClick={() => { const next = { ...save, equipped: on ? save.equipped.filter(x => x !== r) : [...save.equipped, r] }; writeSave(next); setSave(next); }}>
                    <strong>{r}</strong><span>{RELIC_FX[r]?.desc}</span><em>{on ? 'Equipped' : 'Tap to equip'}</em>
                  </button>
                );
              })}
            </div>
          </>
        ) : <p className="muted">No relics yet. Win or survive a run to find one.</p>}
      </section>
      <p className="muted mg-credit">Game art: chierit (Elementals), Luiz Melo (Monsters Creatures Fantasy), Seth Boyles (32rogues), aamatniekss (Free Knight), Mira Forge and PVFX Foundry (effects), Willibab and Majorhn (weapon icons)</p>
      {running && <MonsterGame month={month} job={save.job} onClose={() => { setRunning(false); setSave(loadSave()); }} />}
    </div>
  );
}

type Phase = 'intro' | 'play' | 'result';
interface Hud { hp: number; maxHp: number; xp: number; need: number; level: number; t: number; D: number; kills: number; weapons?: any[]; items?: any[]; slots?: number; islots?: number; buffs?: any }

const TIER_NAME: Record<Tier, string> = { wood: 'Wooden', bronze: 'Bronze', silver: 'Silver', gold: 'Golden', legendary: 'Epic' };

function MonsterGame({ month, job, onClose }: { month: string; job: Job; onClose: () => void }) {
  const { data } = useStore();
  const { ws } = useActive();
  const profile = profileFor(data, ws.id, month, job);
  const D = duration();
  const [phase, setPhase] = useState<Phase>('play');
  const [hud, setHud] = useState<Hud | null>(null);
  const [choices, setChoices] = useState<any[] | null>(null);
  const [lvTitle, setLvTitle] = useState('Level up!');
  const [banner, setBanner] = useState('');
  const [shake, setShake] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ won: boolean; timeout?: boolean; seconds: number; kills: number; tier: Tier; finalTier: Tier; lucky: boolean; coins: number; relic: string; save: GameSave } | null>(null);
  const [chestStep, setChestStep] = useState(0); // 0 closed, 1 shaking, 2 open
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<any>(null);
  const pick = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    if (phase !== 'play' || !canvas.current) return;
    let bt: any, dead = false;
    loadSprites().catch(() => null).then(sprites => {
    if (dead || !canvas.current) return;
    game.current = startGame(canvas.current, profile, { duration: D, sprites, fx: relicFx(loadSave().equipped) }, {
      hud: setHud,
      levelUp: (opts: any[], cb: (id: string) => void, title?: string) => { pick.current = cb; setLvTitle(title || 'Level up!'); setChoices(opts); },
      banner: (m: string) => { setBanner(m); clearTimeout(bt); bt = setTimeout(() => setBanner(''), 2500); },
      shake: () => { setShake(true); setTimeout(() => setShake(false), 150); },
      end: ({ won, seconds, kills, timeout }: any) => {
        const c = chestFor(profile, won, seconds, D, kills);
        const luckyChance = 0.1 + 0.15 * Math.max(0, profile.luck - 1) / 0.8;   // 10% to 25%, better with a higher savings rate
        const lucky = TIERS.indexOf(c.tier) < 4 && Math.random() < luckyChance;
        const finalTier: Tier = lucky ? TIERS[TIERS.indexOf(c.tier) + 1] : c.tier;
        const coinsWon = lucky ? Math.round(c.coins * 1.5) : c.coins;
        const pool = RELICS[finalTier];
        const relic = pool[Math.floor(Math.random() * pool.length)];
        const s = loadSave();
        const next: GameSave = { coins: s.coins + coinsWon, relics: s.relics.includes(relic) ? s.relics : [...s.relics, relic], equipped: s.equipped, bestSeconds: Math.max(s.bestSeconds, seconds), runs: s.runs + 1, job: s.job };
        writeSave(next);
        setChestStep(0);
        setResult({ won, timeout, seconds, kills, tier: c.tier, lucky, finalTier, coins: coinsWon, relic, save: next });
        setPhase('result');
      },
    });
    (window as any).__game = game.current;
    });
    return () => { dead = true; game.current?.stop(); clearTimeout(bt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const close = () => { game.current?.stop(); onClose(); };

  return (
    <div className="mg" role="dialog" aria-label="Monster hunt">
      {phase === 'play' && (
        <>
          <canvas ref={canvas} className={`mg-canvas ${shake ? 'shake' : ''}`} />
          {hud && (
            <div className="mg-hud">
              <div className="mg-bars">
                <div className="mg-bar hp"><i style={{ width: `${Math.max(0, hud.hp / hud.maxHp) * 100}%` }} /></div>
                <div className="mg-bar xp"><i style={{ width: `${(hud.xp / hud.need) * 100}%` }} /></div>
              </div>
              <div className="mg-top"><span>Lv {hud.level}</span><strong data-testid="mg-time">{fmt(Math.max(0, hud.D - hud.t))}</strong><span>{hud.kills} slain</span></div>
              <div className="mg-chips">
                <div className="mg-slots">
                  {Array.from({ length: hud.slots || 3 }).map((_, i) => { const w = (hud.weapons || [])[i]; return <span key={i} className={`mg-slot ${w ? '' : 'empty'} ${w && w.level >= 7 ? 'max' : ''}`}>{w && <><WIcon id={w.id} size={22} /><b>{w.level >= 7 ? '★' : w.level}</b></>}</span>; })}
                  <i className="mg-sep" />
                  {Array.from({ length: hud.islots || 5 }).map((_, i) => { const w = (hud.items || [])[i]; return <span key={i} className={`mg-slot item ${w ? '' : 'empty'} ${w && w.level >= w.max ? 'max' : ''}`}>{w && <><WIcon id={w.id} size={22} /><b>{w.level >= w.max ? '★' : w.level}</b></>}</span>; })}
                </div>
                {hud.buffs?.inv > 0 && <span className="mg-chip buff">🛡️ {Math.ceil(hud.buffs.inv)}s</span>}
                {hud.buffs?.speed > 0 && <span className="mg-chip buff">⚡ {Math.ceil(hud.buffs.speed)}s</span>}
              </div>
            </div>
          )}
          <button className="mg-pause" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => { const v = !paused; setPaused(v); game.current?.pause(v); }}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
          <button className="mg-quit" aria-label="Leave run" onClick={close}><X size={16} /></button>
          {banner && <div className="mg-banner">{banner}</div>}
          {paused && !choices && <div className="mg-pausemsg">Paused</div>}
          {choices && (
            <div className="mg-levelup">
              <h3>{lvTitle}</h3>
              {choices.map(c => (
                <button key={c.id} className={`mg-choice ${c.have > 0 ? "" : "new"}`} onClick={() => { pick.current?.(c.id); setChoices(null); }}>
                  <strong>{IICON.includes(c.id) || c.weapon ? <WIcon id={c.id} size={c.have > 0 ? 28 : 52} /> : null}{c.name}</strong><span>{c.desc}</span>{c.have > 0 ? <em>Lv {c.have + 1}</em> : IICON.includes(c.id) ? <em>New item</em> : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {phase === 'result' && result && (
        <div className="mg-panel">
          <p className="mg-kicker">{result.won ? 'You slew the Dragon!' : result.timeout ? 'Time ran out' : 'You fell'}</p>
          <h2 className="mg-title">{result.won ? 'Victory' : 'Defeated'}</h2>
          <p className="mg-blurb">{fmt(result.seconds)} survived · {result.kills} monsters slain</p>
          {chestStep < 2 ? (
            <button className={`mg-chestbox t-${result.tier} ${chestStep === 1 ? 'shake' : ''}`} disabled={chestStep === 1} onClick={() => { setChestStep(1); setTimeout(() => setChestStep(2), 900); }}>
              <b>🧰</b><span>{TIER_NAME[result.tier]} chest</span><em>{chestStep === 1 ? 'Opening...' : 'Tap to open'}</em>
            </button>
          ) : (
            <>
              {result.lucky && <p className="mg-lucky">✨ Lucky! Your chest upgraded to {TIER_NAME[result.finalTier]} ✨</p>}
              <div className={`mg-chest open t-${result.finalTier}`}>
                <span>{TIER_NAME[result.finalTier]} chest</span>
                <strong>+{result.coins} coins</strong>
                <em>Relic found: {result.relic}</em>
              </div>
              <p className="mg-how">{result.won ? 'Bigger savings means a better chest.' : `Saving more raises your chest tier. Win a run for an even better one.`}</p>
              <p className="mg-meta">{result.save.coins} coins · {result.save.relics.length} relics</p>
            </>
          )}
          <div className="mg-row">
            <button className="btn" onClick={close}>Done</button>
            <button className="btn primary" onClick={() => { setResult(null); setHud(null); setPhase('play'); }}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
