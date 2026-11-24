import type { Account, CalendarDaySummary, CycleBudgetMetrics, PlannedExpense, RolloverMode, SalaryConfig, Transaction } from '../types/finance';
import { getSalaryCycle } from './cycle';

const floorMoney = (value: number) => Math.floor(Math.max(0, value));
export function getCycleDateInfo(dayIndex: number, paydayDay = 5) {
  const d = getSalaryCycle(paydayDay).start;
  d.setDate(d.getDate() + dayIndex);
  const weekdayIndex = (d.getDay() + 6) % 7;
  return { dateLabel: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, shortDay: String(d.getDate()).padStart(2, '0'), weekdayIndex, weekdayLabel: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][weekdayIndex] };
}

export function transactionsInCycle(transactions: Transaction[], payday: number, now = new Date()) {
  const { start, end } = getSalaryCycle(payday, now);
  const utcDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return transactions.flatMap(tx => {
    if (!['confirmed', 'pending'].includes(tx.status)) return [];
    let effective: Date | undefined;
    if (tx.effectiveDate) effective = new Date(tx.effectiveDate + 'T00:00:00');
    else if (tx.cycleStartDate) {
      effective = new Date(tx.cycleStartDate + 'T00:00:00');
      effective.setDate(effective.getDate() + tx.cycleDayIndex);
    } else if (tx.createdAt) effective = new Date(tx.createdAt);
    if (!effective) return tx.cycleDayIndex >= 0 && tx.cycleDayIndex < Math.round((utcDay(end) - utcDay(start)) / 86400000) ? [tx] : [];
    if (!(effective >= start && effective < end)) return [];
    return [{ ...tx, cycleDayIndex: Math.round((utcDay(effective) - utcDay(start)) / 86400000) }];
  });
}

// Only recorded spending is spending. Savings targets and upcoming bills are reservations,
// not transactions. Planned payments consume their reservation, never the daily allowance twice.
export function calculateCycleBudgetMetrics(
  config: SalaryConfig, transactions: Transaction[], plans: PlannedExpense[], mode: RolloverMode, accounts?: Account[]
): CycleBudgetMetrics {
  const totalCycleDays = Math.max(1, Math.floor(config.totalCycleDays));
  const todayIndex = Math.min(totalCycleDays - 1, Math.max(0, Math.floor(config.todayIndex)));
  const cycleStartDayIndex = Math.min(todayIndex, Math.max(0, Math.floor(config.cycleStartDayIndex || 0)));
  const activeCycleDays = Math.max(1, totalCycleDays - cycleStartDayIndex);
  const current = transactionsInCycle(transactions, config.paydayDay);
  const paidPlans = new Set(current.filter(t => t.plannedExpenseId).map(t => t.plannedExpenseId));
  const reservedPlans = plans.filter(p => !p.completed || paidPlans.has(p.id));
  const plannedReserveTotal = plans.filter(p => !p.completed).reduce((s, p) => s + p.amount, 0);
  const totalLivingBudget = floorMoney(config.monthlyIncome - config.fixedBills - config.savingsTarget);
  const savingsMoved = current.filter(t => t.type === 'internal').reduce((s, t) => s + t.amount * (t.savingsDirection || 0), 0);
  const loans = current.filter(t => t.type === 'loan').reduce((s, t) => s + t.amount, 0);
  const fixedPaid = current.filter(t => t.type === 'expense' && t.budgetSource === 'fixed').reduce((sum, t) => sum + t.amount, 0);
  const spendableLivingPool = floorMoney(totalLivingBudget - Math.max(0, fixedPaid - config.fixedBills) - reservedPlans.reduce((s, p) => s + p.amount, 0) - loans - Math.max(0, savingsMoved - config.savingsTarget));
  const dailyExpenses = current.filter(t => t.type === 'expense' && !t.plannedExpenseId && t.budgetSource !== 'fixed');
  const spentOn = (index: number) => dailyExpenses.filter(t => t.cycleDayIndex === index).reduce((s, t) => s + t.amount, 0);
  const totalSpentCycle = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const livingSpent = dailyExpenses.reduce((s, t) => s + t.amount, 0);
  const remainingLivingBudget = floorMoney(spendableLivingPool - livingSpent);
  const baseDailyAllowance = floorMoney(spendableLivingPool / activeCycleDays);
  const pastSpent = dailyExpenses.filter(t => t.cycleDayIndex < todayIndex).reduce((s, t) => s + t.amount, 0);
  const todaySpent = spentOn(todayIndex);
  const remainingDays = totalCycleDays - todayIndex;
  const activePastDays = Math.max(0, todayIndex - cycleStartDayIndex);
  const pastDelta = activePastDays * baseDailyAllowance - pastSpent;
  // Raw daily allowance from salary config
  const configDailyAllowance = mode === 'redistribute'
    ? floorMoney((spendableLivingPool - pastSpent) / remainingDays)
    : floorMoney(Math.min(baseDailyAllowance, (spendableLivingPool - pastSpent) / remainingDays));
  // Actual wallet balance (excluding savings wallets)
  const walletTotal = accounts ? accounts.filter(a => a.type !== 'savings').reduce((s, a) => s + a.balance, 0) : Infinity;
  const walletLimit = walletTotal; // raw balance - no reservation subtraction here
  // If wallet is tighter than budget config, spread wallet evenly over remaining days
  const walletDailyLimit = walletTotal < Infinity && walletTotal < spendableLivingPool - livingSpent
    ? floorMoney((walletTotal + todaySpent) / remainingDays)
    : Infinity;
  const todayAllowance = Math.min(configDailyAllowance, walletDailyLimit);
  const todayDelta = Math.floor(todayAllowance - todaySpent);
  const futureDaysCount = remainingDays - 1;
  const futureRemainingCap = walletTotal < spendableLivingPool - livingSpent
    ? floorMoney(walletTotal - Math.max(0, todayAllowance - todaySpent))
    : remainingLivingBudget;
  const futureDailyAllowance = futureAllowance(mode, Math.min(remainingLivingBudget, futureRemainingCap), futureDaysCount, baseDailyAllowance);
  const status = todayDelta < 0 ? 'overspent' : todaySpent >= todayAllowance * .8 ? 'caution' : 'safe';
  const days: CalendarDaySummary[] = Array.from({ length: totalCycleDays }, (_, i) => {
    const spent = spentOn(i);
    const hasActivity = current.some(t => t.cycleDayIndex === i);
    // Past days before user started or with no recorded activity = untracked, show neutral "-" not fake surplus
    const isUntrackedPast = i < todayIndex && (i < cycleStartDayIndex || !hasActivity);
    const allowance = isUntrackedPast
      ? 0
      : i < todayIndex ? baseDailyAllowance : i === todayIndex ? todayAllowance : futureDailyAllowance;
    const delta = isUntrackedPast ? 0 : Math.floor(allowance - spent);
    const phase = i < todayIndex ? (isUntrackedPast ? 'untracked' as const : 'past' as const) : i === todayIndex ? 'today' as const : 'future' as const;
    return { dayIndex: i, ...getCycleDateInfo(i, config.paydayDay), phase, allowance, spent, delta, status: i > todayIndex ? 'future' : delta < 0 ? 'overspent' : 'safe', transactions: current.filter(t => t.cycleDayIndex === i) };
  });
  return { totalLivingBudget, plannedReserveTotal, spendableLivingPool, totalSpentCycle, remainingLivingBudget, todayAllowance, todaySpent, todayDelta, todayStatus: status, futureDaysCount, futureDailyAllowance, redistributionPerDay: futureDailyAllowance - baseDailyAllowance, pastSafeSurplusTotal: Math.max(0, pastDelta), days, baseDailyAllowance, rolloverMode: mode, pastSpent, walletLimit };
}
function futureAllowance(mode: RolloverMode, remaining: number, days: number, baseline: number) {
  if (days <= 0) return 0;
  const perDay = floorMoney(remaining / days);
  return mode === 'strict' ? Math.min(baseline, perDay) : perDay;
}
export function previewPaymentImpact(metrics: CycleBudgetMetrics, amount: number) {
  const amt = floorMoney(Number(amount) || 0);
  const afterTodayDelta = metrics.todayDelta - amt;
  const afterRemainingLiving = floorMoney(metrics.remainingLivingBudget - amt);
  const newFutureDailyAllowance = futureAllowance(metrics.rolloverMode, afterRemainingLiving, metrics.futureDaysCount, metrics.baseDailyAllowance);
  return { afterTodayDelta, willOverspendToday: afterTodayDelta < 0, newFutureDailyAllowance, dailyChangeFromNow: newFutureDailyAllowance - metrics.futureDailyAllowance, afterRemainingLiving, lifeDaysCost: Number((amt / Math.max(1, metrics.todayAllowance)).toFixed(1)) };
}
