export const formatVND = (amount: number, showSign = false): string => {
  const num = Math.round(Number(amount) || 0);
  const formatted = Math.abs(num).toLocaleString('vi-VN');
  if (showSign) {
    if (num > 0) return `+${formatted} đ`;
    if (num < 0) return `-${formatted} đ`;
  }
  return `${num < 0 ? '-' : ''}${formatted} đ`;
};

/**
 * Compact VND formatting for tight calendar cells.
 * Examples: 35000 -> "35k", 156400 -> "156k", -45000 -> "-45k", 1200000 -> "1,2tr"
 */
export const formatCompactVND = (amount: number, showSign = false): string => {
  const num = Math.round(Number(amount) || 0);
  const abs = Math.abs(num);
  const sign = showSign ? (num > 0 ? '+' : num < 0 ? '-' : '') : num < 0 ? '-' : '';

  if (abs === 0) return '0';
  if (abs >= 1000000) {
    const millions = (abs / 1000000).toFixed(1).replace('.0', '').replace('.', ',');
    return `${sign}${millions}tr`;
  }
  if (abs >= 1000) {
    const thousands = Math.round(abs / 1000);
    return `${sign}${thousands}k`;
  }
  return `${sign}${abs}`;
};

export const roundDailyVND = (amount: number): number => {
  return Math.round((Number(amount) || 0) / 100) * 100;
};

/**
 * Format raw number or string to dot-separated currency input string.
 * Example: 100000 -> "100.000"
 */
export const formatNumberWithDots = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '';
  const num = typeof val === 'number' ? Math.round(val) : Number(String(val).replace(/\D/g, ''));
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('vi-VN');
};

/**
 * Parse dot-separated currency string back to pure number.
 * Example: "100.000" -> 100000
 */
export const parseNumberWithDots = (str: string): number => {
  if (!str) return 0;
  const clean = String(str).replace(/\D/g, '');
  return clean ? Number(clean) : 0;
};

