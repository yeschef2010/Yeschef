const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Back = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} strokeWidth={2.5}><path d="M15 6 L9 12 L15 18" /></svg>
);
export const Close = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...S} strokeWidth={3}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
);
export const Chevron = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...S} strokeWidth={2.5} style={{ transform: `rotate(${open ? 180 : 0}deg)` }}>
    <path d="M6 9 L12 15 L18 9" />
  </svg>
);
export const Video = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10 L21 7 V17 L16 14" /></svg>
);
export const Camera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const Mic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11 a7 7 0 0 0 14 0 M12 18 V21" /></svg>
);
export const Keyboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10 H7.01 M11 10 H11.01 M15 10 H15.01 M8 14 H16" /></svg>
);
export const Plate = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></svg>
);
export const Fridge = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M5 9 H19 M8 5 V7 M8 12 V15" /></svg>
);
export const Spray = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S}><path d="M8 9 H15 L16 21 H7 Z" /><path d="M9 9 V6 H13 L16 4 M13 6 L15 7.5" /><path d="M19 4 H19.01 M20 7 H20.01" /></svg>
);
export const Basket = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S}><path d="M4 9 H20 L18 20 H6 Z" /><path d="M9 9 L12 4 L15 9" /></svg>
);
export const Person = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#5D6E63"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
);
export const Sliders = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#5D6E63"><path d="M4 7 H20 M4 17 H20" /><circle cx="9" cy="7" r="2.5" fill="#FFFDF8" /><circle cx="15" cy="17" r="2.5" fill="#FFFDF8" /></svg>
);
export const Pan = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#5D6E63"><circle cx="10" cy="13" r="7" /><path d="M17 11 L22 8" /></svg>
);
export const Info = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#5D6E63"><circle cx="12" cy="12" r="9" /><path d="M12 11 V16 M12 8 H12.01" /></svg>
);
export const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...S} strokeWidth={3.5}><path d="M5 12 L10 17 L19 7" /></svg>
);
export const Pin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S} stroke="#5D6E63" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M12 21 C12 21 5 14 5 9 a7 7 0 0 1 14 0 c0 5 -7 12 -7 12 z" /><circle cx="12" cy="9" r="2.5" />
  </svg>
);
export const Bag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#EB4933" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M5 8 H19 L17.5 20 H6.5 Z" /><path d="M9 8 V6 a3 3 0 0 1 6 0 V8" />
  </svg>
);

// Menu: tomato-and-leaf burger from the brand pack (tomato, leaf green, tomato, with a sprig on top).
export function MenuIcon({ width = 28, height = 30 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 40 44" fill="none" aria-hidden="true">
      <path d="M20 13 C15 12 10.5 9 9 4.5 C14 4.5 18.5 7.5 20 13 Z" fill="#57933C" />
      <path d="M20 13 C25 12 29.5 9 31 4.5 C26 4.5 21.5 7.5 20 13 Z" fill="#57933C" />
      <path d="M20 13 C17.8 9.5 18 4.5 20 1 C22 4.5 22.2 9.5 20 13 Z" fill="#57933C" />
      <rect x="4" y="16" width="32" height="7" rx="3.5" fill="#EB4933" />
      <rect x="4" y="26" width="32" height="7" rx="3.5" fill="#57933C" />
      <rect x="4" y="36" width="32" height="7" rx="3.5" fill="#EB4933" />
    </svg>
  );
}

// The Yes Chef! fridge logo.
export function Logo({ width = 220 }) {
  return <img src="/logo.png" alt="Yes Chef!" width={width} height={Math.round((width * 640) / 637)} style={{ display: 'block' }} />;
}
