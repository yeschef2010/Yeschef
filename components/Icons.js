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
export const Basket = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S}><path d="M4 9 H20 L18 20 H6 Z" /><path d="M9 9 L12 4 L15 9" /></svg>
);
export const Person = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#AEB8B1"><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
);
export const Sliders = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#AEB8B1"><path d="M4 7 H20 M4 17 H20" /><circle cx="9" cy="7" r="2.5" fill="#1E2A22" /><circle cx="15" cy="17" r="2.5" fill="#1E2A22" /></svg>
);
export const Pan = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#AEB8B1"><circle cx="10" cy="13" r="7" /><path d="M17 11 L22 8" /></svg>
);
export const Info = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#AEB8B1"><circle cx="12" cy="12" r="9" /><path d="M12 11 V16 M12 8 H12.01" /></svg>
);
export const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...S} strokeWidth={3.5}><path d="M5 12 L10 17 L19 7" /></svg>
);
export const Pin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...S} stroke="#AEB8B1" style={{ flexShrink: 0, marginTop: 2 }}>
    <path d="M12 21 C12 21 5 14 5 9 a7 7 0 0 1 14 0 c0 5 -7 12 -7 12 z" /><circle cx="12" cy="9" r="2.5" />
  </svg>
);
export const Bag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#E8833A" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M5 8 H19 L17.5 20 H6.5 Z" /><path d="M9 8 V6 a3 3 0 0 1 6 0 V8" />
  </svg>
);

// Carrot, purple sprouting broccoli, carrot.
export function MenuIcon({ width = 32, height = 28 }) {
  const carrot = (
    <>
      <path d="M5 8 Q19 3.5 33 5.5 Q35.5 8 33 10.5 Q19 12.5 5 8 Z" fill="#E8833A" />
      <path d="M13 6.5 V8.5 M20 6 V9.5 M27 6 V9" stroke="#B9611F" strokeWidth="1.4" />
      <path d="M33 7 C37 3.5 41 3.5 44 6 M33 8 C38 7.5 42 9.5 44 13 M33 9 C36 10.5 38 13.5 38.5 16" stroke="#5FB36A" strokeWidth="2" />
    </>
  );
  return (
    <svg width={width} height={height} viewBox="0 0 48 42" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {carrot}
      <path d="M6 22 H42" stroke="#6FAE5A" strokeWidth="2.5" />
      <path d="M13 22 L15 17 M24 22 L24 16 M34 22 L32 17" stroke="#6FAE5A" strokeWidth="1.6" />
      <circle cx="13.5" cy="15.5" r="2.4" fill="#9B6BC8" /><circle cx="16.8" cy="15.2" r="2.1" fill="#B48BDB" /><circle cx="15" cy="13" r="2" fill="#8556B3" />
      <circle cx="22.5" cy="14.3" r="2.4" fill="#9B6BC8" /><circle cx="25.8" cy="14.3" r="2.2" fill="#B48BDB" /><circle cx="24.2" cy="11.8" r="2" fill="#8556B3" />
      <circle cx="31.2" cy="15.5" r="2.1" fill="#B48BDB" /><circle cx="34.5" cy="15.5" r="2.4" fill="#9B6BC8" /><circle cx="33" cy="13" r="2" fill="#8556B3" />
      <path d="M40 22 C42 19 44 19 45 21 C44 23.5 42 24 40 22 Z" fill="#5FB36A" />
      <g transform="translate(48 26) scale(-1 1)">{carrot}</g>
    </svg>
  );
}

export function Logo({ width = 220 }) {
  return (
    <svg width={width} height={(width * 170) / 290} viewBox="0 0 290 170" fill="none" role="img" aria-label="Yes Chef! logo: a knife slicing an orange">
      <circle cx="166" cy="100" r="40" fill="#B9611F" />
      <circle cx="160" cy="100" r="40" fill="#E8833A" />
      <circle cx="160" cy="100" r="36" fill="#FFF1D6" />
      <circle cx="160" cy="100" r="33" fill="#F6B04A" />
      <path d="M160 100 L191 100 M160 100 L185.1 118.2 M160 100 L169.6 129.5 M160 100 L150.4 129.5 M160 100 L134.9 118.2 M160 100 L129 100 M160 100 L134.9 81.8 M160 100 L150.4 70.5 M160 100 L169.6 70.5 M160 100 L185.1 81.8" stroke="#FFF1D6" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="88" cy="144" rx="34" ry="12" fill="#B9611F" />
      <ellipse cx="88" cy="141" rx="34" ry="12" fill="#E8833A" />
      <ellipse cx="88" cy="141" rx="30" ry="10" fill="#F6B04A" />
      <ellipse cx="102" cy="135" rx="34" ry="12" fill="#B9611F" />
      <ellipse cx="102" cy="132" rx="34" ry="12" fill="#E8833A" />
      <ellipse cx="102" cy="132" rx="30" ry="10" fill="#F6B04A" />
      <g transform="translate(70 20) rotate(34)">
        <rect x="0" y="-13" width="62" height="28" rx="11" fill="#D9C3A0" />
        <rect x="62" y="-16" width="7" height="34" rx="2" fill="#AEB8B1" />
        <path d="M69 -16 H185 C202 -16 214 -2 222 18 H69 Z" fill="#E6EAE7" />
        <path d="M69 -16 H185 C195 -16 203 -11 209 -4 H69 Z" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
