/** A player's piece (or, without one, their initial) on a disc in their chosen color. */
export function Avatar({ name, color, online, piece }: { name: string; color: string; online?: boolean; piece?: string }) {
  return (
    <span className={`avatar${piece ? ' avatar--piece' : ''}`} style={{ background: color }} aria-hidden="true">
      {piece ?? (name.trim().charAt(0).toUpperCase() || '?')}
      {online !== undefined && <span className={`dot ${online ? 'dot--on' : ''}`} />}
    </span>
  );
}
