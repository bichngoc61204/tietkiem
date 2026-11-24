import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { SharedGroup } from '../types/finance';
import { formatVND } from '../utils/format';

interface SharedGroupViewProps {
  group: SharedGroup;
  onAddExpense: (payload: {
    title: string;
    amount: number;
    paidBy: 'ngoc' | 'minh';
    splitMode: '50/50' | '60/40';
  }) => void;
  onSettleBalance: (payer: 'ngoc' | 'minh', amount: number) => void;
}

export const SharedGroupView: React.FC<SharedGroupViewProps> = ({
  group,
  onAddExpense,
  onSettleBalance,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<'ngoc' | 'minh'>('minh');
  const [splitMode, setSplitMode] = useState<'50/50' | '60/40'>('50/50');

  const metrics = useMemo(() => {
    let ngocPaid = 0;
    let minhPaid = 0;
    let ngocResponsibility = 0;

    group.expenses.forEach((exp) => {
      if (exp.paidBy === 'ngoc') ngocPaid += exp.amount;
      if (exp.paidBy === 'minh') minhPaid += exp.amount;
      ngocResponsibility += exp.amount * exp.ngocShareRatio;
    });

    const totalSpent = ngocPaid + minhPaid;
    const remaining = Math.max(0, group.monthlyBudget - totalSpent);
    const netNgoc = Math.round(ngocPaid - ngocResponsibility);
    const usedRatio =
      group.monthlyBudget > 0 ? Math.min(100, Math.round((totalSpent / group.monthlyBudget) * 100)) : 0;

    return { ngocPaid, minhPaid, totalSpent, remaining, netNgoc, usedRatio };
  }, [group]);

  const sharedGoalPct =
    group.sharedGoal.target > 0
      ? Math.min(100, Math.round((group.sharedGoal.saved / group.sharedGoal.target) * 100))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = Number(amount) || 0;
    if (!title.trim() || numericAmt <= 0) return;

    onAddExpense({
      title: title.trim(),
      amount: numericAmt,
      paidBy,
      splitMode,
    });

    setTitle('');
    setAmount('');
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Group Budget Card */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[var(--ink-muted)]">{group.typeLabel}</p>
            <h2 className="text-[15px] font-semibold text-[var(--ink-primary)]">{group.name}</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Thêm khoản chi</span>
          </button>
        </div>

        <div className="space-y-1.5 tabular-nums">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-[var(--ink-muted)]">
              Đã chi {formatVND(metrics.totalSpent)} / {formatVND(group.monthlyBudget)}
            </span>
            <span className="font-semibold text-[var(--brand)]">
              Còn {formatVND(metrics.remaining)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand)] transition-[color,background-color,border-color,opacity,transform] duration-300"
              style={{ width: `${metrics.usedRatio}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-xl py-3">
          <div className="px-3">
            <p className="text-xs text-[var(--ink-muted)]">Ngọc đã chi</p>
            <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums mt-0.5">
              {formatVND(metrics.ngocPaid)}
            </p>
          </div>
          <div className="px-3">
            <p className="text-xs text-[var(--ink-muted)]">Minh đã chi</p>
            <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums mt-0.5">
              {formatVND(metrics.minhPaid)}
            </p>
          </div>
        </div>

        {isFormOpen && (
          <form onSubmit={handleSubmit} className="pt-3 border-t border-[var(--border-hairline)] space-y-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nội dung chi tiêu chung (VD: Tiền siêu thị...)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Số tiền"
                className="px-2.5 py-2 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold tabular-nums"
              />
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value as 'ngoc' | 'minh')}
                className="px-2 py-2 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-medium"
              >
                <option value="ngoc">Ngọc trả</option>
                <option value="minh">Minh trả</option>
              </select>
              <select
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as '50/50' | '60/40')}
                className="px-2 py-2 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-medium"
              >
                <option value="50/50">Chia đôi 50/50</option>
                <option value="60/40">Tỷ lệ 60/40</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
            >
              Lưu khoản chi chung
            </button>
          </form>
        )}
      </section>

      {/* Settlement Callout */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2.5">
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Tất toán cân bằng</h3>
        {metrics.netNgoc === 0 ? (
          <p className="text-xs text-[var(--brand)] font-medium">
            Hai bạn đã đóng góp cân bằng hoàn toàn. Không cần chuyển bù thêm.
          </p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-[var(--ink-primary)] tabular-nums">
              {metrics.netNgoc > 0 ? (
                <>
                  Minh cần chuyển lại cho Ngọc{' '}
                  <span className="font-semibold">{formatVND(Math.abs(metrics.netNgoc))}</span> để cân
                  bằng phần chi chung.
                </>
              ) : (
                <>
                  Ngọc cần chuyển lại cho Minh{' '}
                  <span className="font-semibold">{formatVND(Math.abs(metrics.netNgoc))}</span> để cân
                  bằng phần chi chung.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() =>
                onSettleBalance(
                  metrics.netNgoc > 0 ? 'minh' : 'ngoc',
                  Math.abs(metrics.netNgoc)
                )
              }
              className="w-full py-2.5 rounded-xl bg-[var(--tone-white)] hover:bg-[var(--bg-paper)] border border-[var(--ink-primary)] text-xs font-semibold text-[var(--ink-primary)] transition cursor-pointer"
            >
              Đánh dấu đã tất toán
            </button>
          </>
        )}
      </section>

      {/* Shared Goal */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-semibold text-[var(--ink-primary)]">Mục tiêu chung: {group.sharedGoal.title}</h3>
          <span className="font-semibold text-[var(--brand)] tabular-nums">{sharedGoalPct}%</span>
        </div>
        <p className="text-xs text-[var(--ink-muted)] tabular-nums">
          {formatVND(group.sharedGoal.saved)} / {formatVND(group.sharedGoal.target)}
        </p>
        <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--brand)]" style={{ width: `${sharedGoalPct}%` }} />
        </div>
      </section>

      {/* Activity Feed */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2.5">
        <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Hoạt động gần đây</h3>
        <ul className="divide-y divide-[var(--border-hairline)] text-xs text-[var(--ink-muted)]">
          {group.activities.map((act, idx) => (
            <li key={idx} className="py-2 first:pt-0 last:pb-0 leading-relaxed tabular-nums">
              {act}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
