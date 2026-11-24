// Lucian UX/UI Prompt #435 / MIT License (c) 2026 Seokwoooo / https://lucianlabs.dev/uxui-prompt/#435
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import './toast.css';

// Port of the notification surface, stroke draw, timer and swipe. Undo is omitted
// because a persisted financial action needs its own explicit reversal workflow.
export function Toast({ message, tone, onClose }: { message: string; tone: 'safe' | 'caution' | 'neutral'; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const [x, setX] = useState(0);
  const started = useRef(0);
  const remaining = useRef(7000);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { remaining.current = 7000; setX(0); }, [message]);
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const timer = setTimeout(() => close.current(), remaining.current);
    return () => { clearTimeout(timer); remaining.current -= Date.now() - start; };
  }, [paused, message]);
  return <section className={`ux u435 tone-${tone}`} aria-label="Thông báo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <div className="u435-t is-in" role={tone === 'caution' ? 'alert' : 'status'} style={{ transform: `translateX(${x}px)`, opacity: Math.max(.35, 1 - Math.abs(x) / 320) }} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; started.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setX(e.clientX - started.current); }}
      onPointerUp={() => { if (Math.abs(x) > 80) onClose(); else setX(0); }} onPointerCancel={() => setX(0)}>
      <span className="u435-ic" aria-hidden="true"><span className="ok">{tone === 'caution' ? <AlertCircle /> : <Check />}</span></span>
      <span className="u435-tx"><b>{message}</b></span>
      <button type="button" className="u435-x" aria-label="Đóng thông báo" onClick={onClose}><X /></button>
      <span className="u435-pb" aria-hidden="true"><i key={message} style={{ animationDuration: '7000ms', animationPlayState: paused ? 'paused' : 'running' }} /></span>
    </div>
  </section>;
}
