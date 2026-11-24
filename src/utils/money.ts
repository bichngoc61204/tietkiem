import type { Account } from '../types/finance';
export function assertMoney(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Nhập số tiền nguyên lớn hơn 0 và trong giới hạn cho phép.');
}
export function debitBalance(account: Account | undefined, amount: number, allowSavings = false) {
  assertMoney(amount);
  if (!account) throw new Error('Không tìm thấy ví nguồn. Vui lòng chọn lại ví.');
  if (!Number.isSafeInteger(account.balance) || account.balance < 0) throw new Error('Số dư ví không hợp lệ. Vui lòng kiểm tra dữ liệu.');
  if (account.type === 'savings' && !allowSavings) throw new Error('Chọn ví chi tiêu; tiền tiết kiệm cần chuyển về ví trước.');
  if (account.balance < amount) throw new Error(`Ví ${account.name} không đủ số dư.`);
  return account.balance - amount;
}
