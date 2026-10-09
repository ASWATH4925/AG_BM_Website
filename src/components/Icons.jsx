const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const ChevronDown = (p) => (
  <svg {...base} strokeWidth="2.5" width="14" height="14" {...p}><path d="m6 9 6 6 6-6" /></svg>
);

export const ChevronRight = (p) => (
  <svg {...base} strokeWidth="2" width="15" height="15" {...p}><path d="m9 18 6-6-6-6" /></svg>
);

export const LogOut = (p) => (
  <svg {...base} strokeWidth="2" width="14" height="14" {...p}>
    <path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </svg>
);
