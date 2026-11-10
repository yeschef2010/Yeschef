'use client';
import { useRef } from 'react';

// Swipe right anywhere on a screen to go back, like the iPhone's own back swipe.
// The screen follows your finger; let go past about a third of the way (or flick) and it goes back.
export function useSwipeBack(onBack) {
  const s = useRef(null);
  const el = useRef(null);

  function reset(animate) {
    const node = el.current;
    if (!node) return;
    node.style.transition = animate ? 'transform 180ms ease-out, opacity 180ms ease-out' : '';
    node.style.transform = '';
    node.style.opacity = '';
  }

  return {
    ref: el,
    onTouchStart(e) {
      const t = e.touches[0];
      if (!onBack || e.touches.length > 1) return;
      if (e.target.closest('input, textarea, select, [role="dialog"], [data-noswipe]')) return;
      s.current = { x: t.clientX, y: t.clientY, at: Date.now(), dir: null, dx: 0 };
    },
    onTouchMove(e) {
      const st = s.current;
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      if (!st.dir) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        st.dir = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5 ? 'back' : 'other';
      }
      if (st.dir !== 'back') return;
      st.dx = Math.max(0, dx);
      const node = el.current;
      if (node) {
        node.style.transition = '';
        node.style.transform = `translateX(${st.dx}px)`;
        node.style.opacity = String(1 - Math.min(0.4, st.dx / 800));
      }
    },
    onTouchEnd() {
      const st = s.current;
      s.current = null;
      if (!st || st.dir !== 'back') return;
      const width = (el.current && el.current.offsetWidth) || 390;
      const fast = st.dx > 60 && st.dx / Math.max(1, Date.now() - st.at) > 0.5;
      if (st.dx > width * 0.33 || fast) {
        const node = el.current;
        if (node) {
          node.style.transition = 'transform 160ms ease-in, opacity 160ms ease-in';
          node.style.transform = `translateX(${width}px)`;
          node.style.opacity = '0.4';
        }
        setTimeout(() => {
          reset(false);
          onBack();
        }, 150);
      } else {
        reset(true);
      }
    },
    onTouchCancel() {
      s.current = null;
      reset(true);
    },
  };
}
