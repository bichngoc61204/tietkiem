import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { CalendarCheck, QrCode, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mapAuthError = (code: string): string => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
      case 'auth/email-already-in-use':
        return 'Email này đã có tài khoản. Hãy chuyển sang đăng nhập.';
      case 'auth/weak-password':
        return 'Mật khẩu cần tối thiểu 6 ký tự.';
      case 'auth/invalid-email':
        return 'Định dạng email không hợp lệ.';
      default:
        return 'Không thể kết nối xác thực. Vui lòng thử lại sau.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setErrorMsg(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-3xl overflow-hidden grid lg:grid-cols-12 shadow-[var(--shadow-auth)]">
        {/* Left Editorial Passbook Panel */}
        <div className="auth-intro lg:col-span-6 bg-[var(--brand-dark)] text-[var(--tone-white)] p-7 sm:p-9 flex flex-col justify-between gap-8">
          <div>
            <span className="inline-block text-xs font-semibold tracking-normal text-[var(--color-34d399)]">
              VÍ AN
            </span>
            <h1 className="mt-4 text-2xl sm:text-[28px] font-semibold leading-snug tracking-tight">
              Chi tiêu rõ ràng. Tiết kiệm an tâm.
            </h1>
            <p className="mt-3 text-sm text-[var(--color-a1a1aa)] leading-relaxed">
              Quét QR, chuyển tiền và ghi lại khoản chi. Mỗi ngày đều biết mình còn bao nhiêu để dùng.
            </p>
          </div>

          <div className="auth-features space-y-3.5 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--tone-white)]/10 flex items-center justify-center shrink-0 text-[var(--color-34d399)]">
                <QrCode className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-[var(--tone-white)]">Quét VietQR & giữ tiền chờ xác nhận</p>
                <p className="text-[var(--color-a1a1aa)] mt-0.5">
                  Tự động trừ tạm ví khi mở app ngân hàng; hủy sẽ hoàn lại số dư ngay lập tức.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--tone-white)]/10 flex items-center justify-center shrink-0 text-[var(--color-34d399)]">
                <CalendarCheck className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-[var(--tone-white)]">Lịch chu kỳ lương tự cân bằng</p>
                <p className="text-[var(--color-a1a1aa)] mt-0.5">
                  Ngân sách điều chỉnh theo khoản chi đã ghi và ngày nhận lương của bạn.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--tone-white)]/10 flex items-center justify-center shrink-0 text-[var(--color-34d399)]">
                <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-[var(--tone-white)]">Dự trù chi tiêu & quét dư tiết kiệm</p>
                <p className="text-[var(--color-a1a1aa)] mt-0.5">
                  Khóa sẵn tiền cho các khoản sắp tới để không bị ảo giác giàu đầu tháng.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-6 p-7 sm:p-9 flex flex-col justify-center bg-[var(--bg-paper)]">
          <div className="max-w-sm w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink-primary)]">
                {mode === 'login' ? 'Đăng nhập vào Ví An' : 'Tạo tài khoản mới'}
              </h2>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Đăng nhập để mở sổ chi tiêu của bạn.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-[var(--tone-white)] border border-[var(--border-hairline)] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mode === 'login' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mode === 'register' ? 'bg-[var(--ink-primary)] text-[var(--tone-white)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                Đăng ký mới
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[var(--tone-danger-soft)] border border-[var(--tone-danger-border)] text-xs font-medium text-[var(--tone-danger)]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-[var(--ink-primary)] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  id="auth-email" autoComplete="email" placeholder="ban@email.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-sm text-[var(--ink-primary)] focus:border-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-[var(--ink-primary)] mb-1.5">
                  Mật khẩu
                </label>
                <input
                  id="auth-password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--tone-white)] border border-[var(--border-hairline)] text-sm text-[var(--ink-primary)] focus:border-[var(--ink-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[var(--ink-primary)] hover:bg-[var(--color-27272a)] disabled:opacity-60 text-[var(--tone-white)] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Đang xử lý...'
                    : mode === 'login'
                    ? 'Đăng nhập ngay'
                    : 'Tạo tài khoản & dùng thử 14 ngày'}
                </span>

              </button>
            </form>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Ví An không yêu cầu mật khẩu ngân hàng hay mã OTP. Toàn bộ dữ liệu được phân quyền
              riêng tư theo tài khoản của bạn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
