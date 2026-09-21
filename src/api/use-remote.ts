import { useCallback, useRef, useState } from 'react';

export type Remote<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

// État d'une requête vers l'API. `load` lance une requête et annule celle qui serait encore en cours.
// `onData` s'exécute juste avant l'affichage des données, dans la même mise à jour d'état.
export function useRemote<T>() {
  const [state, setState] = useState<Remote<T>>({ status: 'loading' });
  const controller = useRef<AbortController | null>(null);

  const load = useCallback((request: (signal: AbortSignal) => Promise<T>, onData?: (data: T) => void) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: 'loading' });
    request(current.signal).then(
      (data) => {
        if (current.signal.aborted) return;
        onData?.(data);
        setState({ status: 'ready', data });
      },
      () => {
        if (!current.signal.aborted) setState({ status: 'error' });
      },
    );
  }, []);

  return [state, load] as const;
}
