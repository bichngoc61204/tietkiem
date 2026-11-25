// Lucian UX/UI Prompt #042 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#042
/* Hallmark · waive 28b · Video is a live camera stream started on request · A poster would mask camera status; there is no prerecorded video. */
import { useModal } from '../hooks/useModal';
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Check, Copy, ExternalLink, ImagePlus, QrCode, X, ArrowUpRight, Landmark, LoaderCircle } from 'lucide-react';
import { CATEGORIES } from '../data/mockData';
import { Account, CategoryId, CycleBudgetMetrics, PlannedExpense } from '../types/finance';
import { previewPaymentImpact } from '../utils/budgetEngine';
import { formatNumberWithDots, formatVND, parseNumberWithDots } from '../utils/format';
import { BANK_OPTIONS, SENDER_BANKS, bankForWallet, bankLaunchHref, buildBankAppDeeplink, parseVietQRPayload } from '../utils/vietqr';
import { prepareBankHandoff } from '../utils/bankHandoff';
import './qr-payment.css';

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
  const launchInFlight = useRef(false);
  const modalRef = useModal(isOpen, () => { if (!launchInFlight.current && !busy) onClose(); });
  const [senderAppId, setSenderAppId] = useState(() => {
    const wallet = accounts.find(a => a.id === draft.accountId);
    return wallet ? bankForWallet(wallet)?.appId || '' : '';
  });
  const [launchStatus, setLaunchStatus] = useState('');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const direction = step >= previousStep.current ? 1 : -1;
  useEffect(() => {
    previousStep.current = step;
    bodyRef.current?.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const [copiedKey, setCopiedKey] = useState<'account' | 'note' | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const defaultWalletId = accounts.find(a => a.id === 'vian' && a.type === 'checking')?.id || accounts.find((a) => a.type === 'checking')?.id || '';
  const checkingWallets = accounts.filter(a => a.type === 'checking');
  const senderBank = SENDER_BANKS.find(bank => bank.appId === senderAppId);

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

  let bankLink = '';
  let linkError = '';
  if (senderBank && draft.amount > 0 && draft.accountNumber) {
    try { bankLink = buildBankAppDeeplink(senderBank.appId, draft); }
    catch (error) { linkError = error instanceof Error ? error.message : 'Chưa tạo được liên kết ngân hàng.'; }
  }
  const canLaunch = !!bankLink && selectedWallet?.type === 'checking' && draft.amount <= selectedWallet.balance;
  const launchHref = senderBank ? bankLaunchHref(senderBank.appId, bankLink, isIOS) : bankLink;

  const handleLaunchBank = async () => {
    if (busy || launchInFlight.current || !canLaunch) return;
    launchInFlight.current = true;
    // Start clipboard access in the same tap as well (Safari requires activation).
    if (!senderBank?.autofill) void handleCopy(draft.accountNumber, 'account');
    // Reserve within the user's tap. Opening a tab after awaiting Firestore gets
    // blocked by mobile browsers. Navigate it only after the hold has committed.
    try {
      const { saved, launched } = await prepareBankHandoff(launchHref, onProceedToBank);
      if (!saved) return;
      setLaunchStatus(launched ? 'Đã gửi yêu cầu mở ngân hàng. Nếu app chưa mở, chạm nút bên dưới.' : 'Trình duyệt đã chặn cửa sổ mở app. Chạm nút bên dưới để mở trực tiếp.');
      onSetStep(3);
    } catch {
      onNotify('Chưa mở được ngân hàng. Vui lòng thử lại.', 'caution');
    } finally { launchInFlight.current = false; }
  };

  const handleCopy = async (text: string, key: 'account' | 'note') => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopiedKey(null), 2000); }
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
    <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Thanh toán QR" className="qr-payment fixed inset-0 z-50 bg-[var(--ink-primary)]/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4 animate-backdrop">
      <div className="w-full max-w-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-lg animate-sheet-up">
        {/* Header */}
        <div className="bg-[var(--tone-white)] px-5 pt-4 pb-3 border-b border-[var(--border-hairline)] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--brand)]">Bước {step}/3</p>
              <h2 ref={titleRef} tabIndex={-1} className="text-sm font-semibold text-[var(--ink-primary)]">
                {step === 1 && 'Quét mã VietQR'}
                {step === 2 && 'Chuyển cho ai, gửi từ đâu?'}
                {step === 3 && 'Chuyển xong, quay lại đây nhé'}
              </h2>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (launchInFlight.current) return;
                setCameraActive(false);
                onClose();
              }}
              aria-label="Đóng"
              className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-canvas)] cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <ol className="u042-steps" aria-label="Các bước chuyển khoản">
            <li className="u042-line" aria-hidden="true" style={{ '--p': (step - 1) / 2 } as React.CSSProperties}><i /></li>
            {['Quét mã', 'Chọn ngân hàng', 'Xác nhận'].map((label, index) => (
              <li key={label} className={`u042-st ${index + 1 === step ? 'cur' : index + 1 < step ? 'done' : ''}`}>
                <span className="u042-dot" aria-current={index + 1 === step ? 'step' : undefined}>
                  <span>{index + 1}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" /></svg>
                </span>
                <small>{label}</small>
              </li>
            ))}
          </ol>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="qr-scroll p-5 overflow-y-auto">
          <fieldset key={step} disabled={busy} className="qr-pane space-y-4" style={{ '--qr-dir': direction } as React.CSSProperties}>
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
                    aria-label="Tên người nhận hoặc quán" placeholder="Tên người nhận / Quán"
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
                      aria-label="Ngân hàng nhận" value={draft.bankName}
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
                      aria-label="Số tài khoản nhận" placeholder="Số tài khoản"
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

              <div className="qr-recipient">
                <span className="qr-recipient-avatar" aria-hidden="true"><ArrowUpRight /></span>
                <div>
                  <p className="helper-text">Người nhận · {draft.bankName}</p>
                  <p className="qr-recipient-name">{draft.accountHolder || draft.merchant}</p>
                  <p className="tabular-nums">{draft.accountNumber}</p>
                </div>
                <button type="button" onClick={() => handleCopy(draft.accountNumber, 'account')} aria-label="Sao chép số tài khoản nhận" className="qr-copy">
                  {copiedKey === 'account' ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <section className="qr-sender" aria-labelledby="qr-sender-title">
                <h3 id="qr-sender-title">Bạn gửi từ ngân hàng nào?</h3>
                <div className="qr-bank-options" role="group" aria-label="Ngân hàng gửi thường dùng">
                  {['vcb', 'mb', 'acb'].map(id => SENDER_BANKS.find(bank => bank.appId === id)!).map(bank => (
                    <button type="button" key={bank.id} aria-pressed={senderAppId === bank.appId} className={`qr-bank ${senderAppId === bank.appId ? 'is-selected' : ''}`} onClick={() => {
                      setSenderAppId(bank.appId);
                    }}>
                      <span className="qr-bank-mark" aria-hidden="true"><Landmark size={20} /></span>
                      <span><strong>{bank.name}</strong><small>{bank.autofill ? 'Có tự điền' : 'Mở ứng dụng'}</small></span>
                      {senderAppId === bank.appId && <Check size={18} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <label className="helper-text" htmlFor="qr-sender-bank">Chọn ngân hàng gửi</label>
                <select id="qr-sender-bank" className="app-input" value={senderAppId} onChange={e => {
                  setSenderAppId(e.target.value);
                }}>
                  <option value="">Chọn ngân hàng của bạn</option>
                  {SENDER_BANKS.map(bank => <option key={bank.appId} value={bank.appId}>{bank.name}{bank.autofill ? ' · có tự điền' : ''}</option>)}
                </select>
                {checkingWallets.length > 1 && <><label className="helper-text" htmlFor="qr-ledger-wallet">Ví ghi khoản chi trong sổ</label><select id="qr-ledger-wallet" className="app-input" value={draft.accountId} onChange={e => onUpdateDraft({ ...draft, accountId: e.target.value })}>{checkingWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name} · {formatVND(wallet.balance)}</option>)}</select></>}
                <p className="helper-text">Ghi chi từ {selectedWallet?.name || 'ví của bạn'} trong sổ · {selectedWallet ? formatVND(selectedWallet.balance) : 'Chưa có ví chi tiêu'}. Số dư này do bạn quản lý, không liên kết ngân hàng.</p>
                {senderBank && <p className="qr-bank-notice">{senderBank.autofill ? `${senderBank.name} có hỗ trợ điền sẵn thông tin. Hãy kiểm tra người nhận trong app trước khi chuyển.` : `${senderBank.name} hiện chỉ hỗ trợ mở app, chưa tự điền. Chép STK tại đây để dán trong app, không cần quét lại.`}</p>}
              </section>

              {/* Amount + Purpose + Wallet */}
              <div className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5">
                <div>
                  <label htmlFor="qr-amount" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">
                    Số tiền (VND)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      id="qr-amount" inputMode="numeric" placeholder="0"
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
                  <div role="group" aria-label="Mục đích chi tiêu" className="flex flex-wrap gap-1.5">
                    {Object.values(CATEGORIES).map((c) => {
                      const active = draft.category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button" aria-pressed={active}
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
                <div className="qr-handoff-heading"><span className="qr-bank-mark"><Landmark size={24} /></span><div><h3>{senderBank?.name || selectedWallet?.name}</h3><p className="helper-text">Khoản chờ đã lưu, chưa xác nhận đã chuyển.</p></div></div>
                <p role="status" className="helper-text">{launchStatus || 'Chạm nút bên dưới để mở ngân hàng.'}</p>
                {bankLink && <a href={launchHref} target="_blank" rel="noopener noreferrer" className="qr-launch" aria-disabled={busy} tabIndex={busy ? -1 : undefined} onClick={e => { if (busy) { e.preventDefault(); return; } if (!senderBank?.autofill) void handleCopy(draft.accountNumber, 'account'); setLaunchStatus('Đã gửi yêu cầu mở app. Khi chuyển xong, quay lại đây xác nhận.'); }}>
                  <span>{senderBank && !senderBank.autofill ? 'Chép STK & mở' : 'Mở'} {senderBank?.name}</span><ExternalLink size={18} />
                </a>}
                {launchHref !== bankLink && <a href={bankLink} target="_blank" rel="noopener noreferrer" className="qr-alternate" aria-disabled={busy} tabIndex={busy ? -1 : undefined} onClick={e => { if (busy) e.preventDefault(); }}>Thử mở qua VietQR <ExternalLink size={14} /></a>}
                <p className="helper-text">{senderBank?.autofill ? 'Kiểm tra người nhận và số tiền trong ứng dụng ngân hàng trước khi chuyển.' : 'Ngân hàng này chưa hỗ trợ tự điền. Chép số tài khoản bên dưới để dán vào app.'}</p>
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
                  Bạn đã chuyển {formatVND(draft.amount)} thành công chưa?
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
          </fieldset>
        </div>
        {step === 2 && <div className="qr-footer">
              {linkError && <p role="alert" className="helper-text">{linkError}</p>}
              {selectedWallet && draft.amount > selectedWallet.balance && <p role="alert" className="helper-text">Ví này chưa đủ số dư trong sổ. Kiểm tra lại ví hoặc số tiền.</p>}
              <button
                type="button"
                onClick={handleLaunchBank}
                disabled={busy || !canLaunch}
                className="qr-launch"
              >
                {busy ? <><LoaderCircle className="qr-spinner" size={18} /> Đang lưu khoản chờ…</> : <><span>{senderBank && !senderBank.autofill ? 'Chép STK & mở' : 'Mở'} {senderBank?.name || 'ngân hàng'}<small>{formatVND(draft.amount)}</small></span><ArrowUpRight size={22} /></>}
              </button>
        </div>}
      </div>
    </div>
  );
};
