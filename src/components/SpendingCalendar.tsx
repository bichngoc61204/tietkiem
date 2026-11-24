import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { CalendarDaySummary, CycleBudgetMetrics } from '../types/finance';
import { formatCompactVND, formatVND } from '../utils/format';

interface SpendingCalendarProps {
  metrics: CycleBudgetMetrics;
  todayIndex: number;
  onAddExpenseOnDay: (dayIndex: number) => void;
  onDeleteTransaction: (txId: string) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const SpendingCalendar: React.FC<SpendingCalendarProps> = ({
  metrics,
  todayIndex,
  onAddExpenseOnDay,
  onDeleteTransaction,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayIndex);

  const selectedDay: CalendarDaySummary = useMemo(() => {
    return (
      metrics.days.find((d) => d.dayIndex === selectedDayIndex) ||
      metrics.days[todayIndex] ||
      metrics.days[0]
    );
  }, [metrics.days, selectedDayIndex, todayIndex]);

  const leadingEmptySlots = metrics.days[0]?.weekdayIndex ?? 0;

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Main Calendar Card */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-3.5 sm:p-4 space-y-3.5 w-full min-w-0 overflow-hidden">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--ink-primary)]">
            Lịch chi tiêu trong kỳ
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5 tabular-nums">
            Hạn mức hôm nay: <span className="font-semibold text-[var(--brand)]">{formatVND(metrics.todayAllowance)}/ngày</span>
          </p>
        </div>

        {/* Simple Beginner-Friendly Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--ink-muted)] pb-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--brand-light)] border border-[var(--brand)]" />
            <span>Trong hạn mức</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--tone-danger-soft)] border border-[var(--tone-danger)]" />
            <span>Tiêu lố</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--bg-paper)] border border-[var(--border-hairline)]" />
            <span>Chưa tới / Chưa ghi</span>
          </span>
        </div>

        {/* 7-Column Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center w-full min-w-0">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-xs sm:text-xs font-semibold text-[var(--ink-muted)] py-1">
              {wd}
            </div>
          ))}

          {/* Leading Empty Slots */}
          {Array.from({ length: leadingEmptySlots }).map((_, idx) => (
            <div key={`empty-${idx}`} aria-hidden="true" />
          ))}

          {/* Calendar Day Cells */}
          {metrics.days.map((day) => {
            const isSelected = day.dayIndex === selectedDayIndex;
            const isToday = day.phase === 'today';
            const isPast = day.phase === 'past';
            const isFuture = day.phase === 'future';
            const isUntracked = day.phase === 'untracked';
            const hasLogged = day.transactions.length > 0;
            const isTodayOverspent = isToday && day.status === 'overspent';

            // Visual styles per state
            let cellStyle = 'bg-[var(--bg-paper)] border-[var(--border-hairline)] text-[var(--ink-muted)]';
            let amountColor = 'text-[var(--ink-muted)]';

            if (isUntracked) {
              // Days before user started using app — neutral gray
              cellStyle = 'bg-[var(--bg-paper)] border-[var(--border-hairline)] text-[var(--color-9ca3af)] opacity-70';
              amountColor = 'text-[var(--color-9ca3af)]';
            } else if (isPast) {
              if (day.delta >= 0) {
                cellStyle = 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]';
                amountColor = 'text-[var(--brand)]';
              } else {
                cellStyle = 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-border)] text-[var(--tone-danger)]';
                amountColor = 'text-[var(--tone-danger)]';
              }
            } else if (isToday) {
              if (day.status === 'overspent') {
                cellStyle = 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger)] text-[var(--tone-danger)]';
                amountColor = 'text-[var(--tone-danger)]';
              } else if (day.status === 'caution') {
                cellStyle = 'bg-[var(--tone-caution-soft)] border-[var(--tone-caution)] text-[var(--tone-caution)]';
                amountColor = 'text-[var(--tone-caution)]';
              } else {
                cellStyle = 'bg-[var(--brand-light)] border-[var(--brand)] text-[var(--brand)]';
                amountColor = 'text-[var(--brand)]';
              }
            } else if (isFuture) {
              cellStyle = 'bg-[var(--bg-paper)] border-[var(--border-hairline)] text-[var(--ink-muted)]';
              amountColor = 'text-[var(--ink-muted)]';
            }

            return (
              <button
                key={day.dayIndex}
                type="button"
                onClick={() => setSelectedDayIndex(day.dayIndex)}
                aria-label={`Ngày ${day.dateLabel}`}
                className={`relative rounded-xl border p-1 sm:p-1.5 min-h-[48px] sm:min-h-[54px] flex flex-col items-center justify-between transition cursor-pointer min-w-0 ${cellStyle} ${
                  isSelected ? 'ring-2 ring-[var(--ink-primary)] ring-offset-1' : ''
                }`}
              >
                {/* Top Row: Day number + Red Ping when Today is overspent */}
                <div className="w-full flex items-center justify-between px-0.5">
                  <span
                    className={`text-xs sm:text-xs tabular-nums leading-none ${
                      isToday ? 'font-semibold text-[var(--ink-primary)]' : 'font-medium'
                    }`}
                  >
                    {day.shortDay}
                  </span>

                  {isTodayOverspent && (
                    <span className="relative flex h-2 w-2 shrink-0" title="Tiêu lố hôm nay">
                      <span className=" absolute inline-flex h-full w-full rounded-full bg-[var(--tone-danger)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tone-danger)]" />
                    </span>
                  )}

                  {isToday && !isTodayOverspent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-primary)] shrink-0" />
                  )}
                </div>

                {/* Bottom Figure */}
                <span
                  className={`text-xs sm:text-xs font-semibold tabular-nums leading-tight tracking-tight ${amountColor}`}
                >
                  {isFuture
                    ? formatCompactVND(day.allowance)
                    : (isPast || isUntracked) && !hasLogged
                    ? '-'
                    : formatCompactVND(day.delta, true)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Redistribution Explanation Strip */}
        <div
          className={`rounded-xl border p-3 text-xs leading-relaxed tabular-nums flex items-start gap-2.5 ${
            metrics.todayStatus === 'overspent'
              ? 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-border)] text-[var(--tone-danger)]'
              : 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]'
          }`}
        >
          {metrics.todayStatus === 'overspent' ? (
            <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
              <span className=" absolute inline-flex h-full w-full rounded-full bg-[var(--tone-danger)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--tone-danger)]" />
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-[var(--brand)] mt-1.5 shrink-0" />
          )}

          <div>
            {metrics.todayStatus === 'overspent' ? (
              <p>
                Hôm nay tiêu lố{' '}
                <span className="font-semibold">{formatVND(Math.abs(metrics.todayDelta))}</span>. Hệ
                thống đã tự trừ nhẹ{' '}
                <span className="font-semibold">
                  {formatVND(Math.abs(metrics.redistributionPerDay))}/ngày
                </span>{' '}
                vào {metrics.futureDaysCount} ngày còn lại (còn{' '}
                <span className="font-semibold">{formatVND(metrics.futureDailyAllowance)}/ngày</span>).
              </p>
            ) : (
              <p>
                Hạn mức hôm nay: <span className="font-semibold">{formatVND(metrics.todayAllowance)}</span>
                {metrics.todaySpent > 0 && (
                  <>
                    {' '}· Đã tiêu {formatVND(metrics.todaySpent)}, còn{' '}
                    <span className="font-semibold">{formatVND(metrics.todayDelta)}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Selected Day Detail Card */}
      <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--ink-muted)]">
              {selectedDay.phase === 'today'
                ? 'Hôm nay'
                : selectedDay.phase === 'past'
                ? 'Ngày đã qua'
                : 'Ngày sắp tới'}
            </p>
            <h3 className="text-[14px] font-semibold text-[var(--ink-primary)]">
              {selectedDay.weekdayLabel}, {selectedDay.dateLabel}
            </h3>
          </div>

          {selectedDay.phase !== 'future' ? (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border ${
                selectedDay.delta >= 0
                  ? 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]'
                  : 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-border)] text-[var(--tone-danger)]'
              }`}
            >
              {selectedDay.delta >= 0
                ? `Dư ${formatVND(selectedDay.delta)}`
                : `Tiêu lố ${formatVND(Math.abs(selectedDay.delta))}`}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums bg-[var(--bg-paper)] border border-[var(--border-hairline)] text-[var(--ink-primary)]">
              Dự kiến {formatVND(selectedDay.allowance)}
            </span>
          )}
        </div>

        {/* Allowance vs Spent Row */}
        <div className="grid grid-cols-3 divide-x divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-xl py-2.5 text-center tabular-nums">
          <div className="px-2">
            <p className="text-xs text-[var(--ink-muted)]">Hạn mức ngày</p>
            <p className="text-xs font-semibold text-[var(--ink-primary)] mt-0.5">
              {formatVND(selectedDay.allowance)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-xs text-[var(--ink-muted)]">Đã chi</p>
            <p className="text-xs font-semibold text-[var(--ink-primary)] mt-0.5">
              {formatVND(selectedDay.spent)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-xs text-[var(--ink-muted)]">
              {selectedDay.phase === 'future' ? 'Sau phân bổ' : 'Dư / Lỗ'}
            </p>
            <p
              className={`text-xs font-semibold mt-0.5 ${
                selectedDay.phase === 'future'
                  ? 'text-[var(--ink-primary)]'
                  : selectedDay.delta >= 0
                  ? 'text-[var(--brand)]'
                  : 'text-[var(--tone-danger)]'
              }`}
            >
              {selectedDay.phase === 'future'
                ? formatVND(selectedDay.allowance)
                : formatVND(selectedDay.delta, true)}
            </p>
          </div>
        </div>

        {/* Transactions on Selected Day */}
        {selectedDay.transactions.length > 0 ? (
          <div className="divide-y divide-[var(--border-hairline)]">
            {selectedDay.transactions.map((tx) => (
              <div key={tx.id} className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--ink-primary)] truncate">{tx.merchant}</p>
                  <p className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {tx.type === 'income' ? 'Thu nhập' : tx.type === 'internal' ? 'Chuyển ví' : tx.type === 'loan' ? 'Cho mượn' : CATEGORIES[tx.category]?.label || 'Chi tiêu'} / {tx.timeLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs font-semibold text-[var(--ink-primary)] tabular-nums">
                    {tx.type === 'income' ? '+' : tx.type === 'internal' ? '' : '-'}{formatVND(tx.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(tx.id)}
                    aria-label={`Hoàn tác ${tx.merchant}`}
                    className="p-1 text-[var(--ink-muted)] hover:text-[var(--tone-danger)] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--ink-muted)]">
            {selectedDay.phase === 'future'
              ? 'Ngày sắp tới chưa có chi tiêu. Hạn mức sẽ tự cập nhật theo chi tiêu thực tế hôm nay.'
              : 'Chưa có khoản chi nào được ghi nhận trong ngày này.'}
          </p>
        )}

        {selectedDay.phase !== 'future' && (
          <button
            type="button"
            onClick={() => onAddExpenseOnDay(selectedDay.dayIndex)}
            className="w-full py-2.5 rounded-xl bg-[var(--bg-paper)] hover:bg-[var(--tone-white)] border border-[var(--border-hairline)] hover:border-[var(--ink-primary)] text-xs font-semibold text-[var(--ink-primary)] flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>
              {selectedDay.phase === 'today'
                ? 'Thêm khoản chi hôm nay'
                : `Bổ sung chi tiêu ngày ${selectedDay.dateLabel}`}
            </span>
          </button>
        )}
      </section>
    </div>
  );
};
