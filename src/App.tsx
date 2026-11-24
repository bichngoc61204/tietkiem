import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Home,
  QrCode,
  ShieldAlert,
  User as UserIcon,
  PiggyBank,
} from 'lucide-react';
const AccountView = lazy(() => import('./components/AccountView').then(m => ({ default: m.AccountView })));
import { AuthScreen } from './components/AuthScreen';
import { DepositModal } from './components/DepositModal';
import { HeroPassbookCard } from './components/HeroPassbookCard';
import { OnboardingSetup } from './components/OnboardingSetup';
const PlanView = lazy(() => import('./components/PlanView').then(m => ({ default: m.PlanView })));
import type { QrDraft } from './components/QrPaymentDrawer';
const QrPaymentDrawer = lazy(() => import('./components/QrPaymentDrawer').then(m => ({ default: m.QrPaymentDrawer })));
import { QuickExpenseModal } from './components/QuickExpenseModal';
const SharedGroupView = lazy(() => import('./components/SharedGroupView').then(m => ({ default: m.SharedGroupView })));
import { SpendingCalendar } from './components/SpendingCalendar';
import { CATEGORIES } from './data/mockData';
import { auth } from './lib/firebase';
import {
  activateLicenseKey,
  addPausedItemDoc,
  addWallet,
  addPlannedExpense,
  cancelPendingTransactionWithRefund,
  completePlannedExpense,
  confirmPendingTransaction,
  createPendingTransactionWithHold,
  deleteTransactionAndRestoreWallet,
  depositToWallet,
  ensureUserInitialized,
  fetchAllLicenseKeysAsAdmin,
  generateLicenseKeyAsAdmin,
  recordExpenseAndDeductWallet,
  resetTestFinanceWithBackup,
  restoreTestFinanceBackup,
  saveGoal,
  saveSalarySettings,
  setupInitialFinance,
  skipPausedItemDoc,
  subscribeUserData,
  sweepSurplusToSavings,
  transferInternalWallets,
  updateSharedGroupDoc,
} from './services/firestoreService';
import {
  Account,
  CategoryId,
  LicenseKey,
  PausedItem,
  PlannedExpense,
  PlanType,
  RecurringBill,
  SavingsGoal,
  SharedGroup,
  Transaction,
  TransactionType,
  UserProfile,
} from './types/finance';
import { calculateCycleBudgetMetrics, getCycleDateInfo } from './utils/budgetEngine';
import { currentSalaryConfig, getSalaryCycle } from './utils/cycle';
import { Toast } from './components/Toast';
import { formatCompactVND, formatVND } from './utils/format';

type PrimaryTab = 'home' | 'plan' | 'savings' | 'group' | 'account';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(id); }, []);
  const [firestoreBlocked, setFirestoreBlocked] = useState(false);

  const [activeTab, setActiveTab] = useState<PrimaryTab>('home');
  const [planInitialSubTab, setPlanInitialSubTab] = useState<'calendar' | 'planned' | 'decide'>(
    'calendar'
  );
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'safe' | 'caution' | 'neutral';
  } | null>(null);

  const BLANK_SALARY_CONFIG = {
    monthlyIncome: 0,
    paydayDay: 5,
    fixedBills: 0,
    savingsTarget: 0,
    totalCycleDays: 30,
    todayIndex: 15,
  };

  // User & Financial State (always starts clean / 0đ until synced from Firestore)
  const [profile, setProfile] = useState<UserProfile>({
    uid: 'local',
    email: '',
    displayName: 'Thành viên',
    role: 'user',
    plan: 'trial',
    subscriptionStatus: 'trial',
    planExpiresAt: null,
    lastLicenseCode: null,
    salaryConfig: BLANK_SALARY_CONFIG,
    rolloverMode: 'redistribute',
    avoidedImpulseTotal: 0,
    createdAt: new Date().toISOString(),
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [pausedItems, setPausedItems] = useState<PausedItem[]>([]);
  const [sharedGroup, setSharedGroup] = useState<SharedGroup>({
    id: 'group-local',
    ownerUid: 'local',
    memberUids: ['local'],
    name: 'Quỹ chung',
    typeLabel: 'Cá nhân',
    monthlyBudget: 0,
    sharedGoal: { title: '', saved: 0, target: 0 },
    expenses: [],
    activities: [],
  });
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);

  // QR Drawer State
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrStep, setQrStep] = useState<1 | 2 | 3>(1);
  const [pendingQrTxId, setPendingQrTxId] = useState<string | null>(null);
  const [qrDraft, setQrDraft] = useState<QrDraft>({
    merchant: '',
    bankName: 'MB Bank',
    accountNumber: '',
    accountHolder: '',
    amount: 0,
    category: 'food',
    accountId: 'mbbank',
    transferNote: '',
    qrMode: 'VietQR',
  });

  // Manual Expense Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDefaultDayIndex, setManualDefaultDayIndex] = useState(15);

  // Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const notify = (text: string, tone: 'safe' | 'caution' | 'neutral' = 'safe') => {
    setStatusMessage({ text, tone });
  };

  // ============================================================================
  // FIREBASE AUTH & FIRESTORE REAL-TIME SYNC
  // ============================================================================
  useEffect(() => {
    let subCleanup: (() => void) | null = null;
    let generation = 0;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      if (subCleanup) {
        subCleanup();
        subCleanup = null;
      }

      setDataReady(false);
      setAccounts([]); setTransactions([]); setGoals([]); setPlannedExpenses([]); setPausedItems([]); setLicenseKeys([]);
      setIsQrOpen(false); setIsManualModalOpen(false); setIsDepositModalOpen(false);
      setAuthUser(user);
      setAuthReady(true);
      setFirestoreBlocked(false);

      if (!user) return;

      try {
        const initProfile = await ensureUserInitialized(user);
        if (current !== generation) return;
        setProfile(initProfile);

        if (initProfile.role === 'admin') {
          fetchAllLicenseKeysAsAdmin()
            .then(setLicenseKeys)
            .catch(() => {});
        }

        const subs = subscribeUserData(user.uid, {
          onReady: () => setDataReady(true),
          onProfile: (p) => setProfile(p),
          onAccounts: (accs) => setAccounts(accs),
          onTransactions: (txs) => setTransactions(txs),
          onPlanned: (plans) => setPlannedExpenses(plans),
          onGoals: (g) => setGoals(g),
          onPaused: (p) => setPausedItems(p),
          onGroup: (grp) => {
            if (grp) setSharedGroup(grp);
            else setSharedGroup({ id: `group-${user.uid}`, ownerUid: user.uid, memberUids: [user.uid], name: 'Quỹ chung', typeLabel: 'Cá nhân', monthlyBudget: 0, sharedGoal: { title: '', saved: 0, target: 0 }, expenses: [], activities: [] });
          },
          onError: (err) => {
            setDataReady(true);
            notify('Không tải được dữ liệu. Kiểm tra kết nối và tải lại trang.', 'caution');
            if (err.message.toLowerCase().includes('permission')) {
              setFirestoreBlocked(true);
            }
          },
        });
        subCleanup = subs.unsubscribeAll;
      } catch (err: unknown) {
        if (current !== generation) return;
        setFirestoreBlocked(true);
        setDataReady(true);
        const msg = (err as { message?: string })?.message || '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          setFirestoreBlocked(true);
          setProfile((prev) => ({
            ...prev,
            uid: user.uid,
            email: user.email || prev.email,
            displayName: user.email === 'hung@gmail.com' ? 'Hùng (Admin)' : user.email || 'Bạn',
          }));
        }
      }
    });

    return () => {
      generation++;
      unsubAuth();
      if (subCleanup) subCleanup();
    };
  }, []);

  const salaryConfig = useMemo(() => currentSalaryConfig(profile.salaryConfig, clock), [profile.salaryConfig, clock]);
  const cycle = getSalaryCycle(salaryConfig.paydayDay, clock);
  const rolloverMode = profile.rolloverMode;

  const metrics = useMemo(
    () => calculateCycleBudgetMetrics(salaryConfig, transactions, plannedExpenses, rolloverMode, accounts),
    [salaryConfig, transactions, plannedExpenses, rolloverMode, accounts]
  );

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'pending'),
    [transactions]
  );

  const recentSevenDays = useMemo(() => {
    const start = Math.max(0, salaryConfig.todayIndex - 6);
    return metrics.days.slice(start, salaryConfig.todayIndex + 1);
  }, [metrics.days, salaryConfig.todayIndex]);

  // ============================================================================
  // CORE ACTIONS (SYNCED ATOMICALLY TO FIRESTORE + LOCAL OPTIMISTIC STATE)
  // ============================================================================

  const openQrDrawer = () => {
    setPendingQrTxId(null);
    setQrDraft({
      merchant: '',
      bankName: 'MB Bank',
      accountNumber: '',
      accountHolder: '',
      amount: 0,
      category: 'food',
      accountId: accounts.find((a) => a.type === 'checking')?.id || '',
      transferNote: '',
      qrMode: 'VietQR',
    });
    setQrStep(1);
    setIsQrOpen(true);
  };

  // Firestore snapshots own financial state. Never show a successful write until committed.
  const mutate = async (action: (uid: string) => Promise<unknown>, success: string): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!authUser || firestoreBlocked) { notify('Chưa kết nối được dữ liệu. Vui lòng tải lại trang trước khi ghi tiền.', 'caution'); return false; }
    busyRef.current = true; setBusy(true);
    try { await action(authUser.uid); notify(success); return true; }
    catch (error) {
      const code = (error as { code?: string })?.code || '';
      const message = code.includes('permission-denied') ? 'Máy chủ chưa cho phép thao tác này. Chưa có thay đổi số dư.' : code.includes('unavailable') ? 'Chưa kết nối được máy chủ. Kiểm tra mạng và thử lại.' : error instanceof Error ? error.message : 'Chưa lưu được. Vui lòng thử lại.';
      notify(message, 'caution'); return false;
    }
    finally { busyRef.current = false; setBusy(false); }
  };
  const handleProceedToBank = async () => {
    if (!qrDraft.accountNumber.trim() || !qrDraft.bankName.trim()) { notify('Kiểm tra ngân hàng và số tài khoản nhận.', 'caution'); return false; }
    const tx: Transaction = { id: crypto.randomUUID(), merchant: qrDraft.merchant || qrDraft.accountHolder, note: qrDraft.transferNote, category: qrDraft.category, accountId: qrDraft.accountId, amount: qrDraft.amount, type: 'expense', status: 'pending', cycleDayIndex: salaryConfig.todayIndex, timeLabel: 'Chờ xác nhận', cycleStartDate: cycle.key, budgetSource: qrDraft.budgetSource || 'daily', ...(qrDraft.plannedExpenseId ? { plannedExpenseId: qrDraft.plannedExpenseId } : {}) };
    const ok = await mutate(uid => createPendingTransactionWithHold(uid, tx), 'Đã giữ số tiền trong sổ. Chuyển tiền trong ứng dụng ngân hàng, rồi quay lại xác nhận.');
    if (ok) { setPendingQrTxId(tx.id); setQrStep(3); }
    return ok;
  };
  const handleConfirmPayment = async (id: string) => {
    const ok = await mutate(uid => confirmPendingTransaction(uid, id), 'Đã xác nhận khoản chi. Số dư không bị trừ thêm.');
    if (ok) { setPendingQrTxId(null); setIsQrOpen(false); }
    return ok;
  };
  const handleCancelPendingPayment = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return false;
    const ok = await mutate(uid => cancelPendingTransactionWithRefund(uid, tx), 'Đã hủy khoản chờ và trả lại số dư trong sổ.');
    if (ok) { setPendingQrTxId(null); setIsQrOpen(false); }
    return ok;
  };
  const handleSaveManualExpense = async (payload: { merchant: string; amount: number; category: CategoryId; accountId: string; cycleDayIndex: number; type: TransactionType; budgetSource?: 'daily' | 'fixed' }) => {
    if (payload.cycleDayIndex < 0 || payload.cycleDayIndex > salaryConfig.todayIndex) return false;
    const tx: Transaction = { ...payload, id: crypto.randomUUID(), note: payload.type === 'loan' ? 'Cho mượn / ứng trước' : 'Ghi chi tiêu', status: 'confirmed', timeLabel: getCycleDateInfo(payload.cycleDayIndex, salaryConfig.paydayDay).dateLabel, cycleStartDate: cycle.key };
    return mutate(uid => recordExpenseAndDeductWallet(uid, tx), `Đã ghi ${payload.merchant}: ${formatVND(payload.amount)}.`);
  };
  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (!window.confirm(`Hoàn tác “${tx.merchant}” (${formatVND(tx.amount)}) và cập nhật lại số dư?`)) return;
    await mutate(uid => deleteTransactionAndRestoreWallet(uid, tx), 'Đã hoàn tác giao dịch và cập nhật số dư.');
  };
  const handleAddPlanned = async (payload: { title: string; amount: number; category: CategoryId; dueDateLabel: string }) => {
    return mutate(uid => addPlannedExpense(uid, { ...payload, id: crypto.randomUUID(), completed: false }), 'Đã dành ngân sách cho khoản sắp chi.');
  };
  const handleCompletePlanned = async (plan: PlannedExpense, accountId: string) => {
    return mutate(uid => completePlannedExpense(uid, plan, accountId, salaryConfig.todayIndex), `Đã ghi chi ${plan.title}.`);
  };
  const handleSweepSurplus = async (amount: number, goalId: string | null, sourceId?: string) => {
    const checking = sourceId ? accounts.find(a => a.id === sourceId && a.type !== 'savings') : accounts.find(a => a.type === 'checking') || accounts.find(a => a.type === 'cash');
    const saving = accounts.find(a => a.type === 'savings');
    if (!checking || !saving) { notify('Cần có ví nguồn và ví tiết kiệm.', 'caution'); return false; }
    return mutate(uid => sweepSurplusToSavings(uid, checking.id, saving.id, goalId, amount, salaryConfig.todayIndex), `Đã chuyển ${formatVND(amount)} từ ${checking.name} sang tiết kiệm trong sổ.`);
  };
  const handleInternalTransfer = async (fromId: string, toId: string, amount: number) => {
    const tx: Transaction = { id: crypto.randomUUID(), merchant: `Chuyển ví: ${accounts.find(a => a.id === fromId)?.name} sang ${accounts.find(a => a.id === toId)?.name}`, note: 'Chuyển nội bộ', category: 'living', accountId: fromId, amount, type: 'internal', status: 'confirmed', cycleDayIndex: salaryConfig.todayIndex, timeLabel: 'Vừa ghi nhận', cycleStartDate: cycle.key };
    return mutate(uid => transferInternalWallets(uid, fromId, toId, amount, tx), 'Đã ghi chuyển tiền giữa các ví.');
  };
  const handleDepositWallet = async (id: string, amount: number) => mutate(uid => depositToWallet(uid, id, amount, salaryConfig.todayIndex), 'Đã ghi tiền thực nhận vào ví.');
  const handleCompleteOnboarding = async (config: { salaryConfig: typeof BLANK_SALARY_CONFIG; wallets: Account[] }) => mutate(uid => setupInitialFinance(uid, config.salaryConfig, config.wallets), 'Đã lưu thiết lập Ví An.');

  if (!authReady || (authUser && !dataReady)) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold tracking-normal text-[var(--ink-primary)]">VÍ AN</p>
          <p className="text-xs text-[var(--ink-muted)]">Đang kết nối dữ liệu của bạn…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  // If user hasn't set up income yet, show simple onboarding setup
  if (!firestoreBlocked && accounts.length === 0) {
    return <OnboardingSetup onComplete={handleCompleteOnboarding} backupAvailable={Boolean(profile.financeTestBackup)} onRestore={() => mutate(uid => restoreTestFinanceBackup(uid), 'Đã khôi phục dữ liệu trước khi thử.')} />;
  }

  return (
    <div className="app-shell min-h-screen bg-[var(--bg-canvas)] text-[var(--ink-primary)] w-full" aria-busy={busy}>
      {import.meta.env.MODE === 'qa' && <div className="qa-banner">Bản thử nghiệm cục bộ: dữ liệu giả, không kết nối ngân hàng hay tài khoản thật</div>}
      {/* Responsive Shell */}
      <div className="max-w-5xl mx-auto min-h-screen flex flex-col pb-24 lg:pb-10 w-full overflow-x-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-xs border-b border-[var(--border-hairline)] px-3 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="text-[15px] font-semibold tracking-normal text-[var(--ink-primary)] cursor-pointer"
            >
              VÍ AN
            </button>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 bg-[var(--tone-white)] border border-[var(--border-hairline)] p-1 rounded-xl">
              {[
                { id: 'home', label: 'Tổng quan' },
                { id: 'plan', label: 'Lịch & Dự kiến' },
                { id: 'group', label: 'Quỹ chung' },
                { id: 'savings', label: 'Tiết kiệm' },
                { id: 'account', label: 'Ví & Cài đặt' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as PrimaryTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-[var(--ink-primary)] text-[var(--tone-white)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-primary)] bg-[var(--tone-white)] border border-[var(--border-hairline)] px-3 py-1.5 rounded-full tabular-nums transition cursor-pointer"
            >
              {getCycleDateInfo(0, salaryConfig.paydayDay).dateLabel} đến {getCycleDateInfo(salaryConfig.totalCycleDays - 1, salaryConfig.paydayDay).dateLabel} / Còn{' '}
              <span className="font-semibold text-[var(--ink-primary)]">{metrics.futureDaysCount} ngày</span>
            </button>
            <button
              type="button"
              onClick={() => openQrDrawer()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span>Quét QR</span>
            </button>
          </div>
        </header>

        {/* Firestore Rules Setup Helper (only if Firestore rules are currently locked on Console) */}
        {firestoreBlocked && (
          <div className="px-4 sm:px-6 pt-3">
            <div className="bg-[var(--tone-caution-soft)] border border-[var(--tone-caution-border)] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--color-92400e)]">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Chưa truy cập được dữ liệu. Các thao tác ghi tiền đang tạm khóa. Vui lòng kiểm tra kết nối hoặc liên hệ người quản trị.</span>
              </div>
            </div>
          </div>
        )}

        {statusMessage && <Toast message={statusMessage.text} tone={statusMessage.tone} onClose={() => setStatusMessage(null)} />}
        {busy && <div className="saving-status" role="status">Đang lưu thay đổi…</div>}

        {/* PENDING QR TRANSACTIONS PRIORITY ALERT */}
        {pendingTransactions.length > 0 && (
          <div className="px-4 sm:px-6 pt-3 space-y-2">
            {pendingTransactions.map((tx) => {
              const walletName =
                accounts.find((a) => a.id === tx.accountId)?.name || tx.accountId;
              return (
                <div
                  key={tx.id}
                  className="bg-[var(--tone-caution-soft)] border border-[var(--color-f59e0b)] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-[var(--tone-caution)] shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-[var(--ink-primary)] tabular-nums">
                        Đang chờ xác nhận: {tx.merchant} (-{formatVND(tx.amount)})
                      </p>
                      <p className="text-[var(--color-78350f)] mt-0.5">
                        Đã trừ tạm khỏi ví {walletName}. Bạn đã chuyển khoản xong trên app ngân
                        hàng chưa?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleConfirmPayment(tx.id)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--brand)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
                    >
                      Đã chuyển
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelPendingPayment(tx.id)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--tone-white)] border border-[var(--tone-caution-border)] text-[var(--tone-danger)] text-xs font-semibold cursor-pointer"
                    >
                      Hủy & hoàn tiền
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MAIN VIEWPORT */}
        <Suspense fallback={<p className="p-6" role="status">Đang mở…</p>}>
        <main id="main-content" className="flex-1 px-3.5 sm:px-6 pt-4 w-full overflow-x-hidden">
          {activeTab === 'home' && (
            <div key="view-home" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-page-enter">
              {/* LEFT COLUMN (Mobile Full / Desktop 5 cols): Hero Passbook + Primary CTA */}
              <div className="lg:col-span-5 space-y-4 min-w-0">
                <HeroPassbookCard
                  metrics={metrics}
                  salaryConfig={salaryConfig}
                  accounts={accounts}
                  onOpenQr={() => openQrDrawer()}
                  onOpenQuickExpense={() => {
                    setManualDefaultDayIndex(salaryConfig.todayIndex);
                    setIsManualModalOpen(true);
                  }}
                  onOpenPlannedExpense={() => {
                    setPlanInitialSubTab('planned');
                    setActiveTab('plan');
                  }}
                  onOpenDeposit={() => setIsDepositModalOpen(true)}
                />

                {/* Mobile 7-Day Mini Calendar Strip */}
                <section className="lg:hidden bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-3.5 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--ink-primary)]">7 ngày gần nhất</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setPlanInitialSubTab('calendar');
                        setActiveTab('plan');
                      }}
                      className="text-xs font-semibold text-[var(--brand)] flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Xem lịch</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 min-w-0">
                    {recentSevenDays.map((day) => {
                      const isToday = day.phase === 'today';
                      const isOver = day.delta < 0;
                      return (
                        <button
                          key={day.dayIndex}
                          type="button"
                          onClick={() => {
                            setPlanInitialSubTab('calendar');
                            setActiveTab('plan');
                          }}
                          className={`rounded-xl border p-1 flex flex-col items-center justify-between min-h-[50px] transition cursor-pointer min-w-0 ${
                            isOver
                              ? 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-border)] text-[var(--tone-danger)]'
                              : 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]'
                          } ${isToday ? 'ring-1.5 ring-[var(--ink-primary)]' : ''}`}
                        >
                          <div className="flex items-center gap-0.5">
                            <span className="text-xs font-medium tabular-nums">
                              {day.shortDay}
                            </span>
                            {isToday && isOver && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tone-danger)]" />
                            )}
                          </div>
                          <span className="text-xs font-semibold tabular-nums">
                            {day.transactions.length ? formatCompactVND(day.delta, true) : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

              </div>

              {/* RIGHT COLUMN (Desktop 7 cols): Full Interactive Calendar + Recent Transactions */}
              <div className="lg:col-span-7 space-y-4 min-w-0 w-full">
                <div className="hidden lg:block min-w-0">
                  <SpendingCalendar
                    metrics={metrics}
                    todayIndex={salaryConfig.todayIndex}
                    onAddExpenseOnDay={(dayIdx) => {
                      setManualDefaultDayIndex(dayIdx);
                      setIsManualModalOpen(true);
                    }}
                    onDeleteTransaction={handleDeleteTransaction}
                  />
                </div>

                {/* Recent Transactions Card */}
                <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 min-w-0 w-full overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
                      Giao dịch gần đây
                    </h2>
                    <span className="text-xs text-[var(--ink-muted)]">Đã đồng bộ</span>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="py-8 text-center space-y-1">
                      <p className="text-xs font-medium text-[var(--ink-primary)]">Chưa có giao dịch nào</p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        Quét mã VietQR hoặc bấm Ghi nhanh để bắt đầu theo dõi chi tiêu.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border-hairline)]">
                      {transactions.slice(0, 6).map((tx) => {
                        const catLabel =
                          tx.type === 'income' ? 'Thu nhập' : tx.type === 'internal'
                            ? 'Chuyển nội bộ'
                            : tx.type === 'loan'
                            ? 'Cho mượn'
                            : CATEGORIES[tx.category]?.label || 'Chi tiêu';
                        const walletName =
                          accounts.find((a) => a.id === tx.accountId)?.name || tx.accountId;
                        const isPending = tx.status === 'pending';

                        return (
                          <div
                            key={tx.id}
                            className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-[var(--ink-primary)] truncate">
                                  {tx.merchant}
                                </p>
                                {isPending && (
                                  <span className="shrink-0 text-xs font-semibold text-[var(--tone-caution)] bg-[var(--tone-caution-soft)] border border-[var(--tone-caution-border)] px-1.5 py-0.5 rounded">
                                    Chờ xác nhận
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--ink-muted)] mt-0.5 tabular-nums">
                                {catLabel} / {walletName} / {tx.timeLabel}
                              </p>
                            </div>

                            <span
                              className={`text-sm font-semibold tabular-nums shrink-0 ${
                                tx.type === 'internal'
                                  ? 'text-[var(--ink-muted)]'
                                  : isPending
                                  ? 'text-[var(--tone-caution)]'
                                  : 'text-[var(--ink-primary)]'
                              }`}
                            >
                              {tx.type === 'internal' ? '' : tx.type === 'income' ? '+' : '-'}
                              {formatVND(tx.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {(activeTab === 'plan' || activeTab === 'savings') && (
            <div key="view-plan" className="max-w-2xl mx-auto animate-page-enter">
              <PlanView
                key={activeTab}
                metrics={metrics}
                salaryConfig={salaryConfig}
                transactions={transactions}
                plannedExpenses={plannedExpenses}
                accounts={accounts}
                rolloverMode={rolloverMode}
                goals={goals}
                pausedItems={pausedItems}
                avoidedImpulseTotal={profile.avoidedImpulseTotal}
                initialSubTab={activeTab === 'savings' ? 'planned' : planInitialSubTab}
                onChangeRolloverMode={mode => { void mutate(uid => saveSalarySettings(uid, salaryConfig, mode), 'Đã cập nhật cách chia ngân sách.'); }}
                onAddExpenseOnDay={(dayIdx) => {
                  setManualDefaultDayIndex(dayIdx);
                  setIsManualModalOpen(true);
                }}
                onDeleteTransaction={handleDeleteTransaction}
                onAddPlanned={handleAddPlanned}
                onCompletePlanned={handleCompletePlanned}
                onSweepSurplus={handleSweepSurplus}
                onBuyWhatIfItem={(name, price, accountId) => {
                  if (!name.trim() || price <= 0) return;
                  const isFood = ['cơm', 'bún', 'phở', 'bánh', 'mì', 'xôi', 'hủ tiếu', 'cháo', 'lẩu', 'bò', 'ăn'].some(
                    (kw) => name.toLowerCase().includes(kw)
                  );
                  const fallbackWallet =
                    accounts.find((a) => a.type !== 'savings' && a.balance >= price)?.id ||
                    accounts[0]?.id ||
                    'mbbank';
                  handleSaveManualExpense({
                    merchant: name.trim(),
                    amount: price,
                    category: isFood ? 'food' : 'shopping',
                    accountId: accountId || fallbackWallet,
                    cycleDayIndex: salaryConfig.todayIndex,
                    type: 'expense',
                  });
                }}
                onPauseWhatIfItem={(name, amount) => { void mutate(uid => addPausedItemDoc(uid, { id: crypto.randomUUID(), name, amount }), 'Đã lưu để cân nhắc.'); }}
                onSkipPausedItem={item => { void mutate(uid => skipPausedItemDoc(uid, item), 'Đã bỏ qua món đang cân nhắc.'); }}
                onAddGoal={(title, target) => mutate(uid => saveGoal(uid, { id: crypto.randomUUID(), title, target, saved: 0, monthlyHint: 'Góp dần theo khả năng' }), 'Đã tạo mục tiêu tiết kiệm.')}
                onDepositGoal={(goalId, amount, fromId) => handleSweepSurplus(amount, goalId, fromId)}
              />
            </div>
          )}

          {activeTab === 'group' && (
            <div key="view-group" className="max-w-2xl mx-auto animate-page-enter">
              <SharedGroupView
                group={sharedGroup}
                onAddExpense={(payload) => {
                  const payerName = payload.paidBy === 'ngoc' ? 'Ngọc' : 'Minh';
                  const ngocRatio = payload.splitMode === '50/50' ? 0.5 : 0.6;
                  const nextGroup: SharedGroup = {
                    ...sharedGroup,
                    expenses: [
                      {
                        id: `se-${Date.now()}`,
                        title: payload.title,
                        amount: payload.amount,
                        paidBy: payload.paidBy,
                        splitMode: payload.splitMode,
                        ngocShareRatio: ngocRatio,
                        date: 'Hôm nay',
                      },
                      ...sharedGroup.expenses,
                    ],
                    activities: [
                      `${payerName} vừa thêm ${formatVND(payload.amount)} cho "${payload.title}" (${payload.splitMode}).`,
                      ...sharedGroup.activities,
                    ],
                  };
                  void mutate(() => updateSharedGroupDoc(nextGroup), 'Đã ghi nhận khoản chi chung.');
                }}
                onSettleBalance={(payer, settleAmount) => {
                  const payerName = payer === 'minh' ? 'Minh' : 'Ngọc';
                  const receiverName = payer === 'minh' ? 'Ngọc' : 'Minh';
                  const nextGroup: SharedGroup = {
                    ...sharedGroup,
                    expenses: [
                      ...sharedGroup.expenses,
                      {
                        id: `se-settle-${Date.now()}`,
                        title: `Tất toán cân bằng cho ${receiverName}`,
                        amount: settleAmount,
                        paidBy: payer,
                        splitMode: '100%',
                        ngocShareRatio: payer === 'minh' ? 1 : 0,
                        date: 'Hôm nay',
                      },
                    ],
                    activities: [
                      `${payerName} đã chuyển hoàn ${formatVND(settleAmount)} cho ${receiverName}.`,
                      ...sharedGroup.activities,
                    ],
                  };
                  void mutate(() => updateSharedGroupDoc(nextGroup), 'Đã ghi nhận thanh toán quỹ chung.');
                }}
              />
            </div>
          )}

          {activeTab === 'account' && (
            <div key="view-account" className="max-w-2xl mx-auto animate-page-enter">
              <button type="button" className="secondary-button mb-4" onClick={() => setActiveTab('group')}>Mở quỹ chung</button>
              <AccountView
                profile={profile}
                salaryConfig={salaryConfig}
                accounts={accounts}
                recurringBills={recurringBills}
                licenseKeys={licenseKeys}
                onUpdateSalaryConfig={next => { void mutate(uid => saveSalarySettings(uid, next, rolloverMode), 'Đã lưu kế hoạch ngân sách.'); }}
                onToggleBillPaid={(billId) =>
                  setRecurringBills((prev) =>
                    prev.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b))
                  )
                }
                onInternalTransfer={handleInternalTransfer}
                onAddWallet={wallet => mutate(uid => addWallet(uid, wallet), 'Đã thêm ví và số dư ban đầu.')}
                onActivateLicense={async (code) => {
                  try {
                    const upgradedPlan = await activateLicenseKey(authUser.uid, code);
                    setProfile((prev) => ({
                      ...prev,
                      plan: upgradedPlan,
                      subscriptionStatus: 'active',
                    }));
                    notify(
                      `Kích hoạt thành công gói ${upgradedPlan.toUpperCase()}!`,
                      'safe'
                    );
                  } catch (err: unknown) {
                    const msg =
                      (err as { message?: string })?.message || 'Không kích hoạt được mã này.';
                    notify(msg, 'caution');
                  }
                }}
                onGenerateLicenseKey={async (plan: PlanType, durationDays: number, note: string) => {
                  try {
                    const key = await generateLicenseKeyAsAdmin(
                      authUser.uid,
                      plan,
                      durationDays,
                      note
                    );
                    setLicenseKeys((prev) => [key, ...prev]);
                    notify(`Đã tạo mã bản quyền ${key.code}.`, 'safe');
                  } catch {
                    notify(
                      'Cần publish firestore.rules lên Firebase Console để lưu mã lên đám mây.',
                      'caution'
                    );
                  }
                }}
                onResetTestData={() => mutate(uid => resetTestFinanceWithBackup(uid), 'Đã lưu bản sao và làm sạch dữ liệu tài chính thử.')}
                onRestoreTestData={() => mutate(uid => restoreTestFinanceBackup(uid), 'Đã khôi phục dữ liệu trước khi thử.')}
                onSignOut={() => signOut(auth)}
              />
            </div>
          )}
        </main>
        </Suspense>

        {/* MOBILE BOTTOM NAVIGATION (4 Balanced Tabs) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <div className="mobile-nav max-w-2xl mx-auto bg-[var(--tone-white)]/95 backdrop-blur-xs border-t border-[var(--border-hairline)] px-2 py-2 grid grid-cols-5 items-center">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'home' ? 'text-[var(--brand)] font-semibold' : 'text-[var(--ink-muted)] font-medium'
              }`}
            >
              <Home className="w-5 h-5" strokeWidth={activeTab === 'home' ? 2 : 1.6} />
              <span className="text-xs">Tổng quan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlanInitialSubTab('calendar');
                setActiveTab('plan');
              }}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'plan' ? 'text-[var(--brand)] font-semibold' : 'text-[var(--ink-muted)] font-medium'
              }`}
            >
              <div className="relative">
                <CalendarDays className="w-5 h-5" strokeWidth={activeTab === 'plan' ? 2 : 1.6} />
                {metrics.todayStatus === 'overspent' && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[var(--tone-danger)]" />
                )}
              </div>
              <span className="text-xs">Lịch</span>
            </button>

            <button type="button" onClick={openQrDrawer} className="nav-scan" aria-label="Quét QR"><QrCode /><span>Quét QR</span></button>
            <button
              type="button"
              onClick={() => setActiveTab('savings')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'savings' ? 'text-[var(--brand)] font-semibold' : 'text-[var(--ink-muted)] font-medium'
              }`}
            >
              <PiggyBank className="w-5 h-5" strokeWidth={activeTab === 'savings' ? 2 : 1.6} />
              <span className="text-xs">Tiết kiệm</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`flex flex-col items-center justify-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'account' ? 'text-[var(--brand)] font-semibold' : 'text-[var(--ink-muted)] font-medium'
              }`}
            >
              <UserIcon className="w-5 h-5" strokeWidth={activeTab === 'account' ? 2 : 1.6} />
              <span className="text-xs">Tài khoản</span>
            </button>
          </div>
        </nav>

        {/* 3-Step VietQR Payment Drawer */}
        {isQrOpen && <Suspense fallback={<div className="saving-status" role="status">Đang mở máy quét…</div>}><QrPaymentDrawer
          busy={busy}
          isOpen={isQrOpen}
          step={qrStep}
          draft={qrDraft}
          accounts={accounts}
          metrics={metrics}
          plannedExpenses={plannedExpenses}
          pendingTxId={pendingQrTxId}
          onClose={() => setIsQrOpen(false)}
          onSetStep={setQrStep}
          onUpdateDraft={setQrDraft}
          onProceedToBank={handleProceedToBank}
          onConfirmPayment={handleConfirmPayment}
          onCancelPayment={handleCancelPendingPayment}
          onNotify={notify}
        /></Suspense>}

        {/* Quick Manual Expense Modal */}
        <QuickExpenseModal
          isOpen={isManualModalOpen}
          defaultDayIndex={manualDefaultDayIndex}
          paydayDay={salaryConfig.paydayDay}
          todayIndex={salaryConfig.todayIndex}
          accounts={accounts}
          onClose={() => setIsManualModalOpen(false)}
          onSave={handleSaveManualExpense}
        />

        {/* Deposit Modal */}
        <DepositModal
          isOpen={isDepositModalOpen}
          accounts={accounts}
          onClose={() => setIsDepositModalOpen(false)}
          onDeposit={handleDepositWallet}
        />
      </div>
    </div>
  );
}
