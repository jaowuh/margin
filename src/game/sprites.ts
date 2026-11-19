import sheetUrl from '../assets/game-sprites.png';
import animUrl from '../assets/anim-sprites.png';
import knightUrl from '../assets/knight-sprites.png';
import fxUrl from '../assets/fx-sprites.png';
import iconUrl from '../assets/weapon-icons.png';
import statusUrl from '../assets/status-icons.png';
//  - Effects: "Free Pixel Hit & Impact Sparks" and "Free Pixel Spell Effects" by Mira Forge (itch.io, free, credit appreciated); only the used effects are packed into fx-sprites.png (64px frames).
// Art credits (only the frames used are packed into game-sprites.png and anim-sprites.png):
//  - "32rogues" by Seth Boyles: slime, troll, ettin, dragon, sword.
//  - "Elementals" Leaf Ranger, Water Priestess, Fire Knight by chierit (CC BY 4.0, https://chierit.itch.io): heroes.
//  - Swordsman: "Free Knight" animated knight (aamatniekss, itch.io); only run + idle frames are packed into knight-sprites.png.
//  - "Monsters Creatures Fantasy" by Luiz Melo (CC0): goblin, skeleton, mushroom, flying eye.
export interface Anim { frames: HTMLCanvasElement[]; flash: HTMLCanvasElement[]; w: number; h: number }
const MANIFEST: Record<string, { w: number; h: number; run: { y: number; n: number }; idle?: { y: number; n: number } }> = {"archer": {"w": 51, "h": 44, "run": {"y": 0, "n": 10}, "idle": {"y": 44, "n": 12}}, "mage": {"w": 36, "h": 38, "run": {"y": 88, "n": 10}, "idle": {"y": 126, "n": 8}}, "swordsman": {"w": 64, "h": 45, "run": {"y": 164, "n": 8}, "idle": {"y": 209, "n": 8}}, "goblin": {"w": 38, "h": 38, "run": {"y": 254, "n": 8}}, "skeleton": {"w": 45, "h": 51, "run": {"y": 292, "n": 4}}, "mushroom": {"w": 26, "h": 39, "run": {"y": 343, "n": 8}}, "eye": {"w": 42, "h": 33, "run": {"y": 382, "n": 8}}};
export type SpriteName = 'archer' | 'mage' | 'swordsman';
export interface Sprites {
  hero: Record<SpriteName, HTMLCanvasElement[]>;
  mon: Record<string, HTMLCanvasElement>;
  flash: Record<string, HTMLCanvasElement>;
  sword: HTMLCanvasElement;
  anim: Record<string, Anim>;
  fx: { img: HTMLImageElement; rows: Record<string, { y: number; n: number; x0?: number; w?: number; h?: number; ax?: number; ay?: number }> };
  icons: HTMLImageElement;
  status: HTMLImageElement;
}
const FX_ROWS: Record<string, { y: number; n: number; x0?: number; w?: number; h?: number; ax?: number; ay?: number }> = {"magic": {"y": 0, "n": 10}, "hit": {"y": 64, "n": 8}, "fire": {"y": 128, "n": 8}, "leaf": {"y": 192, "n": 8}, "splash": {"y": 320, "n": 8}, "slash": {"y": 384, "n": 8}, "zap": {"y": 448, "n": 8}, "level": {"y": 512, "n": 12}, "holy": {"y": 576, "n": 16}, "lotus": {"y": 640, "n": 15}, "strike": {"y": 704, "n": 11, "w": 96, "h": 128, "ax": 0.396, "ay": 0.922}, "burn": {"y": 832, "n": 12, "w": 48, "h": 64, "ax": 0.5, "ay": 0.844}, "poison": {"y": 896, "n": 18, "w": 64, "h": 80, "ax": 0.5, "ay": 0.9}, "slow": {"y": 976, "n": 16, "w": 48, "h": 56, "ax": 0.5, "ay": 0.893}, "stun": {"y": 1032, "n": 16, "w": 48, "h": 32, "ax": 0.5, "ay": 0.5}, "chill": {"y": 1064, "n": 14, "w": 40, "h": 48, "ax": 0.5, "ay": 0.875}, "shock": {"y": 1112, "n": 14, "w": 48, "h": 56, "ax": 0.5, "ay": 0.839}, "wave": {"y": 1168, "n": 8}, "slashf": {"y": 384, "n": 5, "x0": 192, "ax": 0.66, "ay": 0.47}, "lvl": {"y": 1232, "n": 20, "w": 64, "h": 96, "ax": 0.5, "ay": 0.917}, "frost": {"y": 1368, "n": 25, "w": 136, "h": 104, "ax": 0.5, "ay": 0.77}, "gflame": {"y": 1328, "n": 16, "w": 64, "h": 40, "ax": 0.5, "ay": 0.8}};

const IDX = { archer: [0, 1, 2], mage: [3, 4, 5], swordsman: [6, 7, 8] };
const MON: Record<string, number> = { slime: 9, bat: 10, goblin: 11, ogre: 12, king: 13, dragon: 14 };

function loadImg(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
let cache: Promise<Sprites> | null = null;
export function loadSprites(): Promise<Sprites> {
  if (cache) return cache;
  cache = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tile = (i: number) => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.getContext('2d')!.drawImage(img, (i % 4) * 32, Math.floor(i / 4) * 32, 32, 32, 0, 0, 32, 32); return cv; };
      const white = (src: HTMLCanvasElement) => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d')!; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, 32, 32); return cv; };
      const hero = {} as Record<SpriteName, HTMLCanvasElement[]>;
      (Object.keys(IDX) as SpriteName[]).forEach(k => { hero[k] = IDX[k].map(tile); });
      const mon: Record<string, HTMLCanvasElement> = {}, flash: Record<string, HTMLCanvasElement> = {};
      for (const k in MON) { mon[k] = tile(MON[k]); flash[k] = white(mon[k]); }
      loadImg(animUrl).then(a => {
        const anim: Record<string, Anim> = {};
        for (const k in MANIFEST) {
          const { w, h, run } = MANIFEST[k];
          const frames: HTMLCanvasElement[] = [], fl: HTMLCanvasElement[] = [];
          for (let i = 0; i < run.n; i++) {
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d')!.drawImage(a, i * w, run.y, w, h, 0, 0, w, h); frames.push(cv);
            const f = document.createElement('canvas'); f.width = w; f.height = h; const x = f.getContext('2d')!; x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); fl.push(f);
          }
          anim[k] = { frames, flash: fl, w, h };
          const idle = MANIFEST[k].idle;
          if (idle) {
            const fr: HTMLCanvasElement[] = [];
            for (let i = 0; i < idle.n; i++) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d')!.drawImage(a, i * w, idle.y, w, h, 0, 0, w, h); fr.push(cv); }
            anim[k + '_idle'] = { frames: fr, flash: fr, w, h };
          }
        }
        // Swordsman: armored knight (Free Knight pack, 31x40 frames: row 0 = run, row 1 = idle)
        loadImg(knightUrl).then(kn => {
          const KW = 31, KH = 40, KN = 10;
          const strip = (row: number) => {
            const frames: HTMLCanvasElement[] = [], fl: HTMLCanvasElement[] = [];
            for (let i = 0; i < KN; i++) {
              const cv = document.createElement('canvas'); cv.width = KW; cv.height = KH; cv.getContext('2d')!.drawImage(kn, i * KW, row * KH, KW, KH, 0, 0, KW, KH); frames.push(cv);
              const f = document.createElement('canvas'); f.width = KW; f.height = KH; const x = f.getContext('2d')!; x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, KW, KH); fl.push(f);
            }
            return { frames, flash: fl, w: 46, h: 60 } as Anim; // drawn 1.5x bigger than the source pixels
          };
          anim.swordsman = strip(0);
          anim.swordsman_idle = strip(1);
          Promise.all([loadImg(fxUrl), loadImg(iconUrl), loadImg(statusUrl)]).then(([fxi, ico, sti]) => resolve({ hero, mon, flash, sword: tile(15), anim, fx: { img: fxi, rows: FX_ROWS }, icons: ico, status: sti })).catch(reject);
        }).catch(reject);
      }).catch(reject);
    };
    img.onerror = reject;
    img.src = sheetUrl;
  });
  return cache;
}
