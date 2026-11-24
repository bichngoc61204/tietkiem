import type { SalaryConfig } from '../types/finance';

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getSalaryCycle(paydayDay: number, now = new Date()) {
  const payday = Math.min(31, Math.max(1, Math.floor(paydayDay) || 1));
  const at = (month: number) => {
    const last = new Date(now.getFullYear(), month + 1, 0).getDate();
    return new Date(now.getFullYear(), month, Math.min(payday, last));
  };
  let start = at(now.getMonth());
  if (now < start) start = at(now.getMonth() - 1);
  const endMonth = start.getMonth() + 1;
  const end = new Date(start.getFullYear(), endMonth, Math.min(payday, new Date(start.getFullYear(), endMonth + 1, 0).getDate()));
  const days = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
  return { start, end, key: dateKey(start), totalCycleDays: days(end, start), todayIndex: days(now, start) };
}

export function currentSalaryConfig(config: SalaryConfig, now = new Date()): SalaryConfig {
  const cycle = getSalaryCycle(config.paydayDay, now);
  return { ...config, totalCycleDays: cycle.totalCycleDays, todayIndex: cycle.todayIndex };
}
