import type { AppData } from '../types';
import { monthlyIncome, monthSummary } from '../lib/calc';

export type Tier = 'wood' | 'bronze' | 'silver' | 'gold' | 'legendary';
export const TIERS: Tier[] = ['wood', 'bronze', 'silver', 'gold', 'legendary'];

export interface Profile {
  job: 'Wanderer' | 'Scout' | 'Knight' | 'Paladin';
  blurb: string;
  color: string;
  /** monthly savings / monthly income (0 if none) */
  rate: number;
  maxHp: number;
  speed: number;
  damage: number;
  /** reward multiplier */
  luck: number;
  tier: Tier;
  /** where the numbers came from, for the intro screen */
  notes: { hp: string; damage: string; luck: string };
}

/** Turns the player's real budget and savings into a game character. */
export function profileFor(data: AppData, workspaceId: string, month: string): Profile {
  const goals = data.goals.filter(g => g.workspaceId === workspaceId && g.monthlyAmount > 0);
  const goalsSum = goals.reduce((s, g) => s + g.monthlyAmount, 0);
  const plan = data.prefs.plans?.[workspaceId];
  const income = plan ? monthlyIncome(plan.income, plan.incomePeriod) : 0;
  const rate = goalsSum <= 0 ? 0 : income > 0 ? Math.min(1, goalsSum / income) : 0.1;

  const base = goalsSum <= 0
    ? { job: 'Wanderer' as const, blurb: 'No savings plan yet. Start one to level up your hero.', color: '#A8A29E', hp: 80, speed: 1, damage: 1 }
    : rate >= 0.25 ? { job: 'Paladin' as const, blurb: 'Super saver. Slow, tough and hits hard.', color: '#E0B04A', hp: 150, speed: 0.95, damage: 1.2 }
      : rate >= 0.15 ? { job: 'Knight' as const, blurb: 'Steady saver. Balanced and reliable.', color: '#DCA289', hp: 120, speed: 1, damage: 1.1 }
        : { job: 'Scout' as const, blurb: 'Starter saver. Quick on its feet.', color: '#6FA8A0', hp: 100, speed: 1.15, damage: 1 };

  const sum = monthSummary(data, workspaceId, month);
  const hpBonus = sum.budget > 0 ? (sum.status === 'ok' ? 40 : sum.status === 'warn' ? 20 : 0) : 0;
  const ticked = goals.length ? goals.filter(g => g.savedMonths.includes(month)).length / goals.length : 0;
  const dmgBonus = 0.3 * ticked;
  const luck = 1 + Math.min(0.8, rate * 2);

  const tier: Tier = goalsSum <= 0 || rate < 0.1 ? 'wood' : rate < 0.15 ? 'bronze' : rate < 0.25 ? 'silver' : 'gold';
  return {
    job: base.job, blurb: base.blurb, color: base.color, rate,
    maxHp: base.hp + hpBonus, speed: base.speed, damage: Math.round((base.damage + dmgBonus) * 100) / 100, luck: Math.round(luck * 100) / 100, tier,
    notes: {
      hp: hpBonus > 0 ? `+${hpBonus} for staying within budget` : sum.budget > 0 ? 'Over budget this month, so no bonus' : 'Create a budget for a health bonus',
      damage: ticked > 0 ? `+${Math.round(dmgBonus * 100)}% for savings you ticked off this month` : 'Tick off your savings for bonus damage',
      luck: rate > 0 ? `Saving ${Math.round(rate * 100)}% of income` : 'Save more for better rewards',
    },
  };
}

export const RELICS: Record<Tier, string[]> = {
  wood: ['Rusty Coin', 'Cracked Piggy', 'Wooden Charm'],
  bronze: ['Bronze Badge', 'Copper Ring', 'Lucky Penny'],
  silver: ['Silver Crown', 'Moonlit Purse', 'Steady Shield'],
  gold: ['Golden Goblet', 'Sunstone Vault', 'Hoarder’s Crest'],
  legendary: ['Dragon’s Hoard', 'Crown of Compound Interest', 'Phoenix Ledger'],
};

export function chestFor(profile: Profile, won: boolean, seconds: number, duration: number, kills: number): { tier: Tier; coins: number } {
  let i = TIERS.indexOf(profile.tier);
  if (won && i < 4) i++;                       // finishing the run opens a better chest
  if (won && profile.tier === 'gold') i = 4;   // gold + a win = legendary
  const tier = TIERS[i];
  const base = [30, 60, 110, 180, 300][i];
  const progress = won ? 1.5 : Math.max(0.2, Math.min(1, seconds / duration));
  return { tier, coins: Math.round(base * profile.luck * progress + Math.min(40, kills / 10)) };
}

export interface GameSave { coins: number; relics: string[]; bestSeconds: number; runs: number }
const KEY = 'margin:game';
export function loadSave(): GameSave {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.coins === 'number') return { coins: v.coins, relics: Array.isArray(v.relics) ? v.relics.filter((x: unknown) => typeof x === 'string') : [], bestSeconds: +v.bestSeconds || 0, runs: +v.runs || 0 };
  } catch { /* ignore */ }
  return { coins: 0, relics: [], bestSeconds: 0, runs: 0 };
}
export function writeSave(s: GameSave) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
