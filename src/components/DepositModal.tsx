import { useModal } from '../hooks/useModal';
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Account } from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface DepositModalProps {
  isOpen: boolean;
  accounts: Account[];
  onClose: () => void;
  onDeposit: (accountId: string, amount: number) => Promise<boolean>;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  accounts,
  onClose,
  onDeposit,
}) => {
  const [selectedAccount, setSelectedAccount] = useState(
    accounts.find((a) => a.type === 'checking')?.id || accounts[0]?.id || ''
  );
  const modalRef = useModal(isOpen, onClose);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (isOpen) setSelectedAccount(accounts.find(a => a.type === 'checking')?.id || accounts.find(a => a.type === 'cash')?.id || ''); }, [isOpen, accounts]);
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  const amountNum = parseNumberWithDots(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0 || !selectedAccount) return;
    if (saving) return;
    setSaving(true);
    const ok = await onDeposit(selectedAccount, amountNum);
    setSaving(false);
    if (!ok) return;
    setAmount('');
    onClose();
  };

  const spendingWallets = accounts.filter(a => a.type !== 'savings');

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Nạp tiền vào Ví An" tabIndex={-1} className="fixed inset-0 z-50 bg-[var(--ink-primary)]/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-backdrop">
      <div className="w-full max-w-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-sheet-up max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Nạp tiền vào Ví An</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {spendingWallets.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="depositmodal-1">Chọn ví</label>
              <select id="depositmodal-1"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="app-input font-semibold"
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
              Số tiền nạp vào Ví An (VND)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric" placeholder="0"
                aria-label="Tiền thực nhận (VND)"
                value={amount}
                onChange={(e) => setAmount(formatNumberWithDots(e.target.value))}
                className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-lg font-semibold text-[var(--ink-primary)] tabular-nums"
                autoFocus
              />
              <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                đ
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {[500000, 1000000, 2000000, 5000000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(formatNumberWithDots(v))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums border transition cursor-pointer ${
                    amountNum === v
                      ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]'
                      : 'bg-[var(--tone-white)] text-[var(--ink-muted)] border-[var(--border-hairline)] hover:border-[var(--ink-primary)]'
                  }`}
                >
                  {formatVND(v)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || amountNum <= 0}
            className="w-full py-3 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Đang lưu…' : 'Ghi nhận'} {amountNum > 0 ? formatVND(amountNum) : '0 đ'} vào {accounts.find((a) => a.id === selectedAccount)?.name || 'ví'}
          </button>
        </form>
      </div>
    </div>
  );
};
