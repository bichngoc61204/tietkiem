import { BANK_OPTIONS } from '../utils/vietqr';
import { useModal } from '../hooks/useModal';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Crown,
  KeyRound,
  LogOut,
  Plus,
  X,
} from 'lucide-react';
import {
  Account,
  LicenseKey,
  PlanType,
  RecurringBill,
  SalaryConfig,
  UserProfile,
} from '../types/finance';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';

interface AccountViewProps {
  profile: UserProfile;
  salaryConfig: SalaryConfig;
  accounts: Account[];
  recurringBills: RecurringBill[];
  licenseKeys: LicenseKey[];
  onUpdateSalaryConfig: (next: SalaryConfig) => void;
  onToggleBillPaid: (billId: string) => void;
  onAddWallet: (wallet: Account) => Promise<boolean>;
  onInternalTransfer: (fromId: string, toId: string, amount: number) => Promise<boolean>;
  onActivateLicense: (code: string) => Promise<void>;
  onGenerateLicenseKey: (plan: PlanType, durationDays: number, note: string) => Promise<void>;
  onResetTestData: () => Promise<boolean>;
  onRestoreTestData: () => Promise<boolean>;
  onSignOut: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  profile,
  salaryConfig,
  accounts,
  recurringBills,
  licenseKeys,
  onUpdateSalaryConfig,
  onToggleBillPaid,
  onInternalTransfer,
  onAddWallet,
  onActivateLicense,
  onGenerateLicenseKey,
  onSignOut,
}) => {
  const [addingWallet, setAddingWallet] = useState(false);
  const [walletKind, setWalletKind] = useState(BANK_OPTIONS[0].id);
  const [openingBalance, setOpeningBalance] = useState('');
  const [walletSaving, setWalletSaving] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const modalRef = useModal(isTransferOpen, () => setIsTransferOpen(false));
  const [fromId, setFromId] = useState(accounts.find(a => a.type !== 'savings')?.id || '');
  const [transferring, setTransferring] = useState(false);
  const [toId, setToId] = useState('savings');
  const [transferAmount, setTransferAmount] = useState('500000');

  const [licenseInput, setLicenseInput] = useState('');
  const [activating, setActivating] = useState(false);

  // Admin key generator state
  const [newKeyPlan, setNewKeyPlan] = useState<PlanType>('pro');
  const [newKeyNote, setNewKeyNote] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Sync local salary draft and debounce/save cleanly
  const [localSalary, setLocalSalary] = useState<SalaryConfig>(salaryConfig);
  useEffect(() => {
    setLocalSalary(salaryConfig);
  }, [salaryConfig.monthlyIncome, salaryConfig.fixedBills, salaryConfig.savingsTarget, salaryConfig.paydayDay]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNumberWithDots(transferAmount);
    if (amt <= 0 || fromId === toId) return;
    if (transferring) return;
    setTransferring(true);
    const ok = await onInternalTransfer(fromId, toId, amt);
    setTransferring(false);
    if (ok) setIsTransferOpen(false);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseInput.trim()) return;
    setActivating(true);
    try {
      await onActivateLicense(licenseInput);
      setLicenseInput('');
    } finally {
      setActivating(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = newKeyPlan === 'lifetime' ? 36500 : 365;
    await onGenerateLicenseKey(newKeyPlan, days, newKeyNote.trim() || 'Khách mua lẻ');
    setNewKeyNote('');
  };

  const copyCode = (code: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const planBadge =
    profile.role === 'admin'
      ? 'Admin / Trọn đời'
      : profile.plan === 'lifetime'
      ? 'Trọn đời'
      : profile.plan === 'pro'
      ? 'Gói Pro'
      : profile.plan === 'couple'
      ? 'Gói Couple'
      : 'Dùng thử 14 ngày';

  return (
    <div className="space-y-4">
      {/* Subscription & User Identity Card */}
      <section className="bg-[var(--brand-dark)] text-[var(--tone-white)] rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-10b981)]/15 border border-[var(--color-10b981)]/30 text-xs font-semibold text-[var(--color-6ee7b7)]">
              <Crown className="w-3 h-3" />
              <span>{planBadge}</span>
            </span>
            <h2 className="mt-2 text-base font-semibold">{profile.displayName}</h2>
            <p className="text-xs text-[var(--color-a1a1aa)]">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-1.5 rounded-xl bg-[var(--tone-white)]/10 hover:bg-[var(--tone-white)]/20 text-xs font-semibold text-[var(--tone-white)] flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Đăng xuất</span>
          </button>
        </div>

        {/* Activate License Key for Customers */}
        {profile.plan !== 'lifetime' && (
          <form onSubmit={handleActivate} className="pt-3 border-t border-[var(--tone-white)]/10 flex gap-2">
            <input
              type="text"
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              placeholder="Nhập mã kích hoạt (VD: VIAN-PRO-...)"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--tone-white)]/10 border border-[var(--tone-white)]/15 text-xs text-[var(--tone-white)] placeholder:text-[var(--color-a1a1aa)]"
            />
            <button
              type="submit"
              disabled={activating}
              className="px-3.5 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--color-15803d)] text-xs font-semibold text-[var(--tone-white)] shrink-0 cursor-pointer"
            >
              {activating ? 'Đang kiểm...' : 'Kích hoạt'}
            </button>
          </form>
        )}
      </section>

      {/* Multi-Account Wallets */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Ví của bạn</h2>
          <button
            type="button"
            onClick={() => setIsTransferOpen(true)}
            className="text-xs font-semibold text-[var(--ink-primary)] flex items-center gap-1 underline underline-offset-2 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Chuyển nội bộ</span>
          </button>
        </div>

        <button type="button" className="secondary-button" onClick={() => setAddingWallet(!addingWallet)}>Thêm ví</button>
        {addingWallet && <form className="space-y-3" onSubmit={async e => {
          e.preventDefault(); if (walletSaving) return;
          setWalletSaving(true);
          const bank = BANK_OPTIONS.find(b => b.id === walletKind);
          const ok = await onAddWallet({ id: walletKind, name: bank?.name || 'Tiền mặt', balance: parseNumberWithDots(openingBalance), type: walletKind === 'cash' ? 'cash' : 'checking' });
          setWalletSaving(false); if (ok) { setAddingWallet(false); setOpeningBalance(''); }
        }}>
          <label className="helper-text block" htmlFor="wallet-kind">Ngân hàng hoặc tiền mặt</label>
          <select id="wallet-kind" className="app-input" value={walletKind} onChange={e => setWalletKind(e.target.value)}>{[...BANK_OPTIONS, { id: 'cash', name: 'Tiền mặt' }].map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <label className="helper-text block" htmlFor="wallet-opening">Số dư hiện tại</label>
          <input id="wallet-opening" className="app-input" inputMode="numeric" placeholder="0" value={openingBalance} onChange={e => setOpeningBalance(formatNumberWithDots(e.target.value))} />
          <button className="secondary-button" disabled={walletSaving} type="submit">{walletSaving ? 'Đang lưu…' : 'Lưu ví'}</button>
        </form>}
        <div className="divide-y divide-[var(--border-hairline)]">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
            >
              <span className="font-medium text-[var(--ink-primary)]">{acc.name}</span>
              <span className="font-semibold text-[var(--ink-primary)] tabular-nums">
                {formatVND(acc.balance)}
              </span>
            </div>
          ))}
        </div>
      </section>


      {/* Salary Cycle Setup */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Ngân sách tháng</h2>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Cập nhật thu nhập & khoản cố định để tự động chia lại lịch chi tiêu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSalaryConfig(localSalary)}
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold shrink-0 cursor-pointer"
          >
            Lưu thay đổi
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-1">
              Thu nhập tháng (VND)
            </label>
            <input id="accountview-1"
              type="text"
              value={formatNumberWithDots(localSalary.monthlyIncome)}
              onChange={(e) =>
                setLocalSalary({ ...localSalary, monthlyIncome: parseNumberWithDots(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-2">
              Ngày nhận lương
            </label>
            <select id="accountview-2"
              value={localSalary.paydayDay}
              onChange={(e) =>
                setLocalSalary({ ...localSalary, paydayDay: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-medium"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Ngày {d} hàng tháng
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-3">
              Tiền cố định (nhà, điện...)
            </label>
            <input id="accountview-3"
              type="text"
              value={formatNumberWithDots(localSalary.fixedBills)}
              onChange={(e) =>
                setLocalSalary({ ...localSalary, fixedBills: parseNumberWithDots(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-4">
              Tiết kiệm mục tiêu tháng
            </label>
            <input id="accountview-4"
              type="text"
              value={formatNumberWithDots(localSalary.savingsTarget)}
              onChange={(e) =>
                setLocalSalary({ ...localSalary, savingsTarget: parseNumberWithDots(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Recurring Bills */}
      {recurringBills.length > 0 && <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2.5">
        <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Hóa đơn cố định hàng tháng</h2>
        <div className="divide-y divide-[var(--border-hairline)]">
          {recurringBills.map((bill) => (
            <div
              key={bill.id}
              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs"
            >
              <div>
                <p className="font-medium text-[var(--ink-primary)]">{bill.title}</p>
                <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                  Đến hạn ngày {bill.dueDay} / {formatVND(bill.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleBillPaid(bill.id)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  bill.paid
                    ? 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]'
                    : 'bg-[var(--bg-paper)] border-[var(--border-hairline)] text-[var(--ink-muted)]'
                }`}
              >
                {bill.paid && <Check className="w-3 h-3" strokeWidth={2} />}
                <span>{bill.paid ? 'Đã trả' : 'Chưa trả'}</span>
              </button>
            </div>
          ))}
        </div>
      </section>}

      {/* Privacy Note */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4">
        <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
          Ví An chỉ đọc mã VietQR và điều hướng sang app ngân hàng. Ứng dụng không giữ tiền, không
          yêu cầu mật khẩu hay mã OTP ngân hàng.
        </p>
      </section>

      {/* Admin License Generator (Only visible for hung@gmail.com / admin) */}
      {profile.role === 'admin' && (<details className="rounded-2xl border border-[var(--border-hairline)] p-4"><summary className="cursor-pointer font-semibold">Quản trị gói tài khoản</summary>
        <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[var(--brand)]" strokeWidth={1.75} />
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
                Tạo mã kích hoạt
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Tạo mã kích hoạt và theo dõi các gói đã cấp cho khách hàng.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateKey} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <select
              value={newKeyPlan}
              onChange={(e) => setNewKeyPlan(e.target.value as PlanType)}
              className="sm:col-span-4 px-2.5 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold"
            >
              <option value="pro">Gói PRO (1 năm)</option>
              <option value="couple">Gói COUPLE (1 năm)</option>
              <option value="lifetime">Gói Trọn đời</option>
            </select>
            <input
              type="text"
              value={newKeyNote}
              onChange={(e) => setNewKeyNote(e.target.value)}
              placeholder="Ghi chú tên khách..."
              className="sm:col-span-5 px-3 py-2 rounded-xl bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-3 py-2 px-3 rounded-xl bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo mã</span>
            </button>
          </form>

          {licenseKeys.length > 0 && (
            <div className="divide-y divide-[var(--border-hairline)] max-h-48 overflow-y-auto pt-1">
              {licenseKeys.map((lk) => (
                <div
                  key={lk.code}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ink-primary)] tabular-nums">{lk.code}</p>
                    <p className="text-xs text-[var(--ink-muted)] truncate">
                      {lk.plan.toUpperCase()} / {lk.note || 'Khách hàng'} ·{' '}
                      <span className={lk.usedBy ? 'text-[var(--tone-caution)]' : 'text-[var(--brand)] font-medium'}>
                        {lk.usedBy ? 'Đã kích hoạt' : 'Chưa dùng'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCode(lk.code)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedCode === lk.code ? (
                      <>
                        <Check className="w-3 h-3 text-[var(--brand)]" /> Đã chép
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Chép
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </details>)}


      {/* Internal Transfer Modal */}
      {isTransferOpen && (
        <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Chuyển ví" tabIndex={-1} className="fixed inset-0 z-50 bg-[var(--brand-dark)]/50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full max-w-md bg-[var(--bg-paper)] border border-[var(--border-hairline)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">Chuyển tiền nội bộ</h2>
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Ghi chuyển tiền giữa các ví trong sổ. Góp tiết kiệm vượt mục tiêu tháng sẽ giảm ngân sách có thể chi.
            </p>
            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-5">
                    Từ tài khoản
                  </label>
                  <select id="accountview-5"
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-medium"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1" htmlFor="accountview-6">
                    Đến tài khoản
                  </label>
                  <select id="accountview-6"
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-xs font-medium"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                  Số tiền (VND)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={formatNumberWithDots(transferAmount)}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="500.000"
                    className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-sm font-semibold tabular-nums"
                  />
                  <span className="absolute right-3 text-xs font-semibold text-[var(--ink-muted)] pointer-events-none">
                    đ
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
              >
                Xác nhận chuyển nội bộ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
