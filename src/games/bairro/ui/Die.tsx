import { useEffect, useRef, useState } from 'react';
import { pipsFor } from './pips';

/** How long the die bounces after it stops tumbling. */
const LAND_MS = 400;

interface Props {
  face: number;
  /** True while the faces are still changing: the die tumbles. */
  rolling: boolean;
}

/** One die drawn with pips on a 3×3 grid: it tumbles while rolling and bounces when it lands. */
export function Die({ face, rolling }: Props) {
  const [landing, setLanding] = useState(false);
  const was = useRef(rolling);

  useEffect(() => {
    const landed = was.current && !rolling;
    was.current = rolling;
    if (!landed) return;
    setLanding(true);
    const t = setTimeout(() => setLanding(false), LAND_MS);
    return () => clearTimeout(t);
  }, [rolling]);

  const pips = pipsFor(face);
  const cls = `bdie${rolling ? ' bdie--rolling' : ''}${landing ? ' bdie--land' : ''}`;
  return (
    <span className={cls} data-face={face}>
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={`bdie__pip${pips.includes(cell) ? ' bdie__pip--on' : ''}`} />
      ))}
    </span>
  );
}
