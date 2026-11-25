import assert from 'node:assert/strict';
import { reset, read } from './fakeFirestore';
import { resetTestFinanceWithBackup, restoreTestFinanceBackup, addWallet, setupInitialFinance, saveSalarySettings, createPendingTransactionWithHold, confirmPendingTransaction, cancelPendingTransactionWithRefund, recordExpenseAndDeductWallet, deleteTransactionAndRestoreWallet, completePlannedExpense, sweepSurplusToSavings, transferInternalWallets, depositToWallet } from '../src/services/firestoreService';
import { calculateCycleBudgetMetrics as budget, previewPaymentImpact, transactionsInCycle } from '../src/utils/budgetEngine';
import { getSalaryCycle } from '../src/utils/cycle';
import { crc16, parseVietQRPayload, buildBankAppDeeplink, SENDER_BANKS, bankForWallet, bankLaunchHref } from '../src/utils/vietqr';
import { prepareBankHandoff, reserveBankHandoff } from '../src/utils/bankHandoff';
import type { Transaction, SalaryConfig } from '../src/types/finance';
let count = 0;
async function test(name: string, fn: () => unknown) { await fn(); count++; console.log(`✓ ${name}`); }
const uid = 'test', base = `users/${uid}`;
const acc = (id = 'bank') => read(`${base}/accounts/${id}`);
const tx = (id: string, amount = 100000): Transaction => ({ id, merchant: 'Test', note: '', category: 'food', accountId: 'bank', amount, type: 'expense', status: 'confirmed', cycleDayIndex: 0 });
const setup = () => reset({ [base]: { salaryConfig: { paydayDay: 5 }, allocatedSavings: 0 }, [`${base}/accounts/bank`]: { id: 'bank', name: 'Bank', type: 'checking', balance: 1000000 }, [`${base}/accounts/cash`]: { id: 'cash', name: 'Cash', type: 'cash', balance: 0 }, [`${base}/accounts/savings`]: { id: 'savings', name: 'Savings', type: 'savings', balance: 0 }, [`${base}/goals/goal`]: { id: 'goal', title: 'Goal', saved: 0, target: 2000000 }, [`${base}/plannedExpenses/plan`]: { id: 'plan', title: 'Bill', category: 'living', amount: 200000, completed: false } });
const cfg: SalaryConfig = { monthlyIncome: 3000000, fixedBills: 0, savingsTarget: 0, paydayDay: 5, totalCycleDays: 30, todayIndex: 0 };
await test('QR hold debits once, including identical retries', async () => { setup(); await Promise.all([createPendingTransactionWithHold(uid, tx('qr')), createPendingTransactionWithHold(uid, tx('qr'))]); assert.equal(acc().balance, 900000); });
await test('Confirm twice never debits again', async () => { await Promise.all([confirmPendingTransaction(uid, 'qr'), confirmPendingTransaction(uid, 'qr')]); assert.equal(acc().balance, 900000); });
await test('Cannot cancel a confirmed QR from stale UI', async () => { await assert.rejects(cancelPendingTransactionWithRefund(uid, tx('qr'))); assert.equal(acc().balance, 900000); });
await test('Cancel twice refunds once', async () => { setup(); await createPendingTransactionWithHold(uid, tx('qr')); await Promise.all([cancelPendingTransactionWithRefund(uid, tx('qr')), cancelPendingTransactionWithRefund(uid, tx('qr'))]); assert.equal(acc().balance, 1000000); assert.equal(read(`${base}/transactions/qr`).status, 'cancelled'); });
await test('Confirmed/cancel race has exactly one terminal result', async () => { setup(); await createPendingTransactionWithHold(uid, tx('qr')); await Promise.allSettled([confirmPendingTransaction(uid, 'qr'), cancelPendingTransactionWithRefund(uid, tx('qr'))]); const status = read(`${base}/transactions/qr`).status; assert.equal(acc().balance, status === 'confirmed' ? 900000 : 1000000); });
await test('Concurrent expenses cannot overdraw the wallet', async () => { setup(); const result = await Promise.allSettled([recordExpenseAndDeductWallet(uid, tx('a', 800000)), recordExpenseAndDeductWallet(uid, tx('b', 800000))]); assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(acc().balance, 200000); });
for (const amount of [0, -1, NaN, Infinity, .5, Number.MAX_SAFE_INTEGER + 1]) await test(`Reject invalid amount ${amount}`, async () => { setup(); await assert.rejects(recordExpenseAndDeductWallet(uid, tx('bad', amount))); assert.equal(acc().balance, 1000000); });
await test('Missing or savings source rejected for spending', async () => { setup(); await assert.rejects(recordExpenseAndDeductWallet(uid, { ...tx('bad'), accountId: 'missing' })); await assert.rejects(recordExpenseAndDeductWallet(uid, { ...tx('bad'), accountId: 'savings' })); });
await test('Deleting twice restores original amount from DB, ignoring stale payload', async () => { setup(); await recordExpenseAndDeductWallet(uid, tx('a')); await Promise.all([deleteTransactionAndRestoreWallet(uid, tx('a', 999999)), deleteTransactionAndRestoreWallet(uid, tx('a', 999999))]); assert.equal(acc().balance, 1000000); });
await test('Planned payment is idempotent', async () => { setup(); const plan = read(`${base}/plannedExpenses/plan`); await Promise.all([completePlannedExpense(uid, plan, 'bank', 0), completePlannedExpense(uid, plan, 'bank', 0)]); assert.equal(acc().balance, 800000); });
await test('Undo planned payment restores reserve and wallet', async () => { await deleteTransactionAndRestoreWallet(uid, tx('tx-plan-plan')); assert.equal(acc().balance, 1000000); assert.equal(read(`${base}/plannedExpenses/plan`).completed, false); });
await test('Savings contribution conserves total money and funds goal', async () => { setup(); await sweepSurplusToSavings(uid, 'bank', 'savings', 'goal', 300000, 0); assert.equal(acc().balance, 700000); assert.equal(acc('savings').balance, 300000); assert.equal(read(`${base}/goals/goal`).saved, 300000); assert.equal(read(base).allocatedSavings, 300000); });
await test('Goal money cannot be withdrawn with a generic transfer', async () => { await assert.rejects(transferInternalWallets(uid, 'savings', 'bank', 100000, { ...tx('back'), type: 'internal' })); assert.equal(acc('savings').balance, 300000); });
await test('Savings cannot be created from insufficient balance', async () => { setup(); await assert.rejects(sweepSurplusToSavings(uid, 'bank', 'savings', 'goal', 2000000, 0)); assert.equal(acc('savings').balance, 0); assert.equal(read(`${base}/goals/goal`).saved, 0); });
await test('Internal transfer is reversible exactly once', async () => { setup(); const t = { ...tx('move', 200000), type: 'internal' as const }; await transferInternalWallets(uid, 'bank', 'cash', t.amount, t); await Promise.all([deleteTransactionAndRestoreWallet(uid, t), deleteTransactionAndRestoreWallet(uid, t)]); assert.equal(acc().balance, 1000000); assert.equal(acc('cash').balance, 0); });
await test('Same-wallet transfer rejected', async () => { setup(); await assert.rejects(transferInternalWallets(uid, 'bank', 'bank', 100000, tx('same'))); });
await test('Income records once; undo subtracts instead of minting money', async () => { setup(); await Promise.all([depositToWallet(uid, 'bank', 200000, 0, 'income'), depositToWallet(uid, 'bank', 200000, 0, 'income')]); assert.equal(acc().balance, 1200000); await deleteTransactionAndRestoreWallet(uid, tx('income')); assert.equal(acc().balance, 1000000); });
await test('Payday/month/leap-year lengths are real calendar dates', () => { const leap = getSalaryCycle(5, new Date(2024, 1, 29)); assert.equal(leap.totalCycleDays, 29); assert.equal(leap.todayIndex, 24); const jan = getSalaryCycle(5, new Date(2026, 0, 4)); assert.equal(jan.key, '2025-12-05'); assert.equal(jan.totalCycleDays, 31); const last = getSalaryCycle(31, new Date(2026, 1, 28)); assert.equal(last.key, '2026-02-28'); assert.equal(last.end.getDate(), 31); });
await test('Unrecorded past days never create fake expenses', () => { const m = budget({ ...cfg, todayIndex: 10 }, [], [], 'redistribute'); assert.equal(m.totalSpentCycle, 0); assert.equal(m.days[0].spent, 0); assert.equal(m.todayAllowance, 150000); });
await test('Rollover modes differ; no made-up savings credited', () => { const a = budget({ ...cfg, todayIndex: 10 }, [], [], 'redistribute'); const b = budget({ ...cfg, todayIndex: 10 }, [], [], 'strict'); assert.equal(a.todayAllowance, 150000); assert.equal(b.todayAllowance, 100000); });
await test('Old cycles excluded, pending expenses counted', () => { const old = { ...tx('old'), cycleStartDate: '2001-01-05' }; const pending = { ...tx('pending'), status: 'pending' as const }; const m = budget(cfg, [old, pending], [], 'strict'); assert.equal(m.todaySpent, 100000); });
await test('Planned expense completion never double charges daily budget', () => { const p = { id: 'p', title: 'Plan', amount: 300000, category: 'living' as const, dueDateLabel: '', completed: false }; const before = budget(cfg, [], [p], 'strict'); const after = budget(cfg, [{ ...tx('paid', 300000), plannedExpenseId: 'p' }], [{ ...p, completed: true }], 'strict'); assert.equal(before.remainingLivingBudget, after.remainingLivingBudget); assert.equal(after.todaySpent, 0); assert.equal(after.totalSpentCycle, 300000); });
await test('Savings transfer within monthly target never reserves twice', () => { const c = { ...cfg, savingsTarget: 600000 }; const a = budget(c, [], [], 'strict'); const b = budget(c, [{ ...tx('s', 400000), type: 'internal', savingsDirection: 1 }], [], 'strict'); assert.equal(a.remainingLivingBudget, b.remainingLivingBudget); });
await test('Savings beyond target and loans reduce available spending', () => { const m = budget(cfg, [{ ...tx('s', 400000), type: 'internal', savingsDirection: 1 }, { ...tx('loan', 100000), type: 'loan' }], [], 'strict'); assert.equal(m.remainingLivingBudget, 2500000); });
await test('Tight wallet is spread across remaining days with no overdraft', () => { const m = budget(cfg, [], [], 'strict', [{ id: 'cash', name: 'Cash', balance: 25000, type: 'cash' }]); assert.equal(m.todayDelta, Math.floor(25000 / 30)); assert.equal(m.walletLimit,25000); assert.ok(m.todayDelta + m.futureDailyAllowance * m.futureDaysCount <= 25000); });
await test('Payment preview matches recalculation in both modes', () => { for (const mode of ['strict', 'redistribute'] as const) { const m = budget(cfg, [], [], mode); const p = previewPaymentImpact(m, 150000); const a = budget(cfg, [tx('paid', 150000)], [], mode); assert.equal(p.newFutureDailyAllowance, a.futureDailyAllowance); assert.equal(p.afterTodayDelta, a.todayDelta); } });
await test('Last cycle day has zero future days and no divide by zero', () => { const m = budget({ ...cfg, todayIndex: 29 }, [], [], 'strict'); assert.equal(m.futureDaysCount, 0); assert.equal(m.futureDailyAllowance, 0); assert.equal(previewPaymentImpact(m, 10).newFutureDailyAllowance, 0); });
const tlv = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;
const payload = '000201' + tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', '970422') + tlv('01', '123456789')) + tlv('02', 'QRIBFTTA')) + '5303704' + tlv('54', '35000') + '5802VN' + tlv('59', 'TEST USER') + tlv('62', tlv('08', 'TEST')) + '6304';
await test('VietQR valid checksum parses amount and beneficiary', () => { const qr = parseVietQRPayload(payload + crc16(payload)); assert.equal(qr?.accountNumber, '123456789'); assert.equal(qr?.amount, 35000); });
await test('Damaged, malformed and arbitrary QR rejected', () => { assert.equal(parseVietQRPayload(payload + '0000'), null); assert.equal(parseVietQRPayload('https://example.com'), null); assert.equal(parseVietQRPayload('0002013802x'), null); });
await test('Bank deeplink uses bank code and return URL', () => { const url = new URL(buildBankAppDeeplink('vcb', { bankName: 'MB Bank', accountNumber: '123456', amount: 35000, transferNote: 'TEST', returnUrl: 'https://example.test/' })); assert.equal(url.searchParams.get('ba'), '123456@mb'); assert.equal(url.searchParams.get('app'), 'vcb'); assert.equal(url.searchParams.get('url'), 'https://example.test/'); });

await test('Sender catalog uses official VPBank and MyVIB app IDs', () => {
  assert.equal(SENDER_BANKS.find(b => b.name === 'VPBank')?.appId, 'vpb');
  assert.equal(SENDER_BANKS.find(b => b.name === 'VIB')?.appId, 'vib-2');
  assert.equal(SENDER_BANKS.some(b => b.id === 'stb'), false);
  assert.equal(SENDER_BANKS.find(b => b.id === 'vcb')?.autofill, false);
});
await test('Wallet matching accepts IDs and normalized names, never unrelated wallets', () => {
  assert.equal(bankForWallet({ id:'mbbank',name:'Ví chính' })?.appId,'mb');
  assert.equal(bankForWallet({ id:'custom',name:'Vietcombank' })?.appId,'vcb');
  assert.equal(bankForWallet({ id:'custom',name:'Tiền mặt' }),undefined);
});
await test('Bank launch rejects unsupported apps, unknown recipient and invalid amounts', () => {
  const data={bankName:'MB Bank',accountNumber:'12345',amount:50000,transferNote:'TEST'};
  assert.throws(()=>buildBankAppDeeplink('vpbank',data));
  assert.throws(()=>buildBankAppDeeplink('vcb',{...data,bankName:'Unknown'}));
  assert.throws(()=>buildBankAppDeeplink('vcb',{...data,amount:-1}));
  assert.equal(new URL(buildBankAppDeeplink('vpb',{...data,bankName:'VIB',accountHolder:'TEST USER'})).searchParams.get('ba'),'12345@vib');
});
await test('iPhone VCB uses verified launch-only scheme, other banks retain payment link', () => {
  const link='https://dl.vietqr.io/pay?app=vcb';
  assert.equal(bankLaunchHref('vcb',link,true),'vietcombankmobile://');
  assert.equal(bankLaunchHref('vcb',link,false),link);
  assert.equal(bankLaunchHref('mb',link,true),link);
});
await test('Bank tab is reserved in the tap and navigates only after the hold commits', async () => {
  const events:string[]=[];
  let release!:(saved:boolean)=>void;
  const pending=new Promise<boolean>(resolve=>release=resolve);
  const result=prepareBankHandoff('https://dl.vietqr.io/pay',()=>{ events.push('save'); return pending; },()=>{
    events.push('reserve'); return {launch:()=>{events.push('launch');return true;},close:()=>{events.push('close');}};
  });
  assert.deepEqual(events,['reserve','save']);
  release(true);
  assert.deepEqual(await result,{saved:true,launched:true});
  assert.deepEqual(events,['reserve','save','launch']);
});
await test('Bank handoff navigates only to official routes and keeps a tappable fallback', () => {
  const nodes:any[]=[]; const destinations:string[]=[];
  const tab={closed:false,opener:{},document:{title:'',createElement:()=>({style:{}}),body:{append:(el:any)=>nodes.push(el),replaceChildren:(el:any)=>{nodes.splice(0,nodes.length,el);}}},location:{replace:(url:string)=>destinations.push(url)},close:()=>{}};
  const handoff=reserveBankHandoff((()=>tab) as unknown as typeof window.open)!;
  assert.equal(handoff.launch('javascript:alert(1)'),false);
  assert.equal(handoff.launch('https://evil.example/pay'),false);
  assert.equal(handoff.launch('vietcombankmobile://'),true);
  assert.equal(nodes[0].href,'vietcombankmobile://');
  assert.equal(destinations[0],'vietcombankmobile://');
  tab.closed=true;
  assert.equal(handoff.launch('https://dl.vietqr.io/pay?app=vcb'),false);
});
await test('Failed save closes the reserved bank tab without launching', async () => {
  let closed=0,launched=0;
  const reserve=()=>({launch:()=>{launched++;return true;},close:()=>{closed++;}});
  assert.equal((await prepareBankHandoff('url',async()=>false,reserve)).saved,false);
  await assert.rejects(prepareBankHandoff('url',async()=>{throw Error('permission denied');},reserve));
  assert.equal(launched,0); assert.equal(closed,2);
});
await test('Blocked popup or closed tab leaves a saved hold with direct retry available', async () => {
  assert.deepEqual(await prepareBankHandoff('url',async()=>true,()=>null),{saved:true,launched:false});
  let closed=0;
  assert.deepEqual(await prepareBankHandoff('url',async()=>true,()=>({launch:()=>false,close:()=>{closed++;}})),{saved:true,launched:false});
  assert.equal(closed,1);
  assert.equal(reserveBankHandoff((()=>null) as typeof window.open),null);
});

await test('Fixed bill uses its reserve, without charging daily budget twice', () => { const c = { ...cfg, fixedBills: 600000 }; const before = budget(c, [], [], 'strict'); const after = budget(c, [{ ...tx('rent', 600000), budgetSource: 'fixed' }], [], 'strict'); assert.equal(after.todaySpent, 0); assert.equal(after.remainingLivingBudget, before.remainingLivingBudget); const over = budget(c, [{ ...tx('rent', 700000), budgetSource: 'fixed' }], [], 'strict'); assert.equal(over.remainingLivingBudget, before.remainingLivingBudget - 100000); });
await test('Wallet limit tracks the real recorded balance after a fixed payment', () => { const c = { ...cfg, fixedBills: 600000 }; const before = budget(c, [], [], 'strict', [{id:'bank',name:'Bank',type:'checking',balance:1000000}]); const after = budget(c, [{ ...tx('rent', 600000), budgetSource:'fixed' }], [], 'strict', [{id:'bank',name:'Bank',type:'checking',balance:400000}]); assert.equal(before.walletLimit, 1000000); assert.equal(after.walletLimit,400000); });
await test('QR cannot reserve from cash', async () => { setup(); await assert.rejects(createPendingTransactionWithHold(uid, { ...tx('cash-qr'), accountId:'cash' })); });

await test('Changing payday reclassifies dated expenses instead of hiding them', () => { const dated = { ...tx('dated'), cycleStartDate: '2026-11-05', cycleDayIndex: 15 }; const result = transactionsInCycle([dated], 10, new Date(2026, 10, 25)); assert.equal(result.length, 1); assert.equal(result[0].cycleDayIndex, 10); });
await test('Effective transaction date wins over stale cycle metadata', () => { const dated = { ...tx('dated'), cycleStartDate: '2026-10-05', effectiveDate: '2026-11-20' }; assert.equal(transactionsInCycle([dated], 10, new Date(2026, 10, 25))[0].cycleDayIndex, 10); });
await test('QR planned hold consumes reservation and cancel restores it', async () => { setup(); const planned = { ...tx('qr-plan', 200000), plannedExpenseId: 'plan' }; await createPendingTransactionWithHold(uid, planned); assert.equal(acc().balance, 800000); assert.equal(read(`${base}/plannedExpenses/plan`).completed, true); await Promise.all([cancelPendingTransactionWithRefund(uid, planned), cancelPendingTransactionWithRefund(uid, planned)]); assert.equal(acc().balance, 1000000); assert.equal(read(`${base}/plannedExpenses/plan`).completed, false); });
await test('QR cannot pay the same reserved plan twice', async () => { setup(); await createPendingTransactionWithHold(uid, { ...tx('first', 200000), plannedExpenseId: 'plan' }); await assert.rejects(createPendingTransactionWithHold(uid, { ...tx('second', 200000), plannedExpenseId: 'plan' })); assert.equal(acc().balance, 800000); });
await test('QR amount must match reservation', async () => { setup(); await assert.rejects(createPendingTransactionWithHold(uid, { ...tx('bad-plan', 100000), plannedExpenseId: 'plan' })); assert.equal(acc().balance, 1000000); assert.equal(read(`${base}/plannedExpenses/plan`).completed, false); });
await test('New wallet opening balance is logged once', async () => { setup(); await addWallet(uid, { id:'vcb',name:'Vietcombank',type:'checking',balance:500000 }); assert.equal(acc('vcb').balance,500000); await assert.rejects(addWallet(uid, { id:'vcb',name:'Vietcombank',type:'checking',balance:500000 })); assert.equal(acc('vcb').balance,500000); });
await test('Invalid salary reservations and payday rejected', async () => { setup(); await assert.rejects(saveSalarySettings(uid,{...cfg,fixedBills:4000000},'strict')); await assert.rejects(saveSalarySettings(uid,{...cfg,paydayDay:32},'strict')); });
await test('Onboarding cannot overwrite existing wallet balances', async () => { setup(); await assert.rejects(setupInitialFinance(uid,cfg,[{id:'bank',name:'Bank',type:'checking',balance:0}])); assert.equal(acc().balance,1000000); });
await test('Savings contribution reversal restores source, goal, and allocation', async () => { setup(); const transfer = { ...tx('goal-transfer',200000),type:'internal' as const,goalId:'goal' }; await transferInternalWallets(uid,'bank','savings',200000,transfer); await deleteTransactionAndRestoreWallet(uid,transfer); assert.equal(acc().balance,1000000); assert.equal(acc('savings').balance,0); assert.equal(read(`${base}/goals/goal`).saved,0); assert.equal(read(base).allocatedSavings,0); });
await test('Designated test reset is recoverable and preserves account permissions', async () => { reset({ [base]: { email:'hung@gmail.com',role:'admin',plan:'lifetime',salaryConfig:cfg,rolloverMode:'strict',avoidedImpulseTotal:10 }, [`${base}/accounts/bank`]: {id:'bank',name:'Bank',type:'checking',balance:1000000}, [`${base}/transactions/original`]: tx('original'), 'users/other/accounts/cash': {id:'cash',name:'Other',type:'cash',balance:99} }); await resetTestFinanceWithBackup(uid); assert.equal(acc(),undefined); assert.equal(read(base).plan,'lifetime'); assert.equal(read(base).financeTestBackup.records.length,2); assert.equal(read('users/other/accounts/cash').balance,99); await assert.rejects(resetTestFinanceWithBackup(uid)); await addWallet(uid,{id:'temporary',name:'Test',type:'cash',balance:0}); await restoreTestFinanceBackup(uid); assert.equal(acc().balance,1000000); assert.equal(acc('temporary'),undefined); assert.equal(read(`${base}/transactions/original`).id,'original'); assert.equal(read(base).financeTestBackup,null); });
await test('Reset is rejected for any other account', async () => { setup(); await assert.rejects(resetTestFinanceWithBackup(uid)); assert.equal(acc().balance,1000000); });
console.log(`\n${count} checks passed using the isolated transactional adapter.`);
