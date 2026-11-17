import sheetUrl from '../assets/game-sprites.png';
// Art: "32rogues" by Seth Boyles (sethbb.itch.io/32rogues). Only the sprites used here are packed into game-sprites.png.
export type SpriteName = 'archer' | 'mage' | 'swordsman';
export interface Sprites {
  hero: Record<SpriteName, HTMLCanvasElement[]>;
  mon: Record<string, HTMLCanvasElement>;
  flash: Record<string, HTMLCanvasElement>;
  sword: HTMLCanvasElement;
}

const IDX = { archer: [0, 1, 2], mage: [3, 4, 5], swordsman: [6, 7, 8] };
const MON: Record<string, number> = { slime: 9, bat: 10, goblin: 11, ogre: 12, king: 13, dragon: 14 };

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
      resolve({ hero, mon, flash, sword: tile(15) });
    };
    img.onerror = reject;
    img.src = sheetUrl;
  });
  return cache;
}
