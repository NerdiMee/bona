const P = (d: string, extra?: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={d} />{extra}</svg>
);
export const ArrowUpRight = () => P("M7 17L17 7M9 7h8v8");
export const Camera = () => P("M4 8h3l2-3h6l2 3h3v11H4z", <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />);
export const Flip = () => P("M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4");
export const Mic = () => P("M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4");
export const MicOff = () => P("M3 3l18 18M9 9v3a3 3 0 0 0 5 2.2M15 10V6a3 3 0 0 0-6 0M6 11a6 6 0 0 0 9.5 4.9M12 17v4");
export const Sound = () => P("M4 10v4h4l5 4V6l-5 4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11");
export const Mirror = () => P("M12 3v18M4 7l5 5-5 5zM20 7l-5 5 5 5z");
export const Expand = () => P("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5");
export const Copy = () => P("M9 9h11v11H9zM5 15H4V4h11v1");
export const Torch = () => P("M9 2h6v4l-2 3v11a1 1 0 0 1-2 0V9L9 6z");
export const Refresh = () => P("M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5");
export const Check = () => P("M5 12l5 5L20 7");
export const Lens = () => P("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z");
