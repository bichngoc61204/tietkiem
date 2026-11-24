import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { currentSalaryConfig } from '../utils/cycle';
import { SalaryConfig } from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface OnboardingSetupProps {
  backupAvailable?: boolean;
  onRestore?: () => Promise<boolean>;
  onComplete: (config: {
    salaryConfig: SalaryConfig;
    wallets: { id: string; name: string; balance: number; type: 'checking' | 'cash' | 'savings' }[];
  }) => Promise<boolean>;
}

const BANK_OPTIONS = [
  { id: 'mbbank', name: 'MB Bank' },
  { id: 'vcb', name: 'Vietcombank' },
  { id: 'tcb', name: 'Techcombank' },
  { id: 'tpb', name: 'TPBank' },
  { id: 'acb', name: 'ACB' },
  { id: 'bidv', name: 'BIDV' },
  { id: 'vtb', name: 'VietinBank' },
  { id: 'scb', name: 'Sacombank' },
];

export const OnboardingSetup: React.FC<OnboardingSetupProps> = ({ onComplete }) => {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Income info
  const [income, setIncome] = useState('');
  const [payday, setPayday] = useState('5');
  const [fixedBills, setFixedBills] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');

  // Step 2: Wallets
  const [selectedBanks, setSelectedBanks] = useState<string[]>(['mbbank']);
  const [useCash, setUseCash] = useState(true);
  const [initialBalance, setInitialBalance] = useState('');

  const incomeNum = parseNumberWithDots(income);
  const fixedNum = parseNumberWithDots(fixedBills);
  const savingsNum = parseNumberWithDots(savingsTarget);
  const livingBudget = Math.max(0, incomeNum - fixedNum - savingsNum);

  const handleStep1Next = () => {
    if (incomeNum <= 0 || fixedNum + savingsNum > incomeNum) return;
    setStep(2);
  };

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    const balanceNum = parseNumberWithDots(initialBalance);

    const wallets: { id: string; name: string; balance: number; type: 'checking' | 'cash' | 'savings' }[] = [];

    selectedBanks.forEach((bankId, i) => {
      const bank = BANK_OPTIONS.find((b) => b.id === bankId);
      if (bank) {
        wallets.push({
          id: bankId,
          name: bank.name,
          balance: i === 0 ? balanceNum : 0, // initial balance goes to first selected bank
          type: 'checking',
        });
      }
    });

    if (useCash) {
      wallets.push({ id: 'cash', name: 'Tiền mặt', balance: selectedBanks.length === 0 ? balanceNum : 0, type: 'cash' });
    }

    wallets.push({ id: 'savings', name: 'Tiết kiệm', balance: 0, type: 'savings' });

    const paydayNum = Number(payday) || 5;
    await onComplete({
      salaryConfig: currentSalaryConfig({
        monthlyIncome: incomeNum,
        paydayDay: paydayNum,
        fixedBills: fixedNum,
        savingsTarget: savingsNum,
        totalCycleDays: 30,
        todayIndex: 0,
      }),
      wallets,
    });
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--brand)] flex items-center justify-center">
            <Wallet className="w-6 h-6 text-[var(--tone-white)]" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-semibold text-[var(--ink-primary)]">Thiết lập Ví An</h1>
          <p className="text-xs text-[var(--ink-muted)]">
            {step === 1 ? 'Nhập thu nhập để bắt đầu quản lý chi tiêu' : 'Chọn ví và số dư hiện tại'}
          </p>
        </div>

        {/* Progress */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className={`h-1 rounded-full ${step >= 1 ? 'bg-[var(--brand)]' : 'bg-[var(--border-hairline)]'}`} />
          <div className={`h-1 rounded-full ${step >= 2 ? 'bg-[var(--brand)]' : 'bg-[var(--border-hairline)]'}`} />
        </div>

        {/* Step 1: Income */}
        {step === 1 && (
          <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
                Lương hàng tháng (VND) *
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric" placeholder="10.000.000"
                  aria-label="Lương hàng tháng (VND)"
                value={income}
                  onChange={(e) => setIncome(formatNumberWithDots(e.target.value))}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-base font-semibold text-[var(--ink-primary)] tabular-nums"
                  autoFocus
                />
                <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
              {incomeNum > 0 && (
                <p className="text-xs text-[var(--ink-muted)] mt-1 tabular-nums">
                  = {formatVND(incomeNum)}/tháng
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5" htmlFor="onboardingsetup-1">
                Ngày nhận lương
              </label>
              <select id="onboardingsetup-1"
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)]"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Ngày {d} hàng tháng
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
                Chi phí cố định / tháng
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="3.600.000 (thuê nhà, điện nước...)"
                  value={fixedBills}
                  onChange={(e) => setFixedBills(formatNumberWithDots(e.target.value))}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
                />
                <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
                Mục tiêu tiết kiệm / tháng
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="2.000.000"
                  value={savingsTarget}
                  onChange={(e) => setSavingsTarget(formatNumberWithDots(e.target.value))}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
                />
                <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
            </div>

            {incomeNum > 0 && (
              <div className="bg-[var(--brand-light)] border border-[var(--color-bbf7d0)] rounded-xl p-3 text-xs text-[var(--brand)] tabular-nums space-y-1">
                <div className="flex justify-between">
                  <span>Lương</span>
                  <span className="font-semibold">{formatVND(incomeNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span> đến  Cố định</span>
                  <span>{formatVND(fixedNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span> đến  Tiết kiệm</span>
                  <span>{formatVND(savingsNum)}</span>
                </div>
                <div className="border-t border-[var(--color-bbf7d0)] pt-1 flex justify-between font-semibold">
                  <span>= Ngân sách sinh hoạt</span>
                  <span>{formatVND(livingBudget)}</span>
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  ≈ {formatVND(Math.round(livingBudget / 30))}/ngày × 30 ngày
                </p>
              </div>
            )}

            {fixedNum + savingsNum > incomeNum && <p role="alert">Chi phí cố định và tiết kiệm đang vượt thu nhập.</p>}
            <button
              type="button"
              onClick={handleStep1Next}
              disabled={incomeNum <= 0 || fixedNum + savingsNum > incomeNum}
              className="w-full py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Tiếp tục</span>

            </button>
          </div>
        )}

        {/* Step 2: Wallets */}
        {step === 2 && (
          <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-2">
                Bạn dùng ngân hàng nào?
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {BANK_OPTIONS.map((bank) => {
                  const active = selectedBanks.includes(bank.id);
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() =>
                        setSelectedBanks((prev) =>
                          active ? prev.filter((b) => b !== bank.id) : [...prev, bank.id]
                        )
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        active
                          ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]'
                          : 'bg-[var(--bg-canvas)] text-[var(--ink-muted)] border-[var(--border-hairline)] hover:border-[var(--ink-primary)]'
                      }`}
                    >
                      {bank.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCash}
                onChange={(e) => setUseCash(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--brand)]"
              />
              <span className="text-xs font-semibold text-[var(--ink-primary)]">Có dùng tiền mặt</span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1.5">
                Số dư hiện tại trong ví chính (tùy chọn)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric" placeholder="0"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(formatNumberWithDots(e.target.value))}
                  className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
                />
                <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                  đ
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Số tiền này sẽ được gán vào {BANK_OPTIONS.find((b) => b.id === selectedBanks[0])?.name || 'ví đầu tiên'}.
                Bạn có thể chỉnh sau.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] cursor-pointer"
              >
                ← Quay lại
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving || (selectedBanks.length === 0 && !useCash)}
                className="flex-1 py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-sm font-semibold transition cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Đang lưu…' : 'Bắt đầu dùng'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
