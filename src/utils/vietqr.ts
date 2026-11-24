/**
 * Real EMVCo VietQR TLV Parser + Bank Deeplink Builder
 * Decodes VietQR payloads scanned from camera or uploaded QR images.
 */

export interface ParsedVietQR {
  raw: string;
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number | null;
  transferNote: string;
  qrMode: 'QR Động' | 'QR Tĩnh';
}

const BANK_BIN_MAP: Record<string, { name: string; vietqrId: string; appScheme: string }> = {
  '970422': { name: 'MB Bank', vietqrId: 'mbbank', appScheme: 'mb' },
  '970436': { name: 'Vietcombank', vietqrId: 'vcb', appScheme: 'vcb' },
  '970407': { name: 'Techcombank', vietqrId: 'tcb', appScheme: 'tcb' },
  '970423': { name: 'TPBank', vietqrId: 'tpb', appScheme: 'tpb' },
  '970415': { name: 'VietinBank', vietqrId: 'icb', appScheme: 'icb' },
  '970418': { name: 'BIDV', vietqrId: 'bidv', appScheme: 'bidv' },
  '970416': { name: 'ACB', vietqrId: 'acb', appScheme: 'acb' },
  '970432': { name: 'VPBank', vietqrId: 'vpb', appScheme: 'vpbank' },
  '970403': { name: 'Sacombank', vietqrId: 'stb', appScheme: 'stb' },
  '970405': { name: 'Agribank', vietqrId: 'vba', appScheme: 'vba' },
  '970441': { name: 'VIB', vietqrId: 'vib', appScheme: 'vib' },
  '970448': { name: 'OCB', vietqrId: 'ocb', appScheme: 'ocb' },
  '970437': { name: 'HDBank', vietqrId: 'hdb', appScheme: 'hdb' },
  '970454': { name: 'BVBank (Timo)', vietqrId: 'timo', appScheme: 'timo' },
};

export const BANK_OPTIONS = Object.values(BANK_BIN_MAP).map(bank => ({ id: bank.vietqrId, name: bank.name, appId: bank.appScheme }));

function parseTLV(input: string): Record<string, string> {
  const tags: Record<string, string> = {};
  let cursor = 0;

  while (cursor + 4 <= input.length) {
    const id = input.slice(cursor, cursor + 2);
    const rawLength = input.slice(cursor + 2, cursor + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(rawLength) || id in tags) return {};
    const len = Number(rawLength);
    if (Number.isNaN(len) || len < 0 || cursor + 4 + len > input.length) {
      return {};
    }
    tags[id] = input.slice(cursor + 4, cursor + 4 + len);
    cursor += 4 + len;
  }

  return cursor === input.length ? tags : {};
}

export function parseVietQRPayload(rawText: string): ParsedVietQR | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('00')) return null;

  if (!/6304[0-9a-f]{4}$/i.test(trimmed)) return null;
  if (crc16(trimmed.slice(0, -4)) !== trimmed.slice(-4).toUpperCase()) return null;
  const root = parseTLV(trimmed);
  if (root['00'] !== '01' || root['53'] !== '704' || root['58'] !== 'VN') return null;
  const merchantInfoRaw = root['38'] || root['39'] || '';
  if (!merchantInfoRaw) return null;

  const merchantTags = parseTLV(merchantInfoRaw);
  if (merchantTags['00'] !== 'A000000727' || merchantTags['02'] !== 'QRIBFTTA') return null;
  const beneficiaryRaw = merchantTags['01'] || '';
  const beneficiaryTags = beneficiaryRaw ? parseTLV(beneficiaryRaw) : {};

  const bankBin = beneficiaryTags['00'] || merchantTags['00'] || '';
  const accountNumber = beneficiaryTags['01'] || '';
  const bankMeta = BANK_BIN_MAP[bankBin];

  const rawAmount = root['54'] ? Number(root['54']) : null;
  const amount = rawAmount && Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null;

  const additionalRaw = root['62'] || '';
  const additionalTags = additionalRaw ? parseTLV(additionalRaw) : {};
  const transferNote = additionalTags['08'] || additionalTags['05'] || 'THANH TOAN VIETQR';
  const accountHolder = root['59'] || (accountNumber ? `TK ${accountNumber}` : 'NGUOI NHAN VIETQR');

  if (!/^\d{6}$/.test(bankBin) || !/^[A-Za-z0-9]{1,34}$/.test(accountNumber)) return null;
  if (root['54'] && (!Number.isSafeInteger(rawAmount) || Number(rawAmount) <= 0)) return null;

  return {
    raw: trimmed,
    bankBin,
    bankName: bankMeta?.name || `Ngân hàng (${bankBin || 'Napas'})`,
    accountNumber: accountNumber || 'Không rõ STK',
    accountHolder,
    amount,
    transferNote,
    qrMode: amount ? 'QR Động' : 'QR Tĩnh',
  };
}

/**
 * Generates official VietQR quick-link image URL for fallback scanning / saving.
 */
export function buildVietQRImageUrl(params: {
  bankName: string;
  accountNumber: string;
  amount: number;
  transferNote: string;
  accountHolder: string;
}): string {
  const matched = Object.values(BANK_BIN_MAP).find(
    (b) => b.name.toLowerCase() === params.bankName.toLowerCase()
  );
  if (!matched) throw new Error('Chưa hỗ trợ ngân hàng nhận này.');
  const bankId = matched.vietqrId;
  const q = new URLSearchParams({
    amount: String(Math.max(0, Math.round(params.amount))),
    addInfo: params.transferNote,
    accountName: params.accountHolder,
  });
  return `https://img.vietqr.io/image/${bankId}-${params.accountNumber}-compact2.png?${q.toString()}`;
}

/**
 * Generates a VietQR deeplink URL to launch the selected Vietnamese banking app.
 */
export function buildBankAppDeeplink(bankId: string, params: {
  bankName: string;
  accountNumber: string;
  amount: number;
  transferNote: string;
  returnUrl?: string;
}): string {
  const bank = Object.values(BANK_BIN_MAP).find(b => b.name.toLowerCase() === params.bankName.toLowerCase());
  if (!bank) throw new Error('Chưa hỗ trợ mở ngân hàng cho mã này. Hãy sao chép thông tin nhận tiền.');
  const q = new URLSearchParams({
    app: bankId,
    ba: `${params.accountNumber}@${bank.appScheme}`,
    am: String(Math.max(0, Math.round(params.amount))),
    tn: params.transferNote,
    url: params.returnUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://www.vietqr.io/deeplink'),
  });
  return `https://dl.vietqr.io/pay?${q.toString()}`;
}

export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
