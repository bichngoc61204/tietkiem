import React, { useMemo, useState } from 'react';
import { Check, Mail, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { GroupInvitation, SharedExpense, SharedGroup } from '../types/finance';
import { formatVND } from '../utils/format';

interface SharedGroupViewProps {
  group: SharedGroup;
  currentUid: string;
  pendingInvitations: GroupInvitation[]; // invitations sent TO currentUser
  onSendInvite: (toEmail: string) => Promise<void>;
  onAcceptInvite: (invitationId: string) => Promise<void>;
  onDeclineInvite: (invitationId: string) => Promise<void>;
  onAddExpense: (expense: Omit<SharedExpense, 'id' | 'date'>) => Promise<void>;
  onRemoveMember: (targetUid: string) => Promise<void>;
  onUpdateBudget: (budget: number) => Promise<void>;
  onUpdateGoal: (title: string, target: number) => Promise<void>;
}

const formatNumberInput = (val: string) =>
  val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const parseNumber = (val: string) => parseInt(val.replace(/\./g, ''), 10) || 0;

export const SharedGroupView: React.FC<SharedGroupViewProps> = ({
  group,
  currentUid,
  pendingInvitations,
  onSendInvite,
  onAcceptInvite,
  onDeclineInvite,
  onAddExpense,
  onRemoveMember,
  onUpdateBudget,
  onUpdateGoal,
}) => {
  const isOwner = group.ownerUid === currentUid;
  const members = group.members || [];
  const isSolo = members.length <= 1;

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState(currentUid);
  // Split equally among all members by default
  const [expSplit, setExpSplit] = useState<'equal' | 'custom'>('equal');

  const [budgetInput, setBudgetInput] = useState(formatNumberInput(String(group.monthlyBudget)));
  const [goalTitle, setGoalTitle] = useState(group.sharedGoal.title);
  const [goalTarget, setGoalTarget] = useState(formatNumberInput(String(group.sharedGoal.target)));

  // Metrics: how much each member paid vs. their share
  const metrics = useMemo(() => {
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {}; // how much they should have paid
    members.forEach(m => { paid[m.uid] = 0; owed[m.uid] = 0; });

    group.expenses.forEach(exp => {
      paid[exp.paidByUid] = (paid[exp.paidByUid] || 0) + exp.amount;
      const ratios = exp.splitRatios || {};
      members.forEach(m => {
        owed[m.uid] = (owed[m.uid] || 0) + exp.amount * (ratios[m.uid] ?? 1 / Math.max(1, members.length));
      });
    });

    const totalSpent = group.expenses.reduce((s, e) => s + e.amount, 0);
    const remaining = Math.max(0, group.monthlyBudget - totalSpent);
    const usedRatio = group.monthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / group.monthlyBudget) * 100))
      : 0;

    // net[uid] > 0 means others owe them; < 0 means they owe others
    const net: Record<string, number> = {};
    members.forEach(m => { net[m.uid] = Math.round((paid[m.uid] || 0) - (owed[m.uid] || 0)); });

    return { paid, owed, net, totalSpent, remaining, usedRatio };
  }, [group, members]);

  const sharedGoalPct = group.sharedGoal.target > 0
    ? Math.min(100, Math.round((group.sharedGoal.saved / group.sharedGoal.target) * 100))
    : 0;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await onSendInvite(inviteEmail.trim());
      setInviteEmail('');
      setShowInviteForm(false);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNumber(expAmount);
    if (!expTitle.trim() || amt <= 0) return;
    const ratios: Record<string, number> = {};
    if (expSplit === 'equal') {
      members.forEach(m => { ratios[m.uid] = 1 / members.length; });
    } else {
      // custom: payer pays all for now
      members.forEach(m => { ratios[m.uid] = m.uid === expPaidBy ? 1 : 0; });
    }
    await onAddExpense({ title: expTitle.trim(), amount: amt, paidByUid: expPaidBy, splitRatios: ratios });
    setExpTitle(''); setExpAmount(''); setShowExpenseForm(false);
  };

  return (
    <div className="space-y-4 animate-page-enter">

      {/* Pending invitations for current user */}
      {pendingInvitations.length > 0 && (
        <section className="bg-[var(--tone-caution-soft)] border border-[var(--tone-caution-border)] rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--tone-caution)] flex items-center gap-2">
            <Mail className="w-4 h-4" /> Lời mời tham gia quỹ chung
          </h3>
          {pendingInvitations.map(inv => (
            <div key={inv.id} className="bg-[var(--tone-white)] rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--ink-primary)] truncate">{inv.fromName}</p>
                <p className="text-xs text-[var(--ink-muted)] truncate">mời bạn vào quỹ chung</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onAcceptInvite(inv.id)}
                  className="tap-scale flex items-center gap-1 px-3 h-8 rounded-lg bg-[var(--brand)] text-[var(--brand-on)] text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Chấp nhận
                </button>
                <button
                  type="button"
                  onClick={() => onDeclineInvite(inv.id)}
                  className="tap-scale h-8 w-8 rounded-lg bg-[var(--bg-paper)] border border-[var(--border-hairline)] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Members section */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
              Thành viên ({members.length})
            </h2>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="tap-scale flex items-center gap-1 px-3 h-8 rounded-lg bg-[var(--brand)] text-[var(--brand-on)] text-xs font-semibold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Mời thành viên
            </button>
          )}
        </div>

        {showInviteForm && (
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email người muốn mời..."
              className="app-input flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="tap-scale px-4 h-11 rounded-xl bg-[var(--brand)] text-[var(--brand-on)] text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50"
            >
              {inviteLoading ? '...' : 'Gửi'}
            </button>
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">Chưa có thành viên nào.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-hairline)]">
            {members.map(m => (
              <li key={m.uid} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-light)] flex items-center justify-center shrink-0 text-xs font-bold text-[var(--brand)]">
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--ink-primary)] truncate">
                      {m.displayName} {m.uid === currentUid ? '(Bạn)' : ''} {m.uid === group.ownerUid ? '· Chủ nhóm' : ''}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] truncate">{m.email}</p>
                  </div>
                </div>
                {isOwner && m.uid !== currentUid && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(m.uid)}
                    className="tap-scale h-7 w-7 rounded-lg flex items-center justify-center text-[var(--tone-danger)] bg-[var(--tone-danger-soft)] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isSolo && (
          <p className="text-xs text-[var(--ink-muted)] bg-[var(--bg-paper)] rounded-xl p-3 leading-relaxed">
            Mời thêm thành viên để bắt đầu quỹ chung. Họ sẽ nhận lời mời qua email và chấp nhận trong app.
          </p>
        )}
      </section>

      {/* Budget & expenses — only show if 2+ members */}
      {!isSolo && (
        <>
          {/* Budget card */}
          <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[var(--ink-muted)]">{group.typeLabel}</p>
                <h2 className="text-[15px] font-semibold text-[var(--ink-primary)]">{group.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="tap-scale px-3 py-1.5 rounded-lg bg-[var(--ink-primary)] text-[var(--tone-white)] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                Thêm khoản chi
              </button>
            </div>

            {/* Budget setting */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--ink-muted)] shrink-0">Ngân sách tháng:</label>
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={e => setBudgetInput(formatNumberInput(e.target.value))}
                onBlur={() => onUpdateBudget(parseNumber(budgetInput))}
                className="app-input flex-1 min-w-0"
                placeholder="0"
              />
              <span className="text-xs text-[var(--ink-muted)] shrink-0">đ</span>
            </div>

            <div className="space-y-1.5 tabular-nums">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-[var(--ink-muted)]">
                  Đã chi {formatVND(metrics.totalSpent)} / {formatVND(group.monthlyBudget)}
                </span>
                <span className="font-semibold text-[var(--brand)]">Còn {formatVND(metrics.remaining)}</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--brand)] transition-[width] duration-300"
                  style={{ width: `${metrics.usedRatio}%` }}
                />
              </div>
            </div>

            {/* Per-member summary */}
            <div className={`grid gap-2 ${members.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {members.map(m => (
                <div key={m.uid} className="border border-[var(--border-hairline)] rounded-xl p-3">
                  <p className="text-xs text-[var(--ink-muted)] truncate">{m.displayName} đã chi</p>
                  <p className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums mt-0.5">
                    {formatVND(metrics.paid[m.uid] || 0)}
                  </p>
                  {metrics.net[m.uid] !== undefined && (
                    <p className={`text-xs tabular-nums mt-0.5 font-semibold ${metrics.net[m.uid] >= 0 ? 'text-[var(--brand)]' : 'text-[var(--tone-danger)]'}`}>
                      {metrics.net[m.uid] >= 0
                        ? `+${formatVND(metrics.net[m.uid])} (được hoàn)`
                        : `${formatVND(metrics.net[m.uid])} (cần trả thêm)`}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {showExpenseForm && (
              <form onSubmit={handleAddExpense} className="pt-3 border-t border-[var(--border-hairline)] space-y-2.5">
                <input
                  type="text"
                  value={expTitle}
                  onChange={e => setExpTitle(e.target.value)}
                  placeholder="Nội dung (VD: Tiền siêu thị, tiền xăng...)"
                  className="app-input w-full"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={expAmount}
                      onChange={e => setExpAmount(formatNumberInput(e.target.value))}
                      placeholder="Số tiền"
                      className="app-input w-full pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-muted)] pointer-events-none">đ</span>
                  </div>
                  <select
                    value={expPaidBy}
                    onChange={e => setExpPaidBy(e.target.value)}
                    className="app-input w-auto flex-1"
                  >
                    {members.map(m => (
                      <option key={m.uid} value={m.uid}>{m.displayName} trả</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpSplit('equal')}
                    className={`tap-scale flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition ${expSplit === 'equal' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]' : 'bg-[var(--bg-paper)] text-[var(--ink-muted)] border-[var(--border-hairline)]'}`}
                  >
                    Chia đều
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpSplit('custom')}
                    className={`tap-scale flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition ${expSplit === 'custom' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]' : 'bg-[var(--bg-paper)] text-[var(--ink-muted)] border-[var(--border-hairline)]'}`}
                  >
                    Người trả chịu hết
                  </button>
                </div>
                <button
                  type="submit"
                  className="tap-scale w-full py-2.5 rounded-xl bg-[var(--brand)] text-[var(--brand-on)] text-xs font-semibold cursor-pointer"
                >
                  Lưu khoản chi
                </button>
              </form>
            )}
          </section>

          {/* Shared goal */}
          <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Mục tiêu chung</h3>
            <input
              type="text"
              value={goalTitle}
              onChange={e => setGoalTitle(e.target.value)}
              onBlur={() => onUpdateGoal(goalTitle, parseNumber(goalTarget))}
              placeholder="Tên mục tiêu (VD: Mua TV, Du lịch Đà Lạt...)"
              className="app-input w-full"
            />
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="numeric"
                value={goalTarget}
                onChange={e => setGoalTarget(formatNumberInput(e.target.value))}
                onBlur={() => onUpdateGoal(goalTitle, parseNumber(goalTarget))}
                placeholder="Mục tiêu"
                className="app-input flex-1"
              />
              <span className="text-xs text-[var(--ink-muted)] shrink-0">đ</span>
            </div>
            {group.sharedGoal.target > 0 && (
              <>
                <div className="flex items-baseline justify-between text-xs tabular-nums">
                  <span className="text-[var(--ink-muted)]">{formatVND(group.sharedGoal.saved)} / {formatVND(group.sharedGoal.target)}</span>
                  <span className="font-semibold text-[var(--brand)]">{sharedGoalPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-[var(--border-hairline)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${sharedGoalPct}%` }} />
                </div>
              </>
            )}
          </section>

          {/* Activity feed */}
          {group.activities.length > 0 && (
            <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-[var(--ink-primary)]">Hoạt động gần đây</h3>
              <ul className="divide-y divide-[var(--border-hairline)] text-xs text-[var(--ink-muted)]">
                {group.activities.map((act, idx) => (
                  <li key={idx} className="py-2 first:pt-0 last:pb-0 leading-relaxed tabular-nums">{act}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
