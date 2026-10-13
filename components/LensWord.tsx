import { useId } from "react";

/* Sets a word with every O drawn as a camera lens: a navy iris with an amber inner ring and a small catchlight.
 * The letters stay real text for screen readers; the glyph is decorative. */
export function LensGlyph({ lower = false }: { lower?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`lens-o${lower ? " lower" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id={`iris-${id}`} cx="42%" cy="38%" r="68%"><stop offset="0" stopColor="#3b5a92" /><stop offset="0.55" stopColor="#1b2d53" /><stop offset="1" stopColor="#07152d" /></radialGradient>
          <radialGradient id={`glass-${id}`} cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.05" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" />
        <circle cx="50" cy="50" r="33" fill={`url(#iris-${id})`} />
        <circle cx="50" cy="50" r="33" fill="none" stroke="#d97706" strokeWidth="3.5" />
        <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        <circle cx="50" cy="50" r="33" fill={`url(#glass-${id})`} />
        <circle cx="40" cy="38" r="6" fill="#fff" fillOpacity="0.85" />
      </svg>
    </span>
  );
}

export default function LensWord({ text }: { text: string }) {
  /* One lens per word: the first O of each word becomes the glyph, any second one stays a letter. */
  const parts = text.split(/(\s+)/);
  return (
    <span aria-label={text}>
      {parts.map((part, pi) => {
        const at = part.search(/[oO]/);
        return part.split("").map((ch, i) => (i === at ? <LensGlyph key={`${pi}-${i}`} lower={ch === "o"} /> : <span key={`${pi}-${i}`} aria-hidden="true">{ch}</span>));
      })}
    </span>
  );
}
