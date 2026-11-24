export type CategoryId = 'food' | 'transport' | 'shopping' | 'living' | 'entertainment';

export type TransactionType = 'expense' | 'internal' | 'loan' | 'income';

export type TransactionStatus = 'confirmed' | 'pending' | 'cancelled' | 'deleted';

export type RolloverMode = 'redistribute' | 'strict';

export type PlanType = 'free' | 'trial' | 'pro' | 'couple' | 'lifetime';
export type SubscriptionStatus = 'active' | 'trial' | 'expired';
export type UserRole = 'user' | 'admin';

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'checking' | 'cash' | 'savings';
}

export interface Transaction {
  id: string;
  merchant: string;
  note: string;
  category: CategoryId;
  accountId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  cycleDayIndex: number; // 0..29 within salary cycle
  timeLabel: string;
  createdAt?: string;
  cycleStartDate?: string;
  effectiveDate?: string;
  destinationAccountId?: string;
  goalId?: string;
  plannedExpenseId?: string;
  savingsDirection?: number;
  budgetSource?: 'daily' | 'fixed';
}

export interface PlannedExpense {
  id: string;
  title: string;
  amount: number;
  category: CategoryId;
  dueDateLabel: string;
  completed: boolean;
}

export interface SalaryConfig {
  monthlyIncome: number;
  paydayDay: number;
  fixedBills: number;
  savingsTarget: number;
  totalCycleDays: number;
  todayIndex: number;
}

export interface FinanceTestBackup {
  createdAt: string;
  salaryConfig: SalaryConfig;
  rolloverMode: RolloverMode;
  avoidedImpulseTotal: number;
  allocatedSavings: number;
  accounts?: Record<string, Record<string, unknown>>;
  records: { sub: string; id: string; data: Record<string, unknown> }[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus;
  planExpiresAt: string | null;
  lastLicenseCode: string | null;
  financeTestBackup?: FinanceTestBackup | null;
  salaryConfig: SalaryConfig;
  rolloverMode: RolloverMode;
  avoidedImpulseTotal: number;
  createdAt: string;
}

export interface LicenseKey {
  code: string;
  plan: PlanType;
  durationDays: number;
  active: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdBy: string;
  note?: string;
}

export interface CalendarDaySummary {
  dayIndex: number;
  dateLabel: string;
  shortDay: string;
  weekdayIndex: number;
  weekdayLabel: string;
  phase: 'past' | 'today' | 'future';
  allowance: number;
  spent: number;
  delta: number;
  status: 'safe' | 'caution' | 'overspent' | 'future';
  transactions: Transaction[];
}

export interface CycleBudgetMetrics {
  totalLivingBudget: number;
  plannedReserveTotal: number;
  spendableLivingPool: number;
  totalSpentCycle: number;
  remainingLivingBudget: number;
  todayAllowance: number;
  todaySpent: number;
  todayDelta: number;
  todayStatus: 'safe' | 'caution' | 'overspent';
  futureDaysCount: number;
  futureDailyAllowance: number;
  redistributionPerDay: number;
  pastSafeSurplusTotal: number;
  days: CalendarDaySummary[];
  baseDailyAllowance: number;
  rolloverMode: RolloverMode;
  pastSpent: number;
  walletLimit: number;
}

export interface QrPreset {
  id: string;
  title: string;
  subtitle: string;
  merchant: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  category: CategoryId;
  transferNote: string;
  qrMode: 'QR Tĩnh' | 'QR Động' | 'Ảnh từ thư viện';
  familiarHint?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  saved: number;
  target: number;
  monthlyHint: string;
}

export interface PausedItem {
  id: string;
  name: string;
  amount: number;
}

export interface SharedExpense {
  id: string;
  title: string;
  amount: number;
  paidBy: 'ngoc' | 'minh';
  splitMode: '50/50' | '60/40' | '100%';
  ngocShareRatio: number;
  date: string;
}

export interface SharedGroup {
  id: string;
  name: string;
  typeLabel: string;
  ownerUid: string;
  memberUids: string[];
  monthlyBudget: number;
  sharedGoal: {
    title: string;
    saved: number;
    target: number;
  };
  expenses: SharedExpense[];
  activities: string[];
}

export interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  dueDay: number;
  paid: boolean;
}
