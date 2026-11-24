import React from 'react';
import { QrCode, Plus, CalendarClock, ArrowDownCircle, Wallet } from 'lucide-react';
import { Account, CycleBudgetMetrics, SalaryConfig } from '../types/finance';
import { formatVND } from '../utils/format';
interface HeroPassbookCardProps {
  metrics: CycleBudgetMetrics;
  salaryConfig: SalaryConfig;
  accounts: Account[];
  onOpenQr: () => void;
  onOpenQuickExpense: () => void;
  onOpenPlannedExpense: () => void;
  onOpenDeposit: () => void;
}
export const HeroPassbookCard: React.FC<HeroPassbookCardProps> = ({ metrics, accounts, onOpenQr, onOpenQuickExpense, onOpenPlannedExpense, onOpenDeposit }) => {
  const ratio = Math.min(1, metrics.todaySpent / Math.max(1, metrics.todayAllowance));
  const spending = accounts.filter(a => a.type !== 'savings');
  return <section className="overview">
    <div className="daily-budget">
      <div className="budget-label"><h1 id="daily-label">Hôm nay còn có thể chi</h1><span className="budget-date">{new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span></div>
      <p aria-labelledby="daily-label" className={metrics.todayDelta < 0 ? 'daily-amount amount-negative' : 'daily-amount'}>{formatVND(Math.max(0, metrics.todayDelta))}</p>
      <p>{metrics.todayDelta < 0 ? `Đã vượt ngân sách ${formatVND(-metrics.todayDelta)}` : 'Sau khi dành tiền cho kế hoạch và tiết kiệm'}</p>
      <div className="budget-meter" role="progressbar" aria-label="Ngân sách đã chi hôm nay" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${ratio})` }} /></div>
      <div className="budget-caption"><span>Đã chi <strong>{formatVND(metrics.todaySpent)}</strong></span><span>Hạn mức <strong>{formatVND(metrics.todayAllowance)}</strong></span></div>
      <button type="button" className="scan-button" onClick={onOpenQr}><QrCode size={24} strokeWidth={1.75} /><span>Quét QR chuyển tiền<small>Chuyển ở ngân hàng, xác nhận tại đây</small></span></button>
    </div>
    <div className="quick-actions">
      <button type="button" onClick={onOpenQuickExpense}><Plus /><span>Ghi khoản chi</span></button>
      <button type="button" onClick={onOpenDeposit}><ArrowDownCircle /><span>Thêm thu nhập</span></button>
      <button type="button" onClick={onOpenPlannedExpense}><CalendarClock /><span>Khoản sắp chi</span></button>
    </div>
    <div className="wallet-overview">
      <div className="section-heading"><h2>Tiền trong ví</h2><Wallet size={18} /></div>
      {spending.map(a => <div key={a.id} className="wallet-row"><span>{a.name}</span><strong>{formatVND(a.balance)}</strong></div>)}
      <div className="wallet-total"><span>Tổng ví chi tiêu</span><strong>{formatVND(spending.reduce((s, a) => s + a.balance, 0))}</strong></div>
      <p className="helper-text">Số dư bạn ghi nhận trong sổ, chưa đồng bộ với ngân hàng</p>
    </div>
  </section>;
};
