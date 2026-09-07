import { useEffect, useRef, useState } from "react";
import { errorMessage } from "./values";

/** Read-only previews never survive changed input, wallet, network, or unmount. */
export function useCheck<T>(key: string) {
  const sequence = useRef({ value: 0 });
  const [state, setState] = useState<{
    key: string;
    pending?: boolean;
    value?: T;
    error?: string;
  }>({ key });
  useEffect(() => {
    const counter = sequence.current;
    counter.value++;
    setState({ key });
    return () => {
      counter.value++;
    };
  }, [key]);
  const run = async (check: () => Promise<T>) => {
    const request = ++sequence.current.value;
    setState({ key, pending: true });
    try {
      const value = await check();
      if (request !== sequence.current.value) return;
      setState({ key, value });
      return value;
    } catch (error) {
      if (request === sequence.current.value)
        setState({ key, error: errorMessage(error) });
    }
  };
  return { ...(state.key === key ? state : { key }), run };
}
