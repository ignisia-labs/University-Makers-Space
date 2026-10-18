import { useEffect, useState } from "react";

/** Trims and debounces a search term so typing does not fire a request per keystroke. */
export function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value.trim()), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}
