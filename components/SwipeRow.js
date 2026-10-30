'use client';
import { useRef, useState } from 'react';

// Swipe left to reveal a red Delete button; tap still does the normal thing.
const OPEN = -84;

export default function SwipeRow({ children, onTap, onDelete, label, className = '', title }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const swiped = useRef(false);

  function down(e) {
    start.current = { x: e.clientX, y: e.clientY, base: x, id: e.pointerId, horizontal: null };
    swiped.current = false;
  }
  function move(e) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (s.horizontal) {
        try { e.currentTarget.setPointerCapture(s.id); } catch (err) { /* ignore */ }
        setDragging(true);
      }
    }
    if (s.horizontal) {
      swiped.current = true;
      setX(Math.max(OPEN - 30, Math.min(0, s.base + dx)));
    }
  }
  function up() {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (s && s.horizontal) setX((v) => (v < OPEN / 2 ? OPEN : 0));
  }
  function click(e) {
    if (swiped.current) {
      e.preventDefault();
      swiped.current = false;
      return;
    }
    if (x !== 0) {
      setX(0);
      return;
    }
    onTap && onTap();
  }

  return (
    <div className="swipe">
      <button className="swipe-del" style={{ visibility: x === 0 && !dragging ? 'hidden' : 'visible' }} onClick={onDelete} tabIndex={x === 0 ? -1 : 0} aria-label={`Delete ${label}`}>
        Delete
      </button>
      <button
        className={`line ${className}`}
        title={title}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={click}
      >
        {children}
      </button>
    </div>
  );
}
