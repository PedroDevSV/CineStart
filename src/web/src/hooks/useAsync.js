import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos de una función asíncrona y vuelve a cargar cuando cambian `deps`.
 * Mantiene los datos anteriores mientras recarga (sin parpadeos).
 */
export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => id === seq.current && setState({ data, error: null, loading: false }),
        (error) => id === seq.current && setState((s) => ({ ...s, error, loading: false })),
      );
  }, []);

  useEffect(() => {
    if (enabled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: run };
}
