import { describe, expect, it } from 'vitest';
import type { AppData } from '../types';
import { accountBalance, categoryBreakdown, limitInPeriod, monthElapsedPct, monthlyIncome, monthlyLimitFor, monthSummary, periodWindow, splitSavings, statusFor, suggestSplit, upcomingItems, workspaceBalance } from './calc';
import * as A from './actions';
import { addMonths, nextMonthlyDate, peso, todayStr } from './format';
import { createInitialData } from './seed';
import { normalizeData } from './storage';

function fixture() {
  let d = createInitialData();
  const ws = d.workspaces[0].id;
  const cafe = d.workspaces[1].id;
  const cat = (name: string, w = ws) => d.categories.find(c => c.workspaceId === w && c.name === name)!;
  const accs = d.accounts.filter(a => a.workspaceId === ws);
  d = A.updateCategory(d, cat('Food').id, { monthlyLimit: 1000 });
  d = A.updateCategory(d, cat('Transport').id, { monthlyLimit: 500 });
  return { d, ws, cafe, cat, accs };
}

describe('statusFor', () => {
  it('uses 80% / 100% thresholds', () => {
    expect(statusFor(10, 0)).toBe('none');
    expect(statusFor(799, 1000)).toBe('ok');
    expect(statusFor(800, 1000)).toBe('warn');
    expect(statusFor(1000, 1000)).toBe('warn');
    expect(statusFor(1000.01, 1000)).toBe('over');
  });
});

describe('balances', () => {
  it('handles income, expense and transfers without changing the combined total', () => {
    const { d: d0, ws, accs } = fixture();
    let d = A.updateAccount(d0, accs[0].id, { openingBalance: 1000 });
    d = A.addTransaction(d, { workspaceId: ws, type: 'income', amount: 500, date: '2026-11-02', accountId: accs[0].id, categoryId: null, note: '' });
    d = A.addTransaction(d, { workspaceId: ws, type: 'expense', amount: 200.5, date: '2026-11-03', accountId: accs[0].id, categoryId: null, note: '' });
    const before = workspaceBalance(d, ws, 'all', []);
    d = A.addTransaction(d, { workspaceId: ws, type: 'transfer', amount: 300, date: '2026-11-04', accountId: accs[0].id, toAccountId: accs[1].id, categoryId: null, note: '' });
    const fresh = (id: string) => d.accounts.find(a => a.id === id)!;
    expect(accountBalance(d, fresh(accs[0].id))).toBe(1000 + 500 - 200.5 - 300);
    expect(accountBalance(d, fresh(accs[1].id))).toBe(300);
    expect(workspaceBalance(d, ws, 'all', [])).toBe(before);
    expect(workspaceBalance(d, ws, 'primary', [])).toBe(999.5);
    expect(before).toBe(1299.5);
    expect(workspaceBalance(d, ws, 'selected', [accs[1].id])).toBe(300);
  });

  it('keeps workspaces separate', () => {
    const { d: d0, ws, cafe } = fixture();
    const cafeAcc = d0.accounts.find(a => a.workspaceId === cafe)!;
    const d = A.addTransaction(d0, { workspaceId: cafe, type: 'income', amount: 999, date: '2026-11-02', accountId: cafeAcc.id, categoryId: null, note: '' });
    expect(workspaceBalance(d, ws, 'all', [])).toBe(0);
    expect(workspaceBalance(d, cafe, 'all', [])).toBe(999);
    expect(monthSummary(d, ws, '2026-11').income).toBe(0);
  });
});

describe('month summary / category breakdown', () => {
  it('computes budget used, remaining, unbudgeted and uncategorized spending', () => {
    const { d: d0, ws, cat, accs } = fixture();
    const tx = (amount: number, categoryId: string | null, date = '2026-11-05') =>
      ({ workspaceId: ws, type: 'expense' as const, amount, date, accountId: accs[0].id, categoryId, note: '' });
    let d = A.addTransaction(d0, tx(400, cat('Food').id));
    d = A.addTransaction(d, tx(550, cat('Transport').id));           // 110% of 500 -> over
    d = A.addTransaction(d, tx(120, cat('Household').id));           // category with no limit
    d = A.addTransaction(d, tx(30, null));                           // uncategorized
    d = A.addTransaction(d, tx(9999, cat('Food').id, '2026-10-31')); // other month: ignored
    const s = monthSummary(d, ws, '2026-11');
    expect(s.budget).toBe(1500);
    expect(s.spent).toBe(1100);
    expect(s.remaining).toBe(400);
    expect(s.usedPct).toBeCloseTo(73.33, 1);
    expect(s.status).toBe('ok');
    expect(s.unbudgetedSpent).toBe(150);
    const rows = categoryBreakdown(d, ws, '2026-11');
    expect(rows.find(r => r.name === 'Transport')!.status).toBe('over');
    expect(rows.find(r => r.name === 'Uncategorized')!.spent).toBe(30);
    expect(rows.find(r => r.name === 'Food')!.pct).toBe(40);
  });

  it('subtracts upcoming planned bills from what is left', () => {
    const { d: d0, ws, cat } = fixture();
    let d = A.addScheduled(d0, { workspaceId: ws, type: 'expense', title: 'Internet', amount: 300, dueDate: '2026-11-20', categoryId: cat('Food').id, accountId: null, repeat: 'none' });
    d = A.addScheduled(d, { workspaceId: ws, type: 'expense', title: 'Next month', amount: 700, dueDate: '2026-12-02', categoryId: null, accountId: null, repeat: 'none' });
    const s = monthSummary(d, ws, '2026-11');
    expect(s.upcomingExpenses).toBe(300);
    expect(s.leftAfterUpcoming).toBe(1500 - 0 - 300);
    expect(upcomingItems(d, ws, '2026-11')).toHaveLength(1);
  });

  it('reports month progress only for the current month', () => {
    expect(monthElapsedPct('2026-11', '2026-11-15')).toBe(50);
    expect(monthElapsedPct('2026-10', '2026-11-15')).toBeNull();
  });
});

describe('planner', () => {
  it('pays a bill once, records the expense, and plans the next monthly one', () => {
    const { d: d0, ws, cat, accs } = fixture();
    let d = A.addScheduled(d0, { workspaceId: ws, type: 'expense', title: 'Loan', amount: 5000, dueDate: '2026-01-31', categoryId: cat('Bills').id, accountId: null, repeat: 'monthly' });
    const id = d.scheduled[0].id;
    d = A.payScheduled(d, id, accs[0].id, '2026-01-30');
    d = A.payScheduled(d, id, accs[0].id, '2026-01-30'); // double tap -> no duplicate
    expect(d.transactions).toHaveLength(1);
    expect(d.transactions[0]).toMatchObject({ amount: 5000, type: 'expense', note: 'Loan', accountId: accs[0].id });
    expect(d.scheduled).toHaveLength(2);
    expect(d.scheduled[1]).toMatchObject({ status: 'planned', dueDate: '2026-02-28' });
  });

  it('deleting the payment puts a one-off bill back to planned', () => {
    const { d: d0, ws, accs } = fixture();
    let d = A.addScheduled(d0, { workspaceId: ws, type: 'expense', title: 'Tax', amount: 100, dueDate: '2026-11-10', categoryId: null, accountId: null, repeat: 'none' });
    d = A.payScheduled(d, d.scheduled[0].id, accs[0].id, '2026-11-10');
    d = A.deleteTransaction(d, d.transactions[0].id);
    expect(d.scheduled[0].status).toBe('planned');
    expect(d.transactions).toHaveLength(0);
  });
});

describe('accounts & categories', () => {
  it('archives accounts with history, removes empty ones, keeps one primary', () => {
    const { d: d0, ws, accs } = fixture();
    let d = A.addTransaction(d0, { workspaceId: ws, type: 'expense', amount: 10, date: '2026-11-01', accountId: accs[0].id, categoryId: null, note: '' });
    d = A.removeAccount(d, accs[0].id); // primary with history -> archived
    expect(d.accounts.find(a => a.id === accs[0].id)!.isActive).toBe(false);
    expect(d.accounts.filter(a => a.workspaceId === ws && a.isPrimary && a.isActive)).toHaveLength(1);
    d = A.removeAccount(d, accs[2].id); // empty -> removed
    expect(d.accounts.find(a => a.id === accs[2].id)).toBeUndefined();
  });

  it('deleting a category keeps its transactions as uncategorized', () => {
    const { d: d0, ws, cat, accs } = fixture();
    let d = A.addTransaction(d0, { workspaceId: ws, type: 'expense', amount: 10, date: '2026-11-01', accountId: accs[0].id, categoryId: cat('Food').id, note: '' });
    d = A.deleteCategory(d, cat('Food').id);
    expect(d.transactions[0].categoryId).toBeNull();
    expect(categoryBreakdown(d, ws, '2026-11').find(r => r.name === 'Uncategorized')!.spent).toBe(10);
  });

  it('refuses to delete the last workspace and cascades otherwise', () => {
    const { d, cafe } = fixture();
    const after = A.deleteWorkspace(d, cafe);
    expect(after.workspaces).toHaveLength(1);
    expect(after.accounts.some(a => a.workspaceId === cafe)).toBe(false);
    expect(A.deleteWorkspace(after, after.workspaces[0].id).workspaces).toHaveLength(1);
  });
});

describe('format helpers', () => {
  it('formats pesos and dates', () => {
    expect(peso(1234)).toContain('1,234');
    expect(peso(1234.5)).toContain('1,234.50');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(nextMonthlyDate('2026-12-15')).toBe('2027-01-15');
    expect(todayStr(new Date(2026, 10, 11, 23, 59))).toBe('2026-11-11');
  });
});

describe('backup validation', () => {
  it('round-trips real data and rejects non-backups', () => {
    const { d } = fixture();
    const res = normalizeData(JSON.parse(JSON.stringify(d)));
    expect(res?.dropped).toBe(0);
    expect(res?.data.workspaces).toHaveLength(2);
    expect(normalizeData({ hello: 1 })).toBeNull();
    expect(normalizeData('x')).toBeNull();
  });

  it('drops malformed rows instead of crashing', () => {
    const { d, ws, accs } = fixture();
    const bad = JSON.parse(JSON.stringify(d)) as AppData;
    bad.transactions.push(
      { id: 't1', workspaceId: ws, type: 'expense', amount: -5, date: '2026-11-01', accountId: accs[0].id, categoryId: null, note: '' },
      { id: 't2', workspaceId: ws, type: 'expense', amount: 5, date: 'yesterday', accountId: accs[0].id, categoryId: null, note: '' },
      { id: 't3', workspaceId: 'nope', type: 'expense', amount: 5, date: '2026-11-01', accountId: accs[0].id, categoryId: null, note: '' },
      { id: 't4', workspaceId: ws, type: 'expense', amount: 5, date: '2026-11-01', accountId: accs[0].id, categoryId: null, note: '' },
    );
    const res = normalizeData(bad)!;
    expect(res.dropped).toBe(3);
    expect(res.data.transactions.map(t => t.id)).toEqual(['t4']);
  });
});

describe('sample data', () => {
  it('adds budgets, transactions and bills to a workspace', () => {
    const { d: d0, ws } = fixture();
    const d = A.addSampleData(d0, ws, '2026-11-15');
    expect(d.transactions.length).toBeGreaterThan(0);
    const s = monthSummary(d, ws, '2026-11');
    expect(s.budget).toBeGreaterThan(0);
    expect(s.spent).toBeGreaterThan(0);
    expect(A.clearWorkspaceTransactions(d, ws).transactions).toHaveLength(0);
  });
});

describe('daily / weekly limits and groups', () => {
  it('derives monthly and per-period limits', () => {
    let { d, ws, cat } = fixture();
    d = A.setCategoryLimit(d, cat('Food').id, 200, 'day');
    const c = d.categories.find(x => x.id === cat('Food').id)!;
    expect(monthlyLimitFor(c, '2026-11')).toBe(6000);     // 30 days
    expect(monthlyLimitFor(c, '2026-02')).toBe(5600);     // 28 days
    expect(limitInPeriod(c, '2026-11', 'day')).toBe(200);
    expect(limitInPeriod(c, '2026-11', 'week')).toBe(1400);
    d = A.setCategoryLimit(d, c.id, 700, 'week');
    const w = d.categories.find(x => x.id === c.id)!;
    expect(limitInPeriod(w, '2026-11', 'week')).toBe(700);
    expect(monthlyLimitFor(w, '2026-11')).toBe(3000);     // 700 * 30 / 7
    d = A.setCategoryLimit(d, c.id, 900, 'month');
    expect(monthlyLimitFor(d.categories.find(x => x.id === c.id)!, '2026-11')).toBe(900);
    expect(ws).toBeTruthy();
  });

  it('week window runs Monday to Sunday', () => {
    expect(periodWindow('week', '2026-11', '2026-11-18')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Wed
    expect(periodWindow('week', '2026-11', '2026-11-22')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Sun
    expect(periodWindow('week', '2026-11', '2026-11-30')).toEqual({ start: '2026-11-30', end: '2026-12-06' }); // Mon
  });

  it('day and week summaries only count their window', () => {
    let { d, ws, cat, accs } = fixture();
    d = A.setCategoryLimit(d, cat('Food').id, 200, 'day');
    const add = (date: string, amount: number) => { d = A.addTransaction(d, { workspaceId: ws, type: 'expense', amount, date, accountId: accs[0].id, categoryId: cat('Food').id, note: '' }); };
    add('2026-11-18', 150); add('2026-11-17', 100); add('2026-11-10', 400);
    const day = monthSummary(d, ws, '2026-11', 'day', '2026-11-18');
    expect(day.spent).toBe(150); expect(day.budget).toBe(217); // 200 + round(500 / 30)
    const week = monthSummary(d, ws, '2026-11', 'week', '2026-11-18');
    expect(week.spent).toBe(250);
    expect(monthSummary(d, ws, '2026-11').spent).toBe(650);
    expect(categoryBreakdown(d, ws, '2026-11', 'day', '2026-11-18').find(r => r.name === 'Food')!.limit).toBe(200);
  });

  it('groups survive normalisation and can be cleared', () => {
    let { d, cat } = fixture();
    d = A.setCategoryGroup(d, cat('Food').id, '  Food  ');
    d = A.setCategoryLimit(d, cat('Food').id, 200, 'day');
    const back = normalizeData(JSON.parse(JSON.stringify(d)))!.data;
    const c = back.categories.find(x => x.id === cat('Food').id)!;
    expect(c.group).toBe('Food'); expect(c.limitPeriod).toBe('day'); expect(c.limitAmount).toBe(200);
    d = A.setCategoryGroup(d, cat('Food').id, '');
    expect(d.categories.find(x => x.id === cat('Food').id)!.group).toBeUndefined();
  });
});

describe('budget wizard', () => {
  it('turns weekly income into monthly', () => {
    expect(monthlyIncome(5000, 'week')).toBe(21667);
    expect(monthlyIncome(30000, 'month')).toBe(30000);
  });
  it('splits money to whole pesos that add up', () => {
    const s = suggestSplit(['Household', 'Food', 'Transport', 'Bills', 'Daughter', 'Personal & other', 'Pets'], 23456);
    expect(s.reduce((a, b) => a + b, 0)).toBe(23456);
    expect(splitSavings(3, 6000)).toEqual([3000, 1800, 1200]);
    expect(splitSavings(3, 6001).reduce((a, b) => a + b, 0)).toBe(6001);
    expect(suggestSplit([], 100)).toEqual([]);
  });
  it('applies the wizard: limits, goals (keeping progress), income', () => {
    let { d, ws, cat } = fixture();
    d = A.addGoal(d, ws, 'Emergency fund', 1000, 0);
    d = A.toggleGoalSaved(d, d.goals[0].id, '2026-11');
    expect(d.goals[0].saved).toBe(1000);
    d = A.applyWizard(d, ws, { income: 30000, incomePeriod: 'month', goals: [{ name: 'emergency FUND', monthlyAmount: 2000, target: 60000 }, { name: 'Travel fund', monthlyAmount: 1000, target: 0 }], limits: { [cat('Food').id]: 7000 } });
    expect(d.goals.map(g => g.name)).toEqual(['Emergency fund', 'Travel fund']);
    expect(d.goals[0].saved).toBe(1000); expect(d.goals[0].monthlyAmount).toBe(2000); expect(d.goals[0].target).toBe(60000);
    expect(monthlyLimitFor(d.categories.find(c => c.id === cat('Food').id)!, '2026-11')).toBe(7000);
    expect(d.prefs.plans![ws]).toEqual({ income: 30000, incomePeriod: 'month' });
    d = A.toggleGoalSaved(d, d.goals[0].id, '2026-11');          // undo this month's tick
    expect(d.goals[0].saved).toBe(0 + (1000 - 2000 < 0 ? 0 : 1000 - 2000));
    d = A.applyWizard(d, ws, { income: 30000, incomePeriod: 'month', goals: [], limits: {} });
    expect(d.goals).toHaveLength(0);
    const back = normalizeData(JSON.parse(JSON.stringify(A.addGoal(d, ws, 'X', 1))))!.data;
    expect(back.goals).toHaveLength(1);
  });
});

describe('monster game profile', () => {
  it('derives job, stats and chest tier from real savings', async () => {
    const { profileFor, chestFor } = await import('../game/profile');
    let { d, ws } = fixture();
    expect(profileFor(d, ws, '2026-11').job).toBe('Wanderer');
    d = A.applyWizard(d, ws, { income: 30000, incomePeriod: 'month', goals: [{ name: 'Emergency fund', monthlyAmount: 6000, target: 0 }], limits: {} });
    let p = profileFor(d, ws, '2026-11');
    expect(p.job).toBe('Knight'); expect(p.tier).toBe('silver'); expect(p.rate).toBeCloseTo(0.2);
    d = A.toggleGoalSaved(d, d.goals[0].id, '2026-11');
    p = profileFor(d, ws, '2026-11');
    expect(p.damage).toBeCloseTo(1.4);
    d = A.applyWizard(d, ws, { income: 30000, incomePeriod: 'month', goals: [{ name: 'Emergency fund', monthlyAmount: 9000, target: 0 }], limits: {} });
    p = profileFor(d, ws, '2026-11');
    expect(p.job).toBe('Paladin'); expect(p.tier).toBe('gold');
    expect(chestFor(p, true, 600, 600, 100).tier).toBe('legendary');
    expect(chestFor(p, false, 100, 600, 0).tier).toBe('gold');
  });
});
