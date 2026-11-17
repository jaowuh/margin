import sheetUrl from '../assets/roguelike-chars.png';
// Art: Kenney "Roguelike Characters" (CC0, kenney.nl). 16px tiles, 1px margin.
const S = 17;
export interface Sprites { hero: Record<string, HTMLCanvasElement[]>; weapon: Record<string, HTMLCanvasElement>; orc: HTMLCanvasElement; orcFlash: HTMLCanvasElement; knight: HTMLCanvasElement; knightFlash: HTMLCanvasElement; swordTile: HTMLCanvasElement }

const HEROES: Record<string, [number, number][]> = {
  archer: [[0, 7], [0, 5], [1, 7]],
  mage: [[1, 5], [0, 9], [0, 10]],
  swordsman: [[1, 9], [1, 10], [1, 11]],
};
const WEAPON_TILE: Record<string, [number, number]> = { archer: [52, 0], mage: [42, 2], swordsman: [37, 1] };

let cache: Promise<Sprites> | null = null;
export function loadSprites(): Promise<Sprites> {
  if (cache) return cache;
  cache = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tile = (c: number, r: number) => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; cv.getContext('2d')!.drawImage(img, c * S, r * S, 16, 16, 0, 0, 16, 16); return cv; };
      const flash = (src: HTMLCanvasElement) => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; const x = cv.getContext('2d')!; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 16); return cv; };
      const hero: Record<string, HTMLCanvasElement[]> = {};
      for (const k in HEROES) hero[k] = HEROES[k].map(([c, r]) => tile(c, r));
      const weapon: Record<string, HTMLCanvasElement> = {};
      for (const k in WEAPON_TILE) weapon[k] = tile(...WEAPON_TILE[k]);
      const orc = tile(0, 3), knight = tile(1, 11);
      resolve({ hero, weapon, orc, orcFlash: flash(orc), knight, knightFlash: flash(knight), swordTile: tile(44, 6) });
    };
    img.onerror = reject;
    img.src = sheetUrl;
  });
  return cache;
}
