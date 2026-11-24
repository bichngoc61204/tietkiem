import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { useTestDatabase } from './emulatorFirebase';
import { resetTestFinanceWithBackup, restoreTestFinanceBackup, createPendingTransactionWithHold, confirmPendingTransaction, cancelPendingTransactionWithRefund, recordExpenseAndDeductWallet, sweepSurplusToSavings, deleteTransactionAndRestoreWallet, depositToWallet, completePlannedExpense } from '../src/services/firestoreService';
import type { Transaction } from '../src/types/finance';
const host = process.env.FIRESTORE_EMULATOR_HOST || '';
if (!/^127\.0\.0\.1:\d+$/.test(host)) throw new Error('Refusing to run without a loopback FIRESTORE_EMULATOR_HOST.');
const env = await initializeTestEnvironment({ projectId: 'demo-vian-tests', firestore: { host: '127.0.0.1', port: Number(host.split(':')[1]), rules: await readFile('firestore.rules', 'utf8') } });
let count = 0;
const uid = 'integration-user';
const db = env.authenticatedContext(uid, { email: 'qa@example.test' }).firestore();
useTestDatabase(db);
const ref = (...parts: string[]) => doc(db, 'users', uid, ...parts);
const balance = async (id = 'bank') => (await getDoc(ref('accounts', id))).data()!.balance;
const tx = (id: string, amount = 100000): Transaction => ({ id, merchant: 'Integration test', note: '', category: 'food', accountId: 'bank', amount, type: 'expense', status: 'pending', cycleDayIndex: 0 });
async function check(name: string, fn: () => Promise<unknown>) { await fn(); count++; console.log(`✓ Emulator: ${name}`); }
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, 'users', uid), { uid, role: 'user', email: 'qa@example.test', plan: 'trial', subscriptionStatus: 'trial', planExpiresAt: null, salaryConfig: { paydayDay: 5 }, allocatedSavings: 0 });
    await setDoc(doc(admin, 'users', uid, 'accounts', 'bank'), { id: 'bank', name: 'Bank', type: 'checking', balance: 1000000 });
    await setDoc(doc(admin, 'users', uid, 'accounts', 'savings'), { id: 'savings', name: 'Savings', type: 'savings', balance: 0 });
    await setDoc(doc(admin, 'users', uid, 'goals', 'goal'), { id: 'goal', title: 'Goal', saved: 0, target: 2000000 });
    await setDoc(doc(admin, 'users', uid, 'plannedExpenses', 'plan'), { id: 'plan', title: 'Plan', category: 'living', amount: 50000, completed: false });
  });
  await check('atomic QR hold under actual rules', async () => { await Promise.all([createPendingTransactionWithHold(uid, tx('qr')), createPendingTransactionWithHold(uid, tx('qr'))]); assert.equal(await balance(), 900000); });
  await check('confirmation never debits twice', async () => { await Promise.all([confirmPendingTransaction(uid, 'qr'), confirmPendingTransaction(uid, 'qr')]); assert.equal(await balance(), 900000); });
  await check('stale cancel on confirmed transaction rejected', async () => { await assert.rejects(cancelPendingTransactionWithRefund(uid, tx('qr'))); assert.equal(await balance(), 900000); });
  await check('double cancellation refunds once', async () => { await createPendingTransactionWithHold(uid, tx('cancel')); await Promise.all([cancelPendingTransactionWithRefund(uid, tx('cancel')), cancelPendingTransactionWithRefund(uid, tx('cancel'))]); assert.equal(await balance(), 900000); });
  await check('concurrent writes cannot overdraw actual wallet', async () => { const result = await Promise.allSettled([recordExpenseAndDeductWallet(uid, tx('a', 700000)), recordExpenseAndDeductWallet(uid, tx('b', 700000))]); assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(await balance(), 200000); });
  await check('goal funding moves real documents atomically', async () => { await sweepSurplusToSavings(uid, 'bank', 'savings', 'goal', 100000, 0); assert.equal(await balance(), 100000); assert.equal(await balance('savings'), 100000); assert.equal((await getDoc(ref('goals', 'goal'))).data()!.saved, 100000); });
  await check('income record and undo supported by rules', async () => { await depositToWallet(uid, 'bank', 300000, 0, 'income'); assert.equal(await balance(), 400000); await deleteTransactionAndRestoreWallet(uid, tx('income')); assert.equal(await balance(), 100000); });
  await check('QR consumes and cancels planned reserve atomically', async () => { const planned = { ...tx('qr-plan', 50000), plannedExpenseId: 'plan' }; await createPendingTransactionWithHold(uid, planned); assert.equal((await getDoc(ref('plannedExpenses','plan'))).data()!.completed,true); await cancelPendingTransactionWithRefund(uid, planned); assert.equal((await getDoc(ref('plannedExpenses','plan'))).data()!.completed,false); assert.equal(await balance(),100000); });
  await check('planned payment commits once', async () => { const plan = (await getDoc(ref('plannedExpenses', 'plan'))).data() as any; await Promise.all([completePlannedExpense(uid, plan, 'bank', 0), completePlannedExpense(uid, plan, 'bank', 0)]); assert.equal(await balance(), 50000); });
  await check('test-account backup/reset/restore works under actual rules', async () => {
    const testUid = 'designated-reset-user';
    const testDb = env.authenticatedContext(testUid,{email:'hung@gmail.com'}).firestore();
    await setDoc(doc(testDb,'users',testUid),{email:'hung@gmail.com',role:'admin',plan:'lifetime',subscriptionStatus:'active',planExpiresAt:null,salaryConfig:{monthlyIncome:1000000,paydayDay:5,fixedBills:0,savingsTarget:0,totalCycleDays:30,todayIndex:0},rolloverMode:'strict',avoidedImpulseTotal:0});
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(),'users',testUid,'accounts','cash'),{id:'cash',name:'Cash',type:'cash',balance:-1000000}); });
    useTestDatabase(testDb);
    await resetTestFinanceWithBackup(testUid);
    assert.equal((await getDoc(doc(testDb,'users',testUid,'accounts','cash'))).exists(),false);
    assert.equal((await getDoc(doc(testDb,'users',testUid))).data()!.financeTestBackup.records.length,1);
    await restoreTestFinanceBackup(testUid);
    assert.equal((await getDoc(doc(testDb,'users',testUid,'accounts','cash'))).data()!.balance,-1000000);
    await assertFails(updateDoc(doc(testDb,'users',testUid,'accounts','cash'),{balance:-2000000}));
    useTestDatabase(db);
  });
  await check('other user cannot read or change wallet', async () => { const other = env.authenticatedContext('other', { email: 'other@example.test' }).firestore(); await assertFails(getDoc(doc(other, 'users', uid, 'accounts', 'bank'))); await assertFails(updateDoc(doc(other, 'users', uid, 'accounts', 'bank'), { balance: 100000000 })); });
  await check('negative balances denied by rules', async () => { await assertFails(updateDoc(ref('accounts', 'bank'), { balance: -1 })); });
  await check('unsigned clients denied', async () => { await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', uid, 'accounts', 'bank'))); });
  console.log(`${count} Firestore Emulator integration checks passed.`);
} finally { await env.cleanup(); }
