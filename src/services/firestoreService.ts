import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { assertMoney, debitBalance } from '../utils/money';
import { dateKey, getSalaryCycle } from '../utils/cycle';
import {
  Account,
  GroupInvitation,
  GroupMember,
  LicenseKey,
  PausedItem,
  PlannedExpense,
  PlanType,
  RolloverMode,
  SalaryConfig,
  SavingsGoal,
  SharedGroup,
  Transaction,
  UserProfile,
} from '../types/finance';

export async function ensureUserInitialized(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const isOwnerAdmin = user.email?.toLowerCase() === 'hung@gmail.com';
  const nowIso = new Date().toISOString();
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: isOwnerAdmin ? 'Hùng (Admin)' : user.email?.split('@')[0] || 'Thành viên',
    role: isOwnerAdmin ? 'admin' : 'user',
    plan: isOwnerAdmin ? 'lifetime' : 'trial',
    subscriptionStatus: isOwnerAdmin ? 'active' : 'trial',
    planExpiresAt: isOwnerAdmin
      ? null
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastLicenseCode: null,
    salaryConfig: {
      monthlyIncome: 0,
      paydayDay: 5,
      fixedBills: 0,
      savingsTarget: 0,
      totalCycleDays: 30,
      todayIndex: 15,
    },
    rolloverMode: 'redistribute',
    avoidedImpulseTotal: 0,
    createdAt: nowIso,
  };

  return runTransaction(db, async t => {
  const existing = await t.get(userRef);
  if (existing.exists()) return existing.data() as UserProfile;
  t.set(userRef, profile);

  // Create empty shared group for this user
  const groupId = `group-${user.uid}`;
  const memberEntry: GroupMember = {
    uid: user.uid,
    displayName: profile.displayName,
    email: profile.email,
    joinedAt: nowIso,
  };
  t.set(doc(db, 'groups', groupId), {
    id: groupId,
    ownerUid: user.uid,
    memberUids: [user.uid],
    members: [memberEntry],
    name: 'Quỹ chung',
    typeLabel: 'Cá nhân',
    monthlyBudget: 0,
    sharedGoal: { title: '', saved: 0, target: 0 },
    expenses: [],
    activities: [],
  });

  return profile;
  });
}

export interface UserSubscriptions {
  unsubscribeAll: () => void;
}

export function subscribeUserData(
  uid: string,
  callbacks: {
    onReady: () => void;
    onProfile: (profile: UserProfile) => void;
    onAccounts: (accounts: Account[]) => void;
    onTransactions: (txs: Transaction[]) => void;
    onPlanned: (plans: PlannedExpense[]) => void;
    onGoals: (goals: SavingsGoal[]) => void;
    onPaused: (items: PausedItem[]) => void;
    onGroup: (group: SharedGroup | null) => void;
    onError: (err: Error) => void;
  }
): UserSubscriptions {
  const unsubs: Unsubscribe[] = [];
  const loaded = new Set<string>();
  const ready = (name: string) => { loaded.add(name); if (loaded.size === 7) callbacks.onReady(); };

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        queueMicrotask(() => ready('profile'));
        if (snap.exists()) callbacks.onProfile(snap.data() as UserProfile);
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'accounts'),
      (snap) => {
        queueMicrotask(() => ready('accounts'));
        const list = snap.docs.map((d) => d.data() as Account);
        callbacks.onAccounts(list);
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'transactions'), orderBy('cycleDayIndex', 'desc')),
      (snap) => {
        queueMicrotask(() => ready('transactions'));
        const list = snap.docs.map((d) => d.data() as Transaction);
        callbacks.onTransactions(list.filter(t => t.status === 'pending' || t.status === 'confirmed').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'plannedExpenses'),
      (snap) => {
        queueMicrotask(() => ready('planned'));
        callbacks.onPlanned(snap.docs.map((d) => d.data() as PlannedExpense));
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'goals'),
      (snap) => {
        queueMicrotask(() => ready('goals'));
        callbacks.onGoals(snap.docs.map((d) => d.data() as SavingsGoal));
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'pausedItems'),
      (snap) => {
        queueMicrotask(() => ready('paused'));
        callbacks.onPaused(snap.docs.map((d) => d.data() as PausedItem));
      },
      callbacks.onError
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'groups'), where('memberUids', 'array-contains', uid)),
      (snap) => {
        queueMicrotask(() => ready('group'));
        if (!snap.empty) {
          callbacks.onGroup(snap.docs[0].data() as SharedGroup);
        } else {
          callbacks.onGroup(null);
        }
      },
      callbacks.onError
    )
  );

  return {
    unsubscribeAll: () => unsubs.forEach((u) => u()),
  };
}

const userDoc = (uid: string, sub: string, id: string) => doc(db, 'users', uid, sub, id);
const stamp = (tx: Transaction, payday: number): Transaction => {
  const cycle = getSalaryCycle(payday);
  const effective = new Date((tx.cycleStartDate || cycle.key) + 'T00:00:00');
  effective.setDate(effective.getDate() + tx.cycleDayIndex);
  return { ...tx, createdAt: new Date().toISOString(), cycleStartDate: tx.cycleStartDate || cycle.key, effectiveDate: tx.effectiveDate || dateKey(effective) };
};

export async function recordExpenseAndDeductWallet(uid: string, tx: Transaction) {
  assertMoney(tx.amount);
  if (!['expense', 'loan'].includes(tx.type) || !['pending', 'confirmed'].includes(tx.status)) throw new Error('Loại giao dịch chi không hợp lệ.');
  await runTransaction(db, async t => {
    const txRef = userDoc(uid, 'transactions', tx.id);
    const accRef = userDoc(uid, 'accounts', tx.accountId);
    const planRef = tx.plannedExpenseId ? userDoc(uid, 'plannedExpenses', tx.plannedExpenseId) : null;
    const [old, acc, profile, plan] = await Promise.all([t.get(txRef), t.get(accRef), t.get(doc(db, 'users', uid)), planRef ? t.get(planRef) : null]);
    if (old.exists()) return; // Retry of the same operation never debits again.
    if (planRef && (!plan?.exists() || plan.data()?.completed)) throw new Error('Khoản dự kiến đã được thanh toán hoặc không còn tồn tại.');
    if (planRef && plan?.data()?.amount !== tx.amount) throw new Error('Số tiền phải khớp khoản đã dự trù.');
    if (tx.status === 'pending' && acc.data()?.type !== 'checking') throw new Error('Thanh toán QR cần chọn ví ngân hàng.');
    const balance = debitBalance(acc.exists() ? acc.data() as Account : undefined, tx.amount);
    t.update(accRef, { balance });
    if (planRef) t.update(planRef, { completed: true, paymentTransactionId: tx.id });
    t.set(txRef, stamp(tx, profile.data()?.salaryConfig?.paydayDay || 5));
  });
}
export async function createPendingTransactionWithHold(uid: string, tx: Transaction) {
  await recordExpenseAndDeductWallet(uid, { ...tx, status: 'pending' });
}
export async function confirmPendingTransaction(uid: string, txId: string) {
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'transactions', txId);
    const snap = await t.get(ref);
    if (!snap.exists() || snap.data().status !== 'pending') return;
    t.update(ref, { status: 'confirmed', timeLabel: 'Đã xác nhận' });
  });
}
export async function cancelPendingTransactionWithRefund(uid: string, tx: Transaction) {
  await restoreTransaction(uid, tx.id, true);
}
export async function deleteTransactionAndRestoreWallet(uid: string, tx: Transaction) {
  await restoreTransaction(uid, tx.id, false);
}
async function restoreTransaction(uid: string, id: string, pendingOnly: boolean) {
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'transactions', id);
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const tx = snap.data() as Transaction;
    if (!['confirmed', 'pending'].includes(tx.status)) return;
    if (pendingOnly && tx.status !== 'pending') throw new Error('Giao dịch đã được xác nhận ở phiên khác.');
    const accRef = userDoc(uid, 'accounts', tx.accountId);
    const toRef = tx.destinationAccountId ? userDoc(uid, 'accounts', tx.destinationAccountId) : null;
    const goalRef = tx.goalId ? userDoc(uid, 'goals', tx.goalId) : null;
    const planRef = tx.plannedExpenseId ? userDoc(uid, 'plannedExpenses', tx.plannedExpenseId) : null;
    const [acc, to, goal, plan, profile] = await Promise.all([t.get(accRef), toRef ? t.get(toRef) : null, goalRef ? t.get(goalRef) : null, planRef ? t.get(planRef) : null, t.get(doc(db, 'users', uid))]);
    if (!acc.exists()) throw new Error('Không tìm thấy ví để hoàn tiền.');
    if (tx.type === 'internal' && (!toRef || !to?.exists())) throw new Error('Giao dịch cũ thiếu ví nhận, chưa thể hoàn tác an toàn.');
    if (tx.type === 'internal' && toRef && to) {
      const balance = debitBalance(to.data() as Account, tx.amount, true);
      if (goalRef && (!goal?.exists() || goal.data()?.saved < tx.amount)) throw new Error('Mục tiêu không đủ tiền để hoàn tác.');
      t.update(toRef, { balance });
      if (goalRef && goal) { t.update(goalRef, { saved: goal.data()?.saved - tx.amount }); t.update(doc(db, 'users', uid), { allocatedSavings: Math.max(0, (profile.data()?.allocatedSavings || 0) - tx.amount) }); }
      if (!goalRef && to.data()?.type === 'savings' && balance < (profile.data()?.allocatedSavings || 0)) throw new Error('Khoản tiền này đang được giữ cho mục tiêu.');
    }
    t.update(accRef, { balance: tx.type === 'income' ? debitBalance(acc.data() as Account, tx.amount, true) : acc.data().balance + tx.amount });
    if (planRef && plan?.exists()) t.update(planRef, { completed: false, paymentTransactionId: null });
    t.update(ref, { status: pendingOnly ? 'cancelled' : 'deleted' });
  });
}
export async function addPlannedExpense(uid: string, plan: PlannedExpense) {
  assertMoney(plan.amount);
  await setDoc(userDoc(uid, 'plannedExpenses', plan.id), plan);
}
export async function completePlannedExpense(uid: string, plan: PlannedExpense, accountId: string, todayIndex: number) {
  const txId = `tx-plan-${plan.id}`;
  await runTransaction(db, async t => {
    const planRef = userDoc(uid, 'plannedExpenses', plan.id);
    const accRef = userDoc(uid, 'accounts', accountId);
    const [p, acc, profile] = await Promise.all([t.get(planRef), t.get(accRef), t.get(doc(db, 'users', uid))]);
    if (!p.exists()) throw new Error('Khoản dự kiến không còn tồn tại.');
    if (p.data().completed) return;
    const savedPlan = p.data() as PlannedExpense;
    const balance = debitBalance(acc.exists() ? acc.data() as Account : undefined, savedPlan.amount);
    const tx: Transaction = { id: txId, merchant: savedPlan.title, note: 'Thanh toán khoản dự kiến', category: savedPlan.category, accountId, amount: savedPlan.amount, type: 'expense', status: 'confirmed', cycleDayIndex: todayIndex, timeLabel: 'Theo dự kiến', plannedExpenseId: plan.id };
    t.update(planRef, { completed: true });
    t.update(accRef, { balance });
    t.set(userDoc(uid, 'transactions', txId), stamp(tx, profile.data()?.salaryConfig?.paydayDay || 5));
  });
}
export async function sweepSurplusToSavings(uid: string, fromAccountId: string, savingsAccountId: string, goalId: string | null, amount: number, todayIndex: number) {
  const tx: Transaction = { id: crypto.randomUUID(), merchant: 'Cất vào tiết kiệm', note: 'Chuyển từ ví nguồn', category: 'living', accountId: fromAccountId, amount, type: 'internal', status: 'confirmed', cycleDayIndex: todayIndex, timeLabel: 'Vừa ghi nhận', ...(goalId ? { goalId } : {}) };
  await transferInternalWallets(uid, fromAccountId, savingsAccountId, amount, tx);
}
function validateSalaryConfig(config: SalaryConfig) {
  if (![config.monthlyIncome, config.fixedBills, config.savingsTarget].every(n => Number.isSafeInteger(n) && n >= 0) || config.monthlyIncome <= 0 || config.fixedBills + config.savingsTarget > config.monthlyIncome) throw new Error('Chi phí cố định và tiết kiệm không được vượt thu nhập.');
  if (!Number.isInteger(config.paydayDay) || config.paydayDay < 1 || config.paydayDay > 31) throw new Error('Ngày nhận lương phải từ 1 đến 31.');
}
export async function saveSalarySettings(uid: string, salaryConfig: SalaryConfig, rolloverMode: RolloverMode) {
  validateSalaryConfig(salaryConfig);
  await updateDoc(doc(db, 'users', uid), { salaryConfig, rolloverMode });
}
export async function transferInternalWallets(uid: string, fromId: string, toId: string, amount: number, tx: Transaction) {
  assertMoney(amount);
  if (fromId === toId) throw new Error('Ví nguồn và ví nhận phải khác nhau.');
  await runTransaction(db, async t => {
    const fromRef = userDoc(uid, 'accounts', fromId), toRef = userDoc(uid, 'accounts', toId);
    const txRef = userDoc(uid, 'transactions', tx.id);
    const goalRef = tx.goalId ? userDoc(uid, 'goals', tx.goalId) : null;
    const [old, from, to, goal, profile] = await Promise.all([t.get(txRef), t.get(fromRef), t.get(toRef), goalRef ? t.get(goalRef) : null, t.get(doc(db, 'users', uid))]);
    if (old.exists()) return;
    if (!to.exists()) throw new Error('Không tìm thấy ví nhận.');
    if (goalRef && (!goal?.exists() || to.data().type !== 'savings')) throw new Error('Chọn mục tiêu và ví tiết kiệm hợp lệ.');
    const balance = debitBalance(from.exists() ? from.data() as Account : undefined, amount, true);
    if (from.data()?.type === 'savings') {
      // Goal-backed money cannot leave the savings wallet through a generic transfer.
      const allocated = profile.data()?.allocatedSavings || 0;
      if (balance < allocated) throw new Error('Tiền đã phân bổ cho mục tiêu; cần hoàn tác khoản góp mục tiêu trước.');
    }
    t.update(fromRef, { balance });
    t.update(toRef, { balance: to.data().balance + amount });
    if (goalRef && goal) {
      t.update(goalRef, { saved: goal.data()?.saved + amount });
      t.update(doc(db, 'users', uid), { allocatedSavings: (profile.data()?.allocatedSavings || 0) + amount });
    }
    t.set(txRef, stamp({ ...tx, type: 'internal', status: 'confirmed', accountId: fromId, amount, destinationAccountId: toId, savingsDirection: (to.data().type === 'savings' ? 1 : 0) - (from.data()?.type === 'savings' ? 1 : 0) }, profile.data()?.salaryConfig?.paydayDay || 5));
  });
}
export async function saveGoal(uid: string, goal: SavingsGoal) {
  assertMoney(goal.target);
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'goals', goal.id);
    const snap = await t.get(ref);
    if (snap.exists()) return;
    t.set(ref, { ...goal, saved: 0 });
  });
}

export async function addPausedItemDoc(uid: string, item: PausedItem) {
  await setDoc(doc(db, 'users', uid, 'pausedItems', item.id), item);
}

export async function skipPausedItemDoc(uid: string, item: PausedItem) {
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'pausedItems', item.id);
    const [saved, profile] = await Promise.all([t.get(ref), t.get(doc(db, 'users', uid))]);
    if (!saved.exists()) return;
    t.delete(ref);
    t.update(doc(db, 'users', uid), { avoidedImpulseTotal: (profile.data()?.avoidedImpulseTotal || 0) + saved.data().amount });
  });
}

export async function updateSharedGroupDoc(group: SharedGroup) {
  await setDoc(doc(db, 'groups', group.id), group);
}

// ============================================================================
// GROUP INVITATION FUNCTIONS
// ============================================================================

/** Send an invitation email to another user to join the caller's shared group. */
export async function sendGroupInvitation(
  fromUid: string,
  fromName: string,
  groupId: string,
  toEmail: string
): Promise<GroupInvitation> {
  // Check no pending invite already exists for this email+group
  const existing = await getDocs(
    query(
      collection(db, 'invitations'),
      where('groupId', '==', groupId),
      where('toEmail', '==', toEmail.toLowerCase()),
      where('status', '==', 'pending')
    )
  );
  if (!existing.empty) throw new Error('Đã có lời mời đang chờ cho email này.');

  const inv: GroupInvitation = {
    id: crypto.randomUUID(),
    groupId,
    fromUid,
    fromName,
    toEmail: toEmail.toLowerCase(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'invitations', inv.id), inv);
  return inv;
}

/** Accept a group invitation: adds the caller to the group as a member. */
export async function acceptGroupInvitation(
  invitationId: string,
  joiningUser: { uid: string; displayName: string; email: string }
): Promise<void> {
  await runTransaction(db, async t => {
    const invRef = doc(db, 'invitations', invitationId);
    const invSnap = await t.get(invRef);
    if (!invSnap.exists()) throw new Error('Lời mời không tồn tại.');
    const inv = invSnap.data() as GroupInvitation;
    if (inv.status !== 'pending') throw new Error('Lời mời này đã được xử lý.');
    if (inv.toEmail !== joiningUser.email.toLowerCase())
      throw new Error('Email không khớp với lời mời.');

    const groupRef = doc(db, 'groups', inv.groupId);
    const groupSnap = await t.get(groupRef);
    if (!groupSnap.exists()) throw new Error('Nhóm không còn tồn tại.');
    const group = groupSnap.data() as SharedGroup;

    if (group.memberUids.includes(joiningUser.uid)) {
      // Already a member, just mark accepted
      t.update(invRef, { status: 'accepted' });
      return;
    }

    const newMember: GroupMember = {
      uid: joiningUser.uid,
      displayName: joiningUser.displayName,
      email: joiningUser.email.toLowerCase(),
      joinedAt: new Date().toISOString(),
    };

    t.update(groupRef, {
      memberUids: [...group.memberUids, joiningUser.uid],
      members: [...(group.members || []), newMember],
      typeLabel: 'Nhóm',
      activities: [
        `${joiningUser.displayName} đã tham gia nhóm`,
        ...(group.activities || []),
      ].slice(0, 20),
    });
    t.update(invRef, { status: 'accepted' });
  });
}

/** Decline an invitation. */
export async function declineGroupInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(db, 'invitations', invitationId), { status: 'declined' });
}

/** Subscribe to pending invitations for the current user's email. */
export function subscribePendingInvitations(
  email: string,
  onInvitations: (invitations: GroupInvitation[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'invitations'),
      where('toEmail', '==', email.toLowerCase()),
      where('status', '==', 'pending')
    ),
    snap => onInvitations(snap.docs.map(d => d.data() as GroupInvitation))
  );
}

/** Add an expense to the shared group. */
export async function addSharedExpense(
  groupId: string,
  expense: import('../types/finance').SharedExpense,
  activityLabel: string
): Promise<void> {
  await runTransaction(db, async t => {
    const ref = doc(db, 'groups', groupId);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('Nhóm không tồn tại.');
    const group = snap.data() as SharedGroup;
    t.update(ref, {
      expenses: [...(group.expenses || []), expense],
      activities: [activityLabel, ...(group.activities || [])].slice(0, 30),
    });
  });
}

/** Remove a member from the group (owner only). */
export async function removeMemberFromGroup(groupId: string, ownerUid: string, targetUid: string): Promise<void> {
  await runTransaction(db, async t => {
    const ref = doc(db, 'groups', groupId);
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('Nhóm không tồn tại.');
    const group = snap.data() as SharedGroup;
    if (group.ownerUid !== ownerUid) throw new Error('Chỉ chủ nhóm mới có quyền xóa thành viên.');
    t.update(ref, {
      memberUids: group.memberUids.filter(u => u !== targetUid),
      members: (group.members || []).filter(m => m.uid !== targetUid),
      typeLabel: group.memberUids.filter(u => u !== targetUid).length > 1 ? 'Nhóm' : 'Cá nhân',
    });
  });
}

// ============================================================================
// SAAS LICENSING & ADMIN ACCOUNT SELLING FUNCTIONS
// ============================================================================

export async function activateLicenseKey(uid: string, rawCode: string): Promise<PlanType> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error('Vui lòng nhập mã kích hoạt.');

  const keyRef = doc(db, 'licenseKeys', code);
  const keySnap = await getDoc(keyRef);
  if (!keySnap.exists()) {
    throw new Error('Mã kích hoạt không tồn tại.');
  }

  const keyData = keySnap.data() as LicenseKey;
  if (!keyData.active || keyData.usedBy) {
    throw new Error('Mã này đã được sử dụng hoặc đã bị vô hiệu hóa.');
  }

  const now = new Date();
  const expiresAt =
    keyData.plan === 'lifetime'
      ? null
      : new Date(now.getTime() + keyData.durationDays * 24 * 60 * 60 * 1000).toISOString();

  const batch = writeBatch(db);
  batch.update(keyRef, {
    usedBy: uid,
    usedAt: now.toISOString(),
  });
  batch.update(doc(db, 'users', uid), {
    plan: keyData.plan,
    subscriptionStatus: 'active',
    planExpiresAt: expiresAt,
    lastLicenseCode: code,
  });

  await batch.commit();
  return keyData.plan;
}

export async function generateLicenseKeyAsAdmin(
  adminUid: string,
  plan: PlanType,
  durationDays: number,
  note: string
): Promise<LicenseKey> {
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const code = `VIAN-${plan.toUpperCase()}-${randomSuffix}`;
  const payload: LicenseKey = {
    code,
    plan,
    durationDays,
    active: true,
    usedBy: null,
    usedAt: null,
    createdBy: adminUid,
    note,
  };
  await setDoc(doc(db, 'licenseKeys', code), payload);
  return payload;
}

export async function addWallet(uid: string, account: Account) {
  if (!account.name.trim() || !Number.isSafeInteger(account.balance) || account.balance < 0 || account.type === 'savings') throw new Error('Kiểm tra tên ví và số dư ban đầu.');
  const txId = crypto.randomUUID();
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'accounts', account.id);
    const [old, profile] = await Promise.all([t.get(ref), t.get(doc(db, 'users', uid))]);
    if (old.exists()) throw new Error('Bạn đã có ví này. Chọn ví hiện tại để thêm thu nhập.');
    t.set(ref, account);
    if (account.balance > 0) t.set(userDoc(uid, 'transactions', txId), stamp({ id: txId, merchant: 'Số dư ban đầu', note: 'Khi thêm ví', category: 'living', accountId: account.id, amount: account.balance, type: 'income', status: 'confirmed', cycleDayIndex: getSalaryCycle(profile.data()?.salaryConfig?.paydayDay || 5).todayIndex, timeLabel: 'Số dư ban đầu' }, profile.data()?.salaryConfig?.paydayDay || 5));
  });
}

export async function depositToWallet(uid: string, accountId: string, amount: number, todayIndex = 0, operationId = crypto.randomUUID()): Promise<void> {
  assertMoney(amount);
  await runTransaction(db, async t => {
    const ref = userDoc(uid, 'accounts', accountId), txRef = userDoc(uid, 'transactions', operationId);
    const [acc, old, profile] = await Promise.all([t.get(ref), t.get(txRef), t.get(doc(db, 'users', uid))]);
    if (old.exists()) return;
    if (!acc.exists()) throw new Error('Không tìm thấy ví.');
    if (acc.data().type === 'savings') throw new Error('Ghi thu nhập vào ví chi tiêu, rồi chuyển sang tiết kiệm.');
    t.update(ref, { balance: acc.data().balance + amount });
    t.set(txRef, stamp({ id: operationId, merchant: 'Thêm thu nhập', note: 'Tiền thực nhận vào ví', category: 'living', accountId, amount, type: 'income', status: 'confirmed', cycleDayIndex: todayIndex, timeLabel: 'Vừa ghi nhận' }, profile.data()?.salaryConfig?.paydayDay || 5));
  });
}

export async function setupInitialFinance(uid: string, salaryConfig: SalaryConfig, wallets: Account[]): Promise<void> {
  validateSalaryConfig(salaryConfig);
  if (!wallets.length || new Set(wallets.map(w => w.id)).size !== wallets.length || !wallets.some(w => w.type !== 'savings')) throw new Error('Chọn ít nhất một ví chi tiêu.');
  for (const wallet of wallets) {
    if (!Number.isSafeInteger(wallet.balance) || wallet.balance < 0 || !wallet.name.trim()) throw new Error('Kiểm tra số dư và tên từng ví.');
  }
  await runTransaction(db, async t => {
    const refs = wallets.map(w => userDoc(uid, 'accounts', w.id));
    const previous = await Promise.all(refs.map(ref => t.get(ref)));
    if (previous.some(snap => snap.exists())) throw new Error('Ví đã được thiết lập ở phiên khác. Vui lòng tải lại trang.');
    t.update(doc(db, 'users', uid), {
      salaryConfig,
      allocatedSavings: 0,
      lastPaydayConfirmedCycleKey: getSalaryCycle(salaryConfig.paydayDay).key,
    });
    wallets.forEach((wallet, i) => t.set(refs[i], wallet));
  });
}

/** Payday check-in: deposits salary into chosen wallet and resets budget for the new cycle. */
export async function confirmPaydayCycle(
  uid: string,
  payload: {
    accountId: string;
    depositAmount: number;
    savingsTarget: number;
    fixedBills: number;
    paydayDay: number;
    cycleKey: string;
    todayIndex: number;
    totalCycleDays: number;
  }
): Promise<void> {
  assertMoney(payload.depositAmount);
  const nextConfig: SalaryConfig = {
    monthlyIncome: payload.depositAmount,
    fixedBills: payload.fixedBills,
    savingsTarget: payload.savingsTarget,
    paydayDay: payload.paydayDay,
    totalCycleDays: payload.totalCycleDays,
    todayIndex: payload.todayIndex,
    cycleStartDayIndex: payload.todayIndex,
  };
  validateSalaryConfig(nextConfig);
  const txId = crypto.randomUUID();
  await runTransaction(db, async t => {
    const accRef = userDoc(uid, 'accounts', payload.accountId);
    const txRef = userDoc(uid, 'transactions', txId);
    const acc = await t.get(accRef);
    if (!acc.exists()) throw new Error('Không tìm thấy ví để nạp lương.');
    t.update(accRef, { balance: acc.data().balance + payload.depositAmount });
    t.set(txRef, {
      id: txId,
      merchant: 'Nhận lương chu kỳ mới',
      note: `Nạp lương & phân bổ ngân sách (${payload.cycleKey})`,
      category: 'living',
      accountId: payload.accountId,
      amount: payload.depositAmount,
      type: 'income',
      status: 'confirmed',
      cycleDayIndex: payload.todayIndex,
      timeLabel: 'Nhận lương',
      createdAt: new Date().toISOString(),
      cycleStartDate: payload.cycleKey,
    });
    t.update(doc(db, 'users', uid), {
      salaryConfig: nextConfig,
      lastPaydayConfirmedCycleKey: payload.cycleKey,
    });
  });
}

export async function fetchAllLicenseKeysAsAdmin(): Promise<LicenseKey[]> {
  const snap = await getDocs(collection(db, 'licenseKeys'));
  return snap.docs.map((d) => d.data() as LicenseKey);
}

/**
 * Deletes all seeded/existing user transactions, plannedExpenses, goals, pausedItems,
 * resets all wallet balances & salaryConfig to 0, and resets the user's shared group.
 */
export async function resetUserDataToBlank(uid: string): Promise<void> {
  const subcollections = ['transactions', 'plannedExpenses', 'goals', 'pausedItems', 'accounts'];
  const batch = writeBatch(db);

  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'users', uid, sub));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }

  const blankAccounts: Account[] = [
    { id: 'mbbank', name: 'MB Bank', balance: 0, type: 'checking' },
    { id: 'vcb', name: 'Vietcombank', balance: 0, type: 'checking' },
    { id: 'cash', name: 'Tiền mặt', balance: 0, type: 'cash' },
    { id: 'savings', name: 'Tài khoản Tiết kiệm', balance: 0, type: 'savings' },
  ];
  for (const acc of blankAccounts) {
    batch.set(doc(db, 'users', uid, 'accounts', acc.id), acc);
  }

  batch.update(doc(db, 'users', uid), {
    salaryConfig: {
      monthlyIncome: 0,
      paydayDay: 5,
      fixedBills: 0,
      savingsTarget: 0,
      totalCycleDays: 30,
      todayIndex: 15,
    },
    avoidedImpulseTotal: 0,
  });

  batch.set(doc(db, 'groups', `group-${uid}`), {
    id: `group-${uid}`,
    ownerUid: uid,
    memberUids: [uid],
    name: 'Quỹ chung',
    typeLabel: 'Cá nhân',
    monthlyBudget: 0,
    sharedGoal: { title: '', saved: 0, target: 0 },
    expenses: [],
    activities: [],
  });

  await batch.commit();
}

const FINANCE_COLLECTIONS = ['accounts', 'transactions', 'plannedExpenses', 'goals', 'pausedItems'] as const;

/** Reversible, owner-scoped reset for the explicitly designated test account. */
export async function resetTestFinanceWithBackup(uid: string) {
  const records = (await Promise.all(FINANCE_COLLECTIONS.map(async sub => {
    const snap = await getDocs(collection(db, 'users', uid, sub));
    return snap.docs.map(d => ({ sub, id: d.id, ref: d.ref }));
  }))).flat();
  if (records.length > 200) throw new Error('Có quá nhiều bản ghi để đặt lại an toàn trong một lần.');
  await runTransaction(db, async t => {
    const userRef = doc(db, 'users', uid);
    const [profile, ...snapshots] = await Promise.all([t.get(userRef), ...records.map(record => t.get(record.ref))]);
    const user = profile.data() as UserProfile;
    if (user.email?.toLowerCase() !== 'hung@gmail.com' || user.role !== 'admin') throw new Error('Chức năng này chỉ dành cho tài khoản thử đã được chỉ định.');
    if (user.financeTestBackup) throw new Error('Đã có bản sao trước đó. Khôi phục hoặc giữ bản sao này trước khi tạo lần mới.');
    const backup = {
      createdAt: new Date().toISOString(),
      salaryConfig: user.salaryConfig,
      rolloverMode: user.rolloverMode,
      avoidedImpulseTotal: user.avoidedImpulseTotal || 0,
      allocatedSavings: profile.data()?.allocatedSavings || 0,
      records: records.flatMap((record, i) => snapshots[i].exists() ? [{ sub: record.sub, id: record.id, data: snapshots[i].data() }] : []),
      accounts: Object.fromEntries(records.flatMap((record, i) => record.sub === 'accounts' && snapshots[i].exists() ? [[record.id, snapshots[i].data()]] : [])),
    };
    if (new TextEncoder().encode(JSON.stringify(backup)).length > 700000) throw new Error('Bản sao quá lớn để lưu an toàn. Chưa thay đổi dữ liệu.');
    t.update(userRef, { financeTestBackup: backup, salaryConfig: { monthlyIncome: 0, fixedBills: 0, savingsTarget: 0, paydayDay: 5, totalCycleDays: 30, todayIndex: 0 }, avoidedImpulseTotal: 0, allocatedSavings: 0 });
    records.forEach(record => t.delete(record.ref));
  });
}

export async function restoreTestFinanceBackup(uid: string) {
  // Older snapshots predate the indexed account map used by the restore rule.
  const before = await getDoc(doc(db, 'users', uid));
  const previousBackup = (before.data() as UserProfile)?.financeTestBackup;
  if (previousBackup && !previousBackup.accounts) {
    await updateDoc(doc(db, 'users', uid), { financeTestBackup: { ...previousBackup, accounts: Object.fromEntries(previousBackup.records.filter(record => record.sub === 'accounts').map(record => [record.id, record.data])) } });
  }
  const current = (await Promise.all(FINANCE_COLLECTIONS.map(async sub => (await getDocs(collection(db, 'users', uid, sub))).docs.map(d => d.ref)))).flat();
  await runTransaction(db, async t => {
    const userRef = doc(db, 'users', uid);
    const profile = await t.get(userRef);
    const user = profile.data() as UserProfile;
    const backup = user.financeTestBackup;
    if (user.email?.toLowerCase() !== 'hung@gmail.com' || user.role !== 'admin' || !backup) throw new Error('Không tìm thấy bản sao của tài khoản thử.');
    if (current.length + backup.records.length > 450) throw new Error('Quá nhiều bản ghi để khôi phục trong một lần.');
    current.forEach(ref => t.delete(ref));
    backup.records.forEach(record => t.set(userDoc(uid, record.sub, record.id), record.data));
    t.update(userRef, { salaryConfig: backup.salaryConfig, rolloverMode: backup.rolloverMode, avoidedImpulseTotal: backup.avoidedImpulseTotal, allocatedSavings: backup.allocatedSavings, financeTestBackup: null });
  });
}
