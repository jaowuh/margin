import sheetUrl from '../assets/game-sprites.png';
import animUrl from '../assets/anim-sprites.png';
// Art credits (only the frames used are packed into game-sprites.png and anim-sprites.png):
//  - "32rogues" by Seth Boyles: slime, troll, ettin, dragon, sword.
//  - "Elementals" Leaf Ranger, Water Priestess, Fire Knight by chierit (CC BY 4.0, https://chierit.itch.io): heroes.
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
}

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
        // Swordsman: the bare-handed fighter tile (32rogues), animated with a bob and tilt
        const fighter = (n: number, bob: number[], tilt: number) => {
          const Z = 1.5, S = Math.round(32 * Z), fr: HTMLCanvasElement[] = [], fl: HTMLCanvasElement[] = [];
          for (let i = 0; i < n; i++) {
            const cv = document.createElement('canvas'); cv.width = S; cv.height = S + 4; const x = cv.getContext('2d')!;
            x.imageSmoothingEnabled = false; x.translate(S / 2, S + 2); x.rotate(Math.sin((i / n) * Math.PI * 2) * tilt);
            x.drawImage(tile(6), -S / 2, -S - 2 + 4 + bob[i % bob.length], S, S); fr.push(cv);
            const f = document.createElement('canvas'); f.width = cv.width; f.height = cv.height; const y = f.getContext('2d')!; y.drawImage(cv, 0, 0); y.globalCompositeOperation = 'source-in'; y.fillStyle = '#fff'; y.fillRect(0, 0, f.width, f.height); fl.push(f);
          }
          return { frames: fr, flash: fl, w: S, h: S + 4 } as Anim;
        };
        anim.swordsman = fighter(8, [0, -2, -3, -2, 0, -2, -3, -2], 0.07);
        anim.swordsman_idle = fighter(8, [0, 0, -1, -1, 0, 0, -1, -1], 0);
        resolve({ hero, mon, flash, sword: tile(15), anim });
      }).catch(reject);
    };
    img.onerror = reject;
    img.src = sheetUrl;
  });
  return cache;
}
