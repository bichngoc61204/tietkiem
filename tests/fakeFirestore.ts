// In-memory test double with optimistic retries; not a Firebase security-rules emulator.
import { currentSalaryConfig, getSalaryCycle } from '../src/utils/cycle';
type Data = Record<string, any>;
type Ref = { path: string; filters?: any[] };
type Write = { ref: Ref; kind: 'set' | 'update' | 'delete'; data?: Data };
let rows = new Map<string, Data>();
let version = 0;
const listeners = new Set<() => void>();
export type Unsubscribe = () => void;
export const doc = (_db: unknown, ...path: string[]): Ref => ({ path: path.join('/') });
export const collection = doc;
export const orderBy = (..._args: any[]) => ({});
export const where = (field: string, op: string, value: unknown) => ({ field, op, value });
export const query = (ref: Ref, ...filters: any[]) => ({ ...ref, filters });
export const increment = (by: number) => ({ __increment: by });
const clone = (data: any) => data === undefined ? undefined : structuredClone(data);
const snapshot = (ref: Ref, source = rows) => ({ exists: () => source.has(ref.path), data: () => clone(source.get(ref.path)), id: ref.path.split('/').pop(), ref });
function list(ref: Ref) {
  const docs = [...rows.keys()].filter(path => path.startsWith(ref.path + '/') && path.split('/').length === ref.path.split('/').length + 1).map(path => snapshot({ path })).filter(d => !ref.filters || ref.filters.every(f => !f.field || (f.op === 'array-contains' ? d.data()[f.field]?.includes(f.value) : d.data()[f.field] === f.value)));
  return { docs, empty: docs.length === 0 };
}
const broadcast = () => queueMicrotask(() => listeners.forEach(fn => fn()));
function commit(writes: Write[]) {
  const next = new Map(rows);
  for (const { ref, kind, data } of writes) {
    if (kind === 'delete') { next.delete(ref.path); continue; }
    if (kind === 'update' && !next.has(ref.path)) throw new Error('not-found: ' + ref.path);
    const value = kind === 'update' ? clone(next.get(ref.path)) : {};
    for (const [key, val] of Object.entries(data || {})) value[key] = val && typeof val === 'object' && '__increment' in val ? (value[key] || 0) + val.__increment : clone(val);
    next.set(ref.path, value);
  }
  rows = next; version++; broadcast();
}
export async function runTransaction(_db: unknown, fn: (t: any) => Promise<any>) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const readVersion = version, source = new Map(rows), writes: Write[] = [];
    let hasWritten = false;
    const t = {
      get: async (ref: Ref) => { if (hasWritten) throw new Error('Firestore requires all reads before writes'); return snapshot(ref, source); },
      set: (ref: Ref, data: Data) => { hasWritten = true; writes.push({ ref, data, kind: 'set' }); },
      update: (ref: Ref, data: Data) => { hasWritten = true; writes.push({ ref, data, kind: 'update' }); },
      delete: (ref: Ref) => { hasWritten = true; writes.push({ ref, kind: 'delete' }); },
    };
    const result = await fn(t);
    if (version !== readVersion) continue;
    if (writes.length) commit(writes);
    return result;
  }
  throw new Error('Too much contention');
}
export const getDoc = async (ref: Ref) => snapshot(ref);
export const getDocs = async (ref: Ref) => list(ref);
export const setDoc = async (ref: Ref, data: Data) => { commit([{ ref, data, kind: 'set' }]); };
export const updateDoc = async (ref: Ref, data: Data) => { commit([{ ref, data, kind: 'update' }]); };
export function writeBatch(_db: unknown) {
  const writes: Write[] = [];
  return { set: (ref: Ref, data: Data) => writes.push({ ref, data, kind: 'set' }), update: (ref: Ref, data: Data) => writes.push({ ref, data, kind: 'update' }), delete: (ref: Ref) => writes.push({ ref, kind: 'delete' }), commit: async () => { commit(writes); } };
}
export function onSnapshot(ref: Ref, callback: (snap: any) => void, _error?: (error: Error) => void) {
  const fn = () => callback(ref.path.split('/').length % 2 ? list(ref) : snapshot(ref));
  listeners.add(fn); queueMicrotask(fn); return () => { listeners.delete(fn); };
}
export function reset(data: Record<string, Data>) { rows = new Map(Object.entries(clone(data))); version++; broadcast(); }
export const read = (path: string) => clone(rows.get(path));
export const allRows = () => Object.fromEntries(rows);
export function seedQA() {
  const salaryConfig = currentSalaryConfig({ monthlyIncome: 15000000, paydayDay: 5, fixedBills: 3000000, savingsTarget: 3000000, totalCycleDays: 30, todayIndex: 0 });
  const common = { category: 'food', accountId: 'mbbank', type: 'expense', status: 'confirmed', cycleStartDate: getSalaryCycle(5).key, cycleDayIndex: salaryConfig.todayIndex, createdAt: new Date().toISOString(), timeLabel: 'Hôm nay', note: '' };
  reset({
    'users/qa-user': { uid: 'qa-user', email: 'qa@example.test', displayName: 'Bản thử nghiệm', role: 'user', plan: 'trial', subscriptionStatus: 'trial', planExpiresAt: null, lastLicenseCode: null, salaryConfig, rolloverMode: 'strict', avoidedImpulseTotal: 0, allocatedSavings: 0, createdAt: new Date().toISOString() },
    'users/qa-user/accounts/mbbank': { id: 'mbbank', name: 'MB Bank', balance: 11885000, type: 'checking' },
    'users/qa-user/accounts/cash': { id: 'cash', name: 'Tiền mặt', balance: 500000, type: 'cash' },
    'users/qa-user/accounts/savings': { id: 'savings', name: 'Tiết kiệm', balance: 3000000, type: 'savings' },
    'users/qa-user/transactions/lunch': { ...common, id: 'lunch', merchant: 'Cơm trưa', amount: 45000 },
    'users/qa-user/transactions/grocery': { ...common, id: 'grocery', merchant: 'Đi chợ', category: 'living', amount: 70000 },
    'users/qa-user/goals/emergency': { id: 'emergency', title: 'Quỹ dự phòng', saved: 0, target: 30000000, monthlyHint: 'Góp dần theo khả năng' },
    'users/qa-user/plannedExpenses/insurance': { id: 'insurance', title: 'Bảo hiểm xe', amount: 500000, category: 'transport', dueDateLabel: 'Cuối kỳ', completed: false },
    'groups/group-qa-user': { id: 'group-qa-user', name: 'Quỹ chung', typeLabel: 'Cá nhân', ownerUid: 'qa-user', memberUids: ['qa-user'], monthlyBudget: 0, sharedGoal: { title: '', saved: 0, target: 0 }, expenses: [], activities: [] },
  });
}
seedQA();
