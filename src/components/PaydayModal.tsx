import React, { useEffect, useState } from 'react';
import { CalendarCheck, X } from 'lucide-react';
import { Account, SalaryConfig } from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface PaydayModalProps {
  isOpen: boolean;
  accounts: Account[];
  salaryConfig: SalaryConfig;
  cycleKey: string;
  onClose: () => void;
  onConfirm: (payload: {
    accountId: string;
    depositAmount: number;
    savingsTarget: number;
    fixedBills: number;
    paydayDay: number;
    cycleKey: string;
    todayIndex: number;
    totalCycleDays: number;
  }) => Promise<boolean>;
}

export const PaydayModal: React.FC<PaydayModalProps> = ({
  isOpen,
  accounts,
  salaryConfig,
  cycleKey,
  onClose,
  onConfirm,
}) => {
  const spendingWallets = accounts.filter((a) => a.type !== 'savings');
  const [accountId, setAccountId] = useState(
    spendingWallets.find((a) => a.type === 'checking')?.id || spendingWallets[0]?.id || ''
  );
  const [deposit, setDeposit] = useState(
    salaryConfig.monthlyIncome > 0 ? formatNumberWithDots(salaryConfig.monthlyIncome) : ''
  );
  const [savings, setSavings] = useState(
    salaryConfig.savingsTarget > 0 ? formatNumberWithDots(salaryConfig.savingsTarget) : ''
  );
  const [fixed, setFixed] = useState(
    salaryConfig.fixedBills > 0 ? formatNumberWithDots(salaryConfig.fixedBills) : ''
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccountId(
        spendingWallets.find((a) => a.type === 'checking')?.id || spendingWallets[0]?.id || ''
      );
      if (salaryConfig.monthlyIncome > 0) {
        setDeposit(formatNumberWithDots(salaryConfig.monthlyIncome));
      }
      if (salaryConfig.savingsTarget > 0) {
        setSavings(formatNumberWithDots(salaryConfig.savingsTarget));
      }
      if (salaryConfig.fixedBills > 0) {
        setFixed(formatNumberWithDots(salaryConfig.fixedBills));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const depositNum = parseNumberWithDots(deposit);
  const savingsNum = parseNumberWithDots(savings);
  const fixedNum = parseNumberWithDots(fixed);
  const livingPool = Math.max(0, depositNum - savingsNum - fixedNum);
  const remainingDays = Math.max(1, salaryConfig.totalCycleDays - salaryConfig.todayIndex);
  const dailyPreview = Math.floor(livingPool / remainingDays);
  const invalidBudget = savingsNum + fixedNum > depositNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositNum <= 0 || !accountId || invalidBudget || saving) return;
    setSaving(true);
    const ok = await onConfirm({
      accountId,
      depositAmount: depositNum,
      savingsTarget: savingsNum,
      fixedBills: fixedNum,
      paydayDay: salaryConfig.paydayDay,
      cycleKey,
      todayIndex: salaryConfig.todayIndex,
      totalCycleDays: salaryConfig.totalCycleDays,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đã đến ngày nhận lương"
      className="fixed inset-0 z-50 bg-[var(--ink-primary)]/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-backdrop"
    >
      <div className="w-full max-w-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-sheet-up max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-light)] border border-[var(--color-bbf7d0)] text-[var(--brand)] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
                Đã đến ngày nhận lương!
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Nạp tiền & đặt hạn mức cho chu kỳ {remainingDays} ngày
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {spendingWallets.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="payday-wallet">
                Nạp lương vào ví
              </label>
              <select
                id="payday-wallet"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="app-input"
              >
                {spendingWallets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · Hiện có {formatVND(a.balance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
              Số tiền lương nạp vào Ví An (VND) *
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                placeholder="7.000.000"
                value={deposit}
                onChange={(e) => setDeposit(formatNumberWithDots(e.target.value))}
                className="app-input pr-8 font-semibold text-base tabular-nums"
                autoFocus
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                Muốn tiết kiệm
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2.000.000"
                  value={savings}
                  onChange={(e) => setSavings(formatNumberWithDots(e.target.value))}
                  className="app-input pr-7 font-semibold tabular-nums"
                />
                <span className="absolute right-2.5 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                Chi cố định
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={fixed}
                  onChange={(e) => setFixed(formatNumberWithDots(e.target.value))}
                  className="app-input pr-7 font-semibold tabular-nums"
                />
                <span className="absolute right-2.5 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
            </div>
          </div>

          {depositNum > 0 && (
            <div className="bg-[var(--brand-light)] border border-[var(--color-bbf7d0)] rounded-xl p-3 text-xs text-[var(--brand)] tabular-nums space-y-1">
              <div className="flex justify-between">
                <span>Ngân sách sinh hoạt</span>
                <span className="font-semibold">{formatVND(livingPool)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Hạn mức mỗi ngày</span>
                <span>
                  {formatVND(dailyPreview)}/ngày × {remainingDays} ngày
                </span>
              </div>
            </div>
          )}

          {invalidBudget && (
            <p className="text-xs text-[var(--tone-danger)] font-medium">
              Tiết kiệm và chi cố định không được vượt quá số tiền nạp.
            </p>
          )}

          <button
            type="submit"
            disabled={saving || depositNum <= 0 || invalidBudget}
            className="tap-scale w-full py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold transition cursor-pointer disabled:opacity-40"
          >
            {saving ? 'Đang cập nhật…' : 'Xác nhận nạp lương & chia hạn mức'}
          </button>
        </form>
      </div>
    </div>
  );
};
