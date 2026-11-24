/* Hallmark · waive 28b · Video is a live camera stream started on request · A poster would mask camera status; there is no prerecorded video. */
import { useModal } from '../hooks/useModal';
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Check, Copy, ExternalLink, ImagePlus, QrCode, X } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { Account, CategoryId, CycleBudgetMetrics, PlannedExpense } from '../types/finance';
import { previewPaymentImpact } from '../utils/budgetEngine';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';
import { BANK_OPTIONS, buildBankAppDeeplink, parseVietQRPayload } from '../utils/vietqr';

export interface QrDraft {
  merchant: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  category: CategoryId;
  accountId: string;
  transferNote: string;
  qrMode: string;
  budgetSource?: 'daily' | 'fixed';
  plannedExpenseId?: string;
}

interface QrPaymentDrawerProps {
  busy: boolean;
  isOpen: boolean;
  step: 1 | 2 | 3;
  draft: QrDraft;
  accounts: Account[];
  plannedExpenses: PlannedExpense[];
  metrics: CycleBudgetMetrics;
  pendingTxId: string | null;
  onClose: () => void;
  onSetStep: (step: 1 | 2 | 3) => void;
  onUpdateDraft: (draft: QrDraft) => void;
  onProceedToBank: () => Promise<boolean>;
  onConfirmPayment: (txId: string) => void;
  onCancelPayment: (txId: string) => void;
  onNotify: (msg: string, tone?: 'safe' | 'caution' | 'neutral') => void;
}

export const QrPaymentDrawer: React.FC<QrPaymentDrawerProps> = ({
  busy,
  isOpen,
  step,
  draft,
  accounts,
  plannedExpenses,
  metrics,
  pendingTxId,
  onClose,
  onSetStep,
  onUpdateDraft,
  onProceedToBank,
  onConfirmPayment,
  onCancelPayment,
  onNotify,
}) => {
  const modalRef = useModal(isOpen, onClose);
  const [copiedKey, setCopiedKey] = useState<'account' | 'note' | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const defaultWalletId = accounts.find((a) => a.type === 'checking')?.id || '';

  const applyScannedResult = (parsed: NonNullable<ReturnType<typeof parseVietQRPayload>>) => {
    setCameraActive(false);
    onUpdateDraft({
      merchant: parsed.accountHolder || parsed.bankName,
      bankName: parsed.bankName,
      accountNumber: parsed.accountNumber,
      accountHolder: parsed.accountHolder,
      amount: parsed.amount || 0,
      category: 'food',
      accountId: draft.accountId || defaultWalletId,
      transferNote: parsed.transferNote || 'CHUYEN KHOAN VIETQR',
      qrMode: parsed.qrMode,
    });
    onSetStep(2);
  };

  // Clean up camera when drawer closes or leaves step 1
  useEffect(() => {
    if (!isOpen || step !== 1 || !cameraActive) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    let animationId = 0;
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    const startCamera = async () => {
      setCameraError(null);
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          activeStream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          await videoRef.current.play();
        }

        const scanFrame = () => {
          if (cancelled || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code?.data) {
                const parsed = parseVietQRPayload(code.data);
                if (parsed) {
                  applyScannedResult(parsed);
                  return;
                }
              }
            }
          }
          animationId = requestAnimationFrame(scanFrame);
        };

        animationId = requestAnimationFrame(scanFrame);
      } catch {
        setCameraError('Không mở được camera. Bạn có thể tải ảnh mã QR từ thư viện.');
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen, step, cameraActive]);

  if (!isOpen) return null;

  const impact = previewPaymentImpact(metrics, draft.amount);
  const selectedWallet = accounts.find((a) => a.id === draft.accountId);

  const handleCopy = async (text: string, key: 'account' | 'note') => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }
    catch { onNotify('Chưa sao chép được. Bạn có thể chọn và chép thông tin bên dưới.', 'caution'); }
  };

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);

        if (decoded?.data) {
          const parsed = parseVietQRPayload(decoded.data);
          if (parsed) {
            applyScannedResult(parsed);
            onNotify('Đã đọc thông tin từ ảnh VietQR.', 'safe');
            return;
          }
        }

        onNotify('Không đọc được mã VietQR hợp lệ từ ảnh này.', 'caution');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Thanh toán QR" className="fixed inset-0 z-50 bg-[var(--ink-primary)]/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-backdrop">
      <div className="w-full max-w-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-lg animate-sheet-up">
        {/* Header */}
        <div className="bg-[var(--tone-white)] px-5 pt-4 pb-3 border-b border-[var(--border-hairline)] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--brand)]">Bước {step}/3</p>
              <h2 className="text-sm font-semibold text-[var(--ink-primary)]">
                {step === 1 && 'Quét mã VietQR'}
                {step === 2 && 'Nhập số tiền & mục đích'}
                {step === 3 && 'Chuyển tiền & xác nhận'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setCameraActive(false);
                onClose();
              }}
              aria-label="Đóng"
              className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-canvas)] cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-colors ${
                  s <= step ? 'bg-[var(--brand)]' : 'bg-[var(--border-hairline)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* STEP 1: PURE SCANNER */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="bg-[var(--brand-dark)] text-[var(--tone-white)] rounded-2xl p-4 flex flex-col items-center gap-4">
                {cameraActive ? (
                  <div className="relative w-full aspect-square max-h-64 rounded-xl overflow-hidden bg-[var(--tone-black)]">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-2 border-[var(--color-22c55e)]/80 m-7 rounded-xl pointer-events-none" />
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center text-center gap-2.5">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--tone-white)]/10 flex items-center justify-center text-[var(--color-86efac)]">
                      <QrCode className="w-7 h-7" strokeWidth={1.75} />
                    </div>
                    <p className="text-xs text-[var(--color-d1d5db)] max-w-[230px]">
                      Đưa camera vào mã VietQR hoặc tải ảnh mã QR từ máy.
                    </p>
                  </div>
                )}

                {cameraError && (
                  <p className="text-xs text-[var(--color-fca5a5)] text-center">{cameraError}</p>
                )}

                <div className="w-full grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraActive(!cameraActive)}
                    className="py-2.5 px-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" strokeWidth={1.75} />
                    <span>{cameraActive ? 'Tắt camera' : 'Mở camera'}</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-[var(--tone-white)]/10 hover:bg-[var(--tone-white)]/20 text-[var(--tone-white)] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" strokeWidth={1.75} />
                    <span>Tải ảnh QR</span>
                  </button>
                </div>
              </div>

              {/* Optional manual recipient entry */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-primary)] underline underline-offset-2 cursor-pointer"
                >
                  {showManualEntry ? 'Ẩn nhập thủ công' : 'Hoặc nhập số tài khoản thủ công'}
                </button>
              </div>

              {showManualEntry && (
                <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-2.5">
                  <input
                    type="text"
                    placeholder="Tên người nhận / Quán"
                    value={draft.merchant}
                    onChange={(e) =>
                      onUpdateDraft({
                        ...draft,
                        merchant: e.target.value,
                        accountHolder: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink-primary)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={draft.bankName}
                      onChange={(e) => onUpdateDraft({ ...draft, bankName: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink-primary)]"
                    >
                      {BANK_OPTIONS.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Số tài khoản"
                      value={draft.accountNumber}
                      onChange={(e) => onUpdateDraft({ ...draft, accountNumber: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--ink-primary)] tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!draft.accountNumber.trim()) {
                        onNotify('Vui lòng nhập số tài khoản nhận.', 'caution');
                        return;
                      }
                      onUpdateDraft({
                        ...draft,
                        merchant: draft.merchant.trim() || draft.accountNumber.trim(),
                        accountHolder:
                          draft.accountHolder.trim() || draft.accountNumber.trim(),
                        transferNote: draft.transferNote || 'CHUYEN KHOAN',
                        qrMode: 'Nhập thủ công',
                      });
                      onSetStep(2);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[var(--brand)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
                  >
                    Tiếp tục
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: AMOUNT + PURPOSE + WALLET */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onSetStep(1)}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)] font-medium cursor-pointer"
                >
                  ← Quét lại
                </button>
                <span className="text-xs font-medium text-[var(--ink-muted)]">{draft.qrMode}</span>
              </div>

              {/* Recipient Info */}
              <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-3.5">
                <p className="text-xs text-[var(--ink-muted)]">{draft.bankName}</p>
                <p className="text-sm font-semibold text-[var(--ink-primary)] truncate">
                  {draft.accountHolder || draft.merchant}
                </p>
                <p className="text-xs text-[var(--ink-muted)] tabular-nums truncate">
                  STK: {draft.accountNumber}
                </p>
              </div>

              {/* Amount + Purpose + Wallet */}
              <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                    Số tiền (VND)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="numeric" placeholder="0"
                      value={draft.amount ? formatNumberWithDots(draft.amount) : ''}
                      onChange={(e) =>
                        onUpdateDraft({ ...draft, amount: parseNumberWithDots(e.target.value) })
                      }
                      className="w-full px-3 py-2.5 pr-8 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xl font-semibold text-[var(--ink-primary)] tabular-nums"
                    />
                    <span className="absolute right-3 text-sm font-semibold text-[var(--ink-muted)] pointer-events-none">
                      đ
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {[25000, 35000, 50000, 100000, 200000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onUpdateDraft({ ...draft, amount: v })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums border transition cursor-pointer ${
                          draft.amount === v
                            ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--ink-muted)] border-[var(--border-hairline)] hover:border-[var(--ink-primary)]'
                        }`}
                      >
                        {formatVND(v)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                    Mục đích chi tiêu
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(CATEGORIES).map((c) => {
                      const active = draft.category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onUpdateDraft({ ...draft, category: c.id })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            active
                              ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]'
                              : 'bg-[var(--bg-canvas)] text-[var(--ink-muted)] border-[var(--border-hairline)] hover:border-[var(--ink-primary)]'
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="helper-text block" htmlFor="qr-budget-source">Khoản chi này thuộc</label>
                <select id="qr-budget-source" className="app-input" value={draft.plannedExpenseId ? `plan:${draft.plannedExpenseId}` : draft.budgetSource || 'daily'} onChange={e => {
                  const { plannedExpenseId: _removed, ...clean } = draft;
                  const plan = plannedExpenses.find(p => `plan:${p.id}` === e.target.value);
                  onUpdateDraft(plan ? { ...clean, plannedExpenseId: plan.id, budgetSource: 'daily', amount: plan.amount, category: plan.category } : { ...clean, budgetSource: e.target.value as 'daily' | 'fixed' });
                }}>
                  <option value="daily">Chi tiêu hằng ngày</option>
                  <option value="fixed">Chi phí cố định đã dự trù</option>
                  {plannedExpenses.filter(p => !p.completed).map(p => <option key={p.id} value={`plan:${p.id}`} disabled={draft.qrMode === 'QR Động' && p.amount !== draft.amount}>{p.title}: {formatVND(p.amount)}</option>)}
                </select>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5" htmlFor="qrpaymentdrawer-1">
                    Trừ từ ví
                  </label>
                  <select id="qrpaymentdrawer-1"
                    value={draft.accountId}
                    onChange={(e) => onUpdateDraft({ ...draft, accountId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
                  >
                    {accounts
                      .filter((a) => a.type === 'checking')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} / {formatVND(a.balance)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Compact Impact Check */}
              {draft.plannedExpenseId || draft.budgetSource === 'fixed' ? <p className="helper-text">Khoản này dùng ngân sách đã dự trù. Phần vượt chi phí cố định sẽ giảm tiền có thể chi.</p> : <div
                className={`rounded-2xl border p-3.5 text-xs tabular-nums ${
                  impact.willOverspendToday
                    ? 'bg-[var(--tone-danger-soft)] border-[var(--tone-danger-border)] text-[var(--tone-danger)]'
                    : 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)] text-[var(--brand)]'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    {impact.willOverspendToday
                      ? 'Vượt hạn mức hôm nay'
                      : 'Trong hạn mức hôm nay'}
                  </span>
                  <span>
                    Còn: {formatVND(impact.afterTodayDelta, true)}
                  </span>
                </div>
              </div>}

              <button
                type="button"
                onClick={onProceedToBank}
                disabled={busy || !selectedWallet || draft.amount <= 0 || draft.amount > selectedWallet.balance}
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold transition cursor-pointer"
              >
                {busy ? 'Đang lưu khoản chờ…' : `Tiếp tục với ${formatVND(draft.amount)}`}
              </button>
            </>
          )}

          {/* STEP 3: BANK LAUNCHER + CONFIRM */}
          {step === 3 && (
            <>
              <div className="p-3.5 rounded-2xl bg-[var(--tone-caution-soft)] border border-[var(--tone-caution-border)] text-xs text-[var(--tone-caution)] leading-relaxed tabular-nums">
                Đã giữ trong sổ <span className="font-semibold">{formatVND(draft.amount)}</span> từ{' '}
                <span className="font-semibold">{selectedWallet?.name || 'ví'}</span> (Chờ xác nhận).
              </div>

              <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--ink-primary)]">
                  Mở ngân hàng của bạn
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BANK_OPTIONS.filter(bank => bank.name === selectedWallet?.name).map((bank) => {
                    let deeplink: string;
                    try { deeplink = buildBankAppDeeplink(bank.appId, {
                      bankName: draft.bankName,
                      accountNumber: draft.accountNumber,
                      amount: draft.amount,
                      transferNote: draft.transferNote,
                    }); } catch { return null; }
                    return (
                      <a
                        key={bank.id}
                        href={deeplink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          onNotify(
                            `Đang mở ${bank.name}. Sau khi chuyển xong, hãy xác nhận lại.`,
                            'neutral'
                          );
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          bank.name === selectedWallet?.name
                            ? 'bg-[var(--ink-primary)] text-[var(--tone-white)] border-[var(--ink-primary)]'
                            : 'bg-[var(--bg-canvas)] text-[var(--ink-primary)] border-[var(--border-hairline)] hover:border-[var(--ink-primary)]'
                        }`}
                      >
                        <span>{bank.name}</span>
                        <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                      </a>
                    );
                  })}
                </div>

                <p className="text-sm text-[var(--ink-muted)]">Một số ngân hàng chỉ hỗ trợ mở ứng dụng, cần nhập lại thông tin. Kiểm tra người nhận trong app ngân hàng. Ví An không tự chuyển tiền hay tự xác nhận kết quả.</p>
                <p className="helper-text">Sổ đang trừ từ {selectedWallet?.name}. Hãy chuyển từ đúng tài khoản này; nếu dùng ví khác, hủy khoản chờ và chọn lại ví.</p>
                {/* Copy STK & Note */}
                <div className="pt-2.5 border-t border-[var(--border-hairline)] space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums font-semibold text-[var(--ink-primary)] truncate">
                      STK: {draft.accountNumber} ({draft.bankName})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(draft.accountNumber, 'account')}
                      className="text-xs font-semibold text-[var(--brand)] flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'account' ? (
                        <>
                          <Check className="w-3 h-3" /> Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Chép STK
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--ink-muted)] truncate">ND: {draft.transferNote}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(draft.transferNote, 'note')}
                      className="text-xs font-semibold text-[var(--brand)] flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'note' ? (
                        <>
                          <Check className="w-3 h-3" /> Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Chép ND
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--ink-primary)] tabular-nums">
                  2. Bạn đã chuyển {formatVND(draft.amount)} thành công chưa?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                  onClick={() => pendingTxId && onConfirmPayment(pendingTxId)}
                    className="py-3 px-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-[var(--tone-white)] text-xs font-semibold cursor-pointer"
                  >
                    Đã chuyển xong
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                  onClick={() => pendingTxId && onCancelPayment(pendingTxId)}
                    className="py-3 px-3 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-[var(--tone-danger)] hover:bg-[var(--tone-danger-soft)] text-xs font-semibold cursor-pointer"
                  >
                    Hủy & hoàn tiền
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
