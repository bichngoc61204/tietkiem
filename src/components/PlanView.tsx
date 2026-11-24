import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../data/mockData';
import {
  Account,
  CategoryId,
  CycleBudgetMetrics,
  PausedItem,
  PlannedExpense,
  RolloverMode,
  SalaryConfig,
  SavingsGoal,
  Transaction,
} from '../types/finance';
import { transactionsInCycle } from '../utils/budgetEngine';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';
import { MealAdvisor } from './MealAdvisor';
import { PlannedAndSavingsPanel } from './PlannedAndSavingsPanel';
import { SpendingCalendar } from './SpendingCalendar';

interface PlanViewProps {
  metrics: CycleBudgetMetrics;
  salaryConfig: SalaryConfig;
  transactions: Transaction[];
  plannedExpenses: PlannedExpense[];
  accounts: Account[];
  rolloverMode?: RolloverMode;
  goals: SavingsGoal[];
  pausedItems: PausedItem[];
  avoidedImpulseTotal: number;
  initialSubTab?: 'calendar' | 'planned' | 'decide';
  onChangeRolloverMode?: (mode: RolloverMode) => void;
  onAddExpenseOnDay: (dayIndex: number) => void;
  onDeleteTransaction: (txId: string) => void;
  onAddPlanned: (payload: {
    title: string;
    amount: number;
    category: CategoryId;
    dueDateLabel: string;
  }) => Promise<boolean>;
  onCompletePlanned: (plan: PlannedExpense, accountId: string) => Promise<boolean>;
  onSweepSurplus: (amount: number, goalId: string | null) => void;
  onBuyWhatIfItem: (name: string, price: number, accountId?: string) => void;
  onPauseWhatIfItem: (name: string, price: number) => void;
  onSkipPausedItem: (item: PausedItem) => void;
  onAddGoal: (title: string, target: number) => Promise<boolean>;
  onDepositGoal: (goalId: string, amount: number, fromId: string) => Promise<boolean>;
}

export const PlanView: React.FC<PlanViewProps> = ({
  metrics,
  salaryConfig,
  transactions,
  plannedExpenses,
  accounts,
  goals,
  initialSubTab = 'calendar',
  onAddExpenseOnDay,
  onDeleteTransaction,
  onAddPlanned,
  onCompletePlanned,
  onSweepSurplus,
  onBuyWhatIfItem,
  onAddGoal,
  onDepositGoal,
}) => {
  const [subTab, setSubTab] = useState<'calendar' | 'planned' | 'decide'>(initialSubTab);

  useEffect(() => setSubTab(initialSubTab), [initialSubTab]);
  // Goals state
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState(accounts.find(a => a.type !== 'savings')?.id || '');
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('200000');

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(CATEGORIES).forEach((k) => {
      map[k] = 0;
    });
    transactionsInCycle(transactions, salaryConfig.paydayDay)
      .filter((tx) => tx.type === 'expense' && (tx.status === 'confirmed' || tx.status === 'pending'))
      .forEach((tx) => {
        if (map[tx.category] !== undefined) {
          map[tx.category] += tx.amount;
        }
      });

    return Object.values(CATEGORIES).map((cat) => {
      const spent = map[cat.id] || 0;
      const budget = Math.floor(metrics.spendableLivingPool * cat.budget / Object.values(CATEGORIES).reduce((sum, c) => sum + c.budget, 0));
      const ratio = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : spent > 0 ? 100 : 0;
      return { ...cat, budget, spent, ratio };
    });
  }, [transactions, salaryConfig.paydayDay, metrics.spendableLivingPool]);

  const todayTransactions = useMemo(
    () =>
      transactionsInCycle(transactions, salaryConfig.paydayDay).filter(
        (tx) =>
          tx.cycleDayIndex === salaryConfig.todayIndex &&
          tx.type === 'expense' &&
          (tx.status === 'confirmed' || tx.status === 'pending')
      ),
    [transactions, salaryConfig.todayIndex]
  );

  const insights = useMemo(() => {
    const cycleTxs = transactionsInCycle(transactions, salaryConfig.paydayDay);
    const totalIncomeExtra = cycleTxs
      .filter((tx) => tx.type === 'income' && tx.status === 'confirmed')
      .reduce((s, t) => s + t.amount, 0);
    const cycleStartDay = Math.min(salaryConfig.todayIndex, Math.max(0, salaryConfig.cycleStartDayIndex || 0));
    const activeDaysElapsed = Math.max(1, salaryConfig.todayIndex - cycleStartDay + 1);
    const remainingDays = Math.max(1, salaryConfig.totalCycleDays - salaryConfig.todayIndex);
    const avgDailySpend = Math.round(metrics.totalSpentCycle / activeDaysElapsed);
    const projectedEndBalance = Math.round(
      metrics.remainingLivingBudget - avgDailySpend * Math.max(0, remainingDays - 1)
    );
    let streak = 0;
    for (let i = salaryConfig.todayIndex; i >= cycleStartDay; i--) {
      const d = metrics.days[i];
      if (!d || d.status === 'overspent') break;
      if (d.phase === 'today' || d.phase === 'past') streak++;
    }
    const topCat = [...categoryTotals].sort((a, b) => b.spent - a.spent)[0];
    return { totalIncomeExtra, avgDailySpend, projectedEndBalance, streak, topCat };
  }, [transactions, salaryConfig, metrics, categoryTotals]);

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Pills: only Lịch & Phân tích (Tiết kiệm has its own main tab) */}
      {initialSubTab !== 'planned' && (
        <div className="grid grid-cols-2 gap-1 bg-[var(--tone-white)] border border-[var(--border-hairline)] p-1 rounded-2xl">
          {[
            { id: 'calendar', label: 'Lịch' },
            { id: 'decide', label: 'Phân tích' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as 'calendar' | 'decide')}
              className={`tap-scale h-9 px-2 rounded-xl text-xs font-semibold transition-[color,background-color,border-color,opacity,transform] duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center ${
                subTab === item.id
                  ? 'bg-[var(--brand)] text-[var(--tone-white)] shadow-xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* SUB-TAB 1: CALENDAR */}
      {subTab === 'calendar' && (
        <div key="tab-calendar" className="space-y-4 animate-page-enter">
          <SpendingCalendar
            metrics={metrics}
            todayIndex={salaryConfig.todayIndex}
            onAddExpenseOnDay={onAddExpenseOnDay}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      {/* SUB-TAB 2: PLANNED EXPENSES + GOALS */}
      {subTab === 'planned' && (
        <div key="tab-planned" className="space-y-4 animate-page-enter">


          <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Mục tiêu tiết kiệm</h2>
                <p className="text-xs text-[var(--brand)] font-medium mt-0.5">
                  Đã cất {formatVND(accounts.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGoalOpen(!isNewGoalOpen)}
                className="text-xs font-semibold text-[var(--ink-primary)] underline underline-offset-2 cursor-pointer"
              >
                + Thêm mục tiêu
              </button>
            </div>

            {isNewGoalOpen && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const targetAmt = parseNumberWithDots(newGoalTarget);
                  if (!newGoalTitle.trim() || targetAmt <= 0) return;
                  if (saving) return;
                  setSaving(true);
                  const ok = await onAddGoal(newGoalTitle.trim(), targetAmt);
                  setSaving(false);
                  if (!ok) return;
                  setNewGoalTitle('');
                  setNewGoalTarget('');
                  setIsNewGoalOpen(false);
                }}
                className="p-3 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] space-y-2.5 animate-page-enter"
              >
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="Tên mục tiêu (VD: Mua xe máy)"
                  className="app-input bg-[var(--tone-white)]!"
                />
                <input
                  type="text"
                  value={formatNumberWithDots(newGoalTarget)}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder="Số tiền cần (VD: 15.000.000)"
                  className="app-input bg-[var(--tone-white)]! tabular-nums font-semibold"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="tap-scale w-full h-11 rounded-xl bg-[var(--brand)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
                >
                  Lưu mục tiêu
                </button>
              </form>
            )}

            <p className="helper-text">Góp mục tiêu là chuyển tiền giữa các ví trong sổ. Bạn tự chuyển tiền thực tế tại ngân hàng.</p>
            {goals.length === 0 && <div className="empty-goals"><p>Bạn đang để dành cho điều gì?</p><span>Thêm một mục tiêu và góp từng khoản nhỏ.</span></div>}
            <div className="space-y-3">
              {goals.map((goal) => {
                const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
                return (
                  <div
                    key={goal.id}
                    className="p-3.5 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">{goal.title}</h3>
                        <p className="text-xs text-[var(--ink-muted)] tabular-nums mt-0.5">
                          {formatVND(goal.saved)} / {formatVND(goal.target)} / {pct}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDepositGoalId(depositGoalId === goal.id ? null : goal.id)
                        }
                        className="text-xs font-semibold text-[var(--ink-primary)] underline underline-offset-2 cursor-pointer"
                      >
                        Góp tiền
                      </button>
                    </div>

                    <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand)] transition-[color,background-color,border-color,opacity,transform] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {depositGoalId === goal.id && (
                      <div className="pt-2.5 border-t border-[var(--border-hairline)] grid grid-cols-1 gap-2">
                        <label className="helper-text" htmlFor={`goal-source-${goal.id}`}>Chuyển từ ví</label>
                        <select id={`goal-source-${goal.id}`} className="app-input" value={sourceId} onChange={e => setSourceId(e.target.value)}>{accounts.filter(a => a.type !== 'savings').map(a => <option key={a.id} value={a.id}>{a.name}: {formatVND(a.balance)}</option>)}</select>
                        <input
                          aria-label="Số tiền góp mục tiêu"
                          inputMode="numeric"
                          type="text"
                          value={formatNumberWithDots(depositAmount)}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="Số tiền nạp"
                          className="app-input bg-[var(--tone-white)]! flex-1 font-semibold tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={async () => {
                            const amt = parseNumberWithDots(depositAmount);
                            if (amt <= 0) return;
                            if (saving) return;
                            setSaving(true);
                            const ok = await onDepositGoal(goal.id, amt, sourceId);
                            setSaving(false);
                            if (ok) setDepositGoalId(null);
                          }}
                          className="tap-scale h-11 px-4 rounded-xl bg-[var(--brand)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Xác nhận
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <PlannedAndSavingsPanel
            metrics={metrics}
            plannedExpenses={plannedExpenses}
            accounts={accounts}
            goals={goals}
            onAddPlanned={onAddPlanned}
            onCompletePlanned={onCompletePlanned}
            onSweepSurplus={onSweepSurplus}
          />
        </div>
      )}

      {/* SUB-TAB 3: PHÂN TÍCH DÒNG TIỀN, THỰC ĐƠN & DANH MỤC */}
      {subTab === 'decide' && (
        <div key="tab-decide" className="space-y-4 animate-page-enter">
          {/* Tổng quan dòng tiền & Dự báo chu kỳ */}
          <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap">
                Phân tích thu chi
              </h2>
              <span className="text-xs font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-2.5 py-0.5 rounded-full border border-[var(--color-bbf7d0)] tabular-nums whitespace-nowrap shrink-0">
                {insights.streak} ngày xanh
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Thu nhập / Nạp kỳ</p>
                <p className="text-sm font-semibold text-[var(--brand)] tabular-nums mt-0.5">
                  +{formatVND(Math.max(salaryConfig.monthlyIncome, insights.totalIncomeExtra))}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Đã chi trong kỳ</p>
                <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums mt-0.5">
                  -{formatVND(metrics.totalSpentCycle)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Chi TB / ngày</p>
                <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums mt-0.5">
                  {formatVND(insights.avgDailySpend)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Dự báo cuối kỳ</p>
                <p className={`text-sm font-semibold tabular-nums mt-0.5 ${insights.projectedEndBalance >= 0 ? 'text-[var(--brand)]' : 'text-[var(--tone-danger)]'}`}>
                  {insights.projectedEndBalance >= 0
                    ? `Dư ${formatVND(insights.projectedEndBalance)}`
                    : `Thiếu ${formatVND(Math.abs(insights.projectedEndBalance))}`}
                </p>
              </div>
            </div>

            {insights.topCat && insights.topCat.spent > 0 && (
              <p className="text-xs text-[var(--ink-muted)] bg-[var(--bg-paper)] rounded-xl px-3 py-2 leading-relaxed">
                Nhóm chi nhiều nhất kỳ này là <strong className="text-[var(--ink-primary)]">{insights.topCat.label}</strong> ({formatVND(insights.topCat.spent)}).
              </p>
            )}
          </section>

          {/* Gợi ý món ăn sáng / trưa / tối theo ngân sách */}
          <MealAdvisor
            todayAllowance={Math.max(0, metrics.todayDelta)}
            todayTransactions={todayTransactions}
            accounts={accounts}
            onSelectMeal={(name, price, accountId) => onBuyWhatIfItem(name, price, accountId)}
          />

          {/* Phân bổ theo danh mục */}
          <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Phân bổ theo danh mục</h2>
            <div className="space-y-3">
              {categoryTotals.map((cat) => {
                const isOver = cat.spent > cat.budget;
                const isNear = !isOver && cat.ratio >= 80;
                const barHex = isOver ? 'var(--tone-danger)' : isNear ? 'var(--tone-caution)' : 'var(--brand)';
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[var(--ink-primary)]">{cat.label}</span>
                      <span className="tabular-nums text-[var(--ink-muted)]">
                        <span className="font-semibold text-[var(--ink-primary)]">
                          {formatVND(cat.spent)}
                        </span>{' '}
                        / {formatVND(cat.budget)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
                      <div
                        className="h-full transition-[color,background-color,border-color,opacity,transform] duration-300"
                        style={{ width: `${cat.ratio}%`, backgroundColor: barHex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
