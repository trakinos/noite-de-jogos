import { useEffect, useState } from 'react';

const supported = () => typeof matchMedia === 'function';

/** Whether a CSS media query matches now; re-renders when that changes. Without matchMedia (jsdom) it never matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => supported() && matchMedia(query).matches);
  useEffect(() => {
    if (!supported()) return;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
