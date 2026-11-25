/** Reserve a tab in the original tap, before Firestore awaits lose popup activation. */
export function reserveBankHandoff(open: typeof window.open = window.open.bind(window)) {
  let tab: Window | null = null;
  try { tab = open('about:blank', '_blank'); } catch { return null; }
  if (!tab) return null;
  try {
    tab.document.title = 'Đang chuẩn bị mở ngân hàng';
    const message = tab.document.createElement('p');
    message.textContent = 'Đang lưu khoản chờ trong sổ… Ngân hàng sẽ mở sau khi lưu xong.';
    message.style.cssText = 'font:16px/1.6 system-ui;padding:32px;color:#123c2d';
    tab.document.body.append(message);
    tab.opener = null;
  } catch { /* The original page still provides a direct retry link. */ }
  return {
    launch(url: string): boolean {
      try {
        const destination = new URL(url);
        const officialWeb = destination.origin === 'https://dl.vietqr.io' && destination.pathname === '/pay';
        const vcbIOS = destination.href === 'vietcombankmobile://';
        if ((!officialWeb && !vcbIOS) || tab.closed) return false;
        try {
          tab.document.title = 'Mở ứng dụng ngân hàng';
          const fallback = tab.document.createElement('a');
          fallback.href = destination.href;
          fallback.textContent = 'Chạm để mở ngân hàng';
          fallback.style.cssText = 'display:block;margin:24px 32px;padding:16px;border-radius:18px;background:#166534;color:white;font:600 16px system-ui;text-align:center;text-decoration:none';
          tab.document.body.replaceChildren(fallback);
          const help = tab.document.createElement('p');
          help.textContent = 'Nếu app chưa mở, chạm nút phía trên. Khi chuyển xong, quay lại tab Ví An để xác nhận khoản chi.';
          help.style.cssText = 'font:16px/1.6 system-ui;padding:0 32px;color:#123c2d';
          tab.document.body.append(help);
        } catch { /* Original tab also retains a direct link. */ }
        tab.location.replace(destination.href);
        return true;
      } catch { return false; }
    },
    close() { try { tab.close(); } catch { /* Already closed. */ } },
  };
}

export async function prepareBankHandoff(
  url: string,
  save: () => Promise<boolean>,
  reserve: typeof reserveBankHandoff = reserveBankHandoff,
) {
  const handoff = reserve(); // Must run synchronously in the click handler.
  try {
    if (!await save()) { handoff?.close(); return { saved: false, launched: false }; }
    const launched = handoff?.launch(url) || false;
    if (!launched) handoff?.close();
    return { saved: true, launched };
  } catch (error) { handoff?.close(); throw error; }
}
