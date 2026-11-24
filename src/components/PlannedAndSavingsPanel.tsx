import React, { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import {
  Account,
  CategoryId,
  CycleBudgetMetrics,
  PlannedExpense,
  SavingsGoal,
} from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface PlannedAndSavingsPanelProps {
  metrics: CycleBudgetMetrics;
  plannedExpenses: PlannedExpense[];
  accounts: Account[];
  goals?: SavingsGoal[];
  onAddPlanned: (payload: {
    title: string;
    amount: number;
    category: CategoryId;
    dueDateLabel: string;
  }) => Promise<boolean>;
  onCompletePlanned: (plan: PlannedExpense, accountId: string) => Promise<boolean>;
  onSweepSurplus?: (amount: number, goalId: string | null) => void;
}

export const PlannedAndSavingsPanel: React.FC<PlannedAndSavingsPanelProps> = ({
  metrics,
  plannedExpenses,
  accounts,
  onAddPlanned,
  onCompletePlanned,
}) => {
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState(accounts.find(a => a.type !== 'savings')?.id || '');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDateLabel, setDueDateLabel] = useState('');
  const [category, setCategory] = useState<CategoryId>('living');

  const activePlanned = plannedExpenses.filter((p) => !p.completed);

  const formatDateValue = (iso: string) => {
    if (!iso) return 'Cuối kỳ';
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = parseNumberWithDots(amount);
    if (!title.trim() || numericAmt <= 0) return;
    if (saving) return;
    setSaving(true);
    const ok = await onAddPlanned({
      title: title.trim(),
      amount: numericAmt,
      category,
      dueDateLabel: formatDateValue(dueDateLabel.trim()),
    });
    setSaving(false);
    if (!ok) return;
    setTitle('');
    setAmount('');
    setDueDateLabel('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* UPCOMING PLANNED EXPENSES RADAR */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
              Chi tiêu dự kiến sắp tới
            </h3>
            <p className="text-xs text-[var(--ink-muted)] tabular-nums">
              Đã dành {formatVND(metrics.plannedReserveTotal)} khỏi ngân sách có thể chi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="text-xs font-semibold text-[var(--ink-primary)] flex items-center gap-1 underline underline-offset-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </div>

        {isAddOpen && (
          <form
            onSubmit={handleSubmit}
            className="p-3 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] space-y-2.5 animate-page-enter"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Sinh nhật bạn, Thay nhớt xe..."
              className="app-input bg-[var(--tone-white)]!"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatNumberWithDots(e.target.value))}
                placeholder="Số tiền (đ)"
                className="app-input bg-[var(--tone-white)]! font-semibold tabular-nums"
              />
              <input
                type="date"
                aria-label="Chọn ngày dự kiến"
                value={dueDateLabel}
                onChange={(e) => setDueDateLabel(e.target.value)}
                className="app-input bg-[var(--tone-white)]! tabular-nums"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
              className="app-input bg-[var(--tone-white)]!"
            >
              {Object.values(CATEGORIES).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="tap-scale w-full h-11 rounded-xl bg-[var(--brand)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
            >
              Dành ngân sách
            </button>
          </form>
        )}

        {activePlanned.length > 0 && <label className="helper-text block">Ví thanh toán<select aria-label="Ví thanh toán khoản dự kiến" className="app-input mt-2" value={sourceId} onChange={e => setSourceId(e.target.value)}>{accounts.filter(a => a.type !== 'savings').map(a => <option key={a.id} value={a.id}>{a.name}: {formatVND(a.balance)}</option>)}</select></label>}
        {activePlanned.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">
            Thêm khoản phát sinh ngoài chi phí cố định tháng để dành ngân sách trước.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {activePlanned.map((plan) => (
              <div
                key={plan.id}
                className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--ink-primary)] truncate">{plan.title}</p>
                  <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                    Dự kiến {plan.dueDateLabel} / {formatVND(plan.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCompletePlanned(plan, sourceId)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-paper)] hover:bg-[var(--ink-primary)] hover:text-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] flex items-center gap-1 transition shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} />
                  <span>Đã chi</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
