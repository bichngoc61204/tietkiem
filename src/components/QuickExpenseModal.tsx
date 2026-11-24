import { useModal } from '../hooks/useModal';
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { Account, CategoryId, TransactionType } from '../types/finance';
import { getCycleDateInfo } from '../utils/budgetEngine';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface QuickExpenseModalProps {
  isOpen: boolean;
  defaultDayIndex: number;
  todayIndex: number;
  paydayDay: number;
  accounts: Account[];
  onClose: () => void;
  onSave: (payload: {
    merchant: string;
    amount: number;
    category: CategoryId;
    accountId: string;
    cycleDayIndex: number;
    type: TransactionType;
    budgetSource?: 'daily' | 'fixed';
  }) => Promise<boolean>;
}

export const QuickExpenseModal: React.FC<QuickExpenseModalProps> = ({
  isOpen,
  defaultDayIndex,
  todayIndex,
  paydayDay,
  accounts,
  onClose,
  onSave,
}) => {
  const modalRef = useModal(isOpen, onClose);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryId>('food');
  const [accountId, setAccountId] = useState('cash');
  const [dayIndex, setDayIndex] = useState(defaultDayIndex);
  const [budgetSource, setBudgetSource] = useState<'daily' | 'fixed'>('daily');
  const [txType, setTxType] = useState<TransactionType>('expense');

  useEffect(() => {
    if (isOpen) {
      setDayIndex(defaultDayIndex);
      setAccountId(accounts.find(a => a.type === 'cash')?.id || accounts.find(a => a.type !== 'savings')?.id || '');
    }
  }, [isOpen, defaultDayIndex]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseNumberWithDots(amount);
    if (!merchant.trim() || numericAmount <= 0) return;

    if (saving) return;
    setSaving(true);
    const ok = await onSave({
      merchant: merchant.trim(),
      amount: numericAmount,
      category,
      accountId,
      cycleDayIndex: dayIndex,
      type: txType,
      budgetSource: txType === 'expense' ? budgetSource : 'daily',
    });

    setSaving(false);
    if (!ok) return;
    setMerchant('');
    setAmount('');
    setTxType('expense');
    setBudgetSource('daily');
    onClose();
  };

  // Allow logging on today or past days of current cycle
  const selectableDays = Array.from({ length: todayIndex + 1 }, (_, i) => todayIndex - i);

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Ghi khoản chi" tabIndex={-1} className="fixed inset-0 z-50 bg-[var(--ink-primary)]/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-backdrop">
      <div className="w-full max-w-md bg-[var(--bg-paper)] border border-[var(--border-hairline)] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-sheet-up max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
            Ghi khoản chi
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Expense vs Loan Toggle */}
          <div className="grid grid-cols-2 gap-1 bg-[var(--tone-white)] border border-[var(--border-hairline)] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTxType('expense')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                txType === 'expense' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              Chi tiêu sinh hoạt
            </button>
            <button
              type="button"
              onClick={() => setTxType('loan')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                txType === 'loan' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              Cho mượn / Ứng trước
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="quickexpensemodal-1">
              Nội dung
            </label>
            <input id="quickexpensemodal-1"
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={
                txType === 'loan' ? 'VD: Cho Minh mượn tiền ăn trưa' : 'VD: Cơm sườn, Trà đá, Gửi xe...'
              }
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
              Số tiền (VND)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                aria-label="Số tiền chi (VND)"
                value={amount}
                onChange={(e) => setAmount(formatNumberWithDots(e.target.value))}
                placeholder="35.000"
                className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-base font-semibold tabular-nums"
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {[25000, 35000, 50000, 100000, 120000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(formatNumberWithDots(v))}
                  className="px-2.5 py-1 rounded-lg bg-[var(--tone-white)] border border-[var(--border-hairline)] hover:border-[var(--ink-primary)] text-xs font-medium tabular-nums cursor-pointer"
                >
                  {formatVND(v)}
                </button>
              ))}
            </div>
          </div>

          {txType === 'expense' && <label className="helper-text block" htmlFor="expense-budget-source">Khoản chi này thuộc<select id="expense-budget-source" className="app-input mt-2" value={budgetSource} onChange={e => setBudgetSource(e.target.value as 'daily' | 'fixed')}><option value="daily">Chi tiêu hằng ngày</option><option value="fixed">Chi phí cố định đã dự trù</option></select></label>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="quickexpensemodal-2">Ngày</label>
              <select id="quickexpensemodal-2"
                value={dayIndex}
                onChange={(e) => setDayIndex(Number(e.target.value))}
                className="w-full px-2 py-2 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-medium tabular-nums"
              >
                {selectableDays.map((idx) => {
                  const info = getCycleDateInfo(idx, paydayDay);
                  return (
                    <option key={idx} value={idx}>
                      {idx === todayIndex ? `Hôm nay (${info.dateLabel})` : info.dateLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="quickexpensemodal-3">Danh mục</label>
              <select id="quickexpensemodal-3"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryId)}
                className="w-full px-2 py-2 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-medium"
              >
                {Object.values(CATEGORIES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="quickexpensemodal-4">Nguồn tiền</label>
              <select id="quickexpensemodal-4"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-medium"
              >
                {accounts
                  .filter((a) => a.type !== 'savings')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {txType === 'loan' && (
            <p className="text-xs text-[var(--ink-muted)] bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-xl p-2.5">
              Khoản cho mượn được trừ ví, tách khỏi tổng chi tiêu và giảm ngân sách có thể chi trong kỳ.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[var(--ink-primary)] hover:bg-[var(--color-27272a)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
          >
            {saving ? 'Đang lưu…' : 'Lưu khoản chi'}
          </button>
        </form>
      </div>
    </div>
  );
};
