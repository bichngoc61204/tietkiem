import React, { useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { currentSalaryConfig, getSalaryCycle } from '../utils/cycle';
import { SalaryConfig } from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface OnboardingSetupProps {
  onComplete: (config: {
    salaryConfig: SalaryConfig;
    wallets: { id: string; name: string; balance: number; type: 'checking' | 'cash' | 'savings' }[];
  }) => Promise<boolean>;
}

export const OnboardingSetup: React.FC<OnboardingSetupProps> = ({ onComplete }) => {
  const [saving, setSaving] = useState(false);

  const [income, setIncome] = useState('');
  const [payday, setPayday] = useState('5');
  const [fixedBills, setFixedBills] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');

  const incomeNum = parseNumberWithDots(income);
  const fixedNum = parseNumberWithDots(fixedBills);
  const savingsNum = parseNumberWithDots(savingsTarget);
  const livingBudget = Math.max(0, incomeNum - fixedNum - savingsNum);

  const paydayNum = Number(payday) || 5;
  const cyclePreview = useMemo(() => getSalaryCycle(paydayNum), [paydayNum]);
  const remainingDays = Math.max(1, cyclePreview.totalCycleDays - cyclePreview.todayIndex);
  const isPaydayToday = cyclePreview.todayIndex === 0;
  const nextPaydayLabel = `${String(cyclePreview.end.getDate()).padStart(2, '0')}/${String(cyclePreview.end.getMonth() + 1).padStart(2, '0')}`;

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || incomeNum <= 0 || fixedNum + savingsNum > incomeNum) return;
    setSaving(true);

    const resolvedConfig = currentSalaryConfig({
      monthlyIncome: incomeNum,
      paydayDay: paydayNum,
      fixedBills: fixedNum,
      savingsTarget: savingsNum,
      totalCycleDays: 30,
      todayIndex: 0,
    });

    await onComplete({
      salaryConfig: {
        ...resolvedConfig,
        cycleStartDayIndex: resolvedConfig.todayIndex,
      },
      wallets: [
        { id: 'vian', name: 'Ví An', balance: incomeNum, type: 'checking' },
        { id: 'savings', name: 'Tiết kiệm', balance: 0, type: 'savings' },
      ],
    });
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 animate-page-enter">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--brand)] flex items-center justify-center">
            <Wallet className="w-6 h-6 text-[var(--tone-white)]" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-semibold text-[var(--ink-primary)]">Thiết lập Ví An</h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Chọn ngày nhận lương & nạp ngân sách vào Ví An để bắt đầu
          </p>
        </div>

        <form onSubmit={handleFinish} className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5" htmlFor="onboardingsetup-1">
              Ngày nhận lương hàng tháng
            </label>
            <select
              id="onboardingsetup-1"
              value={payday}
              onChange={(e) => setPayday(e.target.value)}
              className="app-input font-semibold"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Ngày {d} hàng tháng
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--brand)] font-medium mt-1.5">
              {isPaydayToday
                ? `Hôm nay là ngày nhận lương! Chu kỳ mới ${cyclePreview.totalCycleDays} ngày.`
                : `Còn ${remainingDays} ngày nữa tới ngày nhận lương (${nextPaydayLabel}).`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
              {isPaydayToday
                ? 'Số tiền nạp vào Ví An kỳ này (VND) *'
                : `Số tiền nạp vào Ví An cho ${remainingDays} ngày tới (VND) *`}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                placeholder={isPaydayToday ? '7.000.000' : '400.000'}
                aria-label="Số tiền nạp vào Ví An (VND)"
                value={income}
                onChange={(e) => setIncome(formatNumberWithDots(e.target.value))}
                className="app-input pr-8 text-base font-semibold tabular-nums"
                autoFocus
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
            {incomeNum > 0 && (
              <p className="text-xs text-[var(--ink-muted)] mt-1 tabular-nums">
                = {formatVND(incomeNum)} {isPaydayToday ? '/ chu kỳ' : `cho ${remainingDays} ngày tới`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
              Bạn muốn tiết kiệm bao nhiêu?
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                placeholder={isPaydayToday ? '2.000.000' : '0'}
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(formatNumberWithDots(e.target.value))}
                className="app-input pr-8 font-semibold tabular-nums"
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
              Chi phí cố định dự trù (nếu có)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                placeholder="0 (thuê nhà, điện nước...)"
                value={fixedBills}
                onChange={(e) => setFixedBills(formatNumberWithDots(e.target.value))}
                className="app-input pr-8 font-semibold tabular-nums"
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
          </div>

          {incomeNum > 0 && (
            <div className="bg-[var(--brand-light)] border border-[var(--color-bbf7d0)] rounded-xl p-3 text-xs text-[var(--brand)] tabular-nums space-y-1">
              <div className="flex justify-between">
                <span>Tiền nạp vào Ví An</span>
                <span className="font-semibold">{formatVND(incomeNum)}</span>
              </div>
              <div className="flex justify-between">
                <span>- Tiết kiệm</span>
                <span>{formatVND(savingsNum)}</span>
              </div>
              {fixedNum > 0 && (
                <div className="flex justify-between">
                  <span>- Cố định</span>
                  <span>{formatVND(fixedNum)}</span>
                </div>
              )}
              <div className="border-t border-[var(--color-bbf7d0)] pt-1 flex justify-between font-semibold">
                <span>= Ngân sách sinh hoạt</span>
                <span>{formatVND(livingBudget)}</span>
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                ≈ {formatVND(Math.floor(livingBudget / remainingDays))}/ngày × {remainingDays} ngày
              </p>
            </div>
          )}

          {fixedNum + savingsNum > incomeNum && (
            <p role="alert" className="text-xs text-[var(--tone-danger)] font-medium">
              Chi phí cố định và tiết kiệm không được vượt quá số tiền nạp.
            </p>
          )}

          <button
            type="submit"
            disabled={saving || incomeNum <= 0 || fixedNum + savingsNum > incomeNum}
            className="tap-scale w-full py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Đang lưu…' : 'Bắt đầu dùng Ví An'}
          </button>
        </form>
      </div>
    </div>
  );
};
