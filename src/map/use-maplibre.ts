import { useEffect, useRef, useState, type RefObject } from 'react';
import type { NormalizedConfig } from '../config';
import type { PokeMapEvent } from '../types';
import { createMapAdapter } from './map-adapter';

export type MapStatus =
  | { readonly type: 'loading' }
  | { readonly type: 'ready' }
  | { readonly type: 'error'; readonly message: string };

interface UseMapLibreResult {
  readonly containerRef: RefObject<HTMLDivElement>;
  readonly status: MapStatus;
}

function emitSafely(config: NormalizedConfig, event: PokeMapEvent): void {
  try {
    config.onEvent?.(event);
  } catch {
    // Ошибка callback принадлежит host-странице и не должна ломать карту.
  }
}

export function useMapLibre(config: NormalizedConfig): UseMapLibreResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>({ type: 'loading' });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    setStatus({ type: 'loading' });
    const adapter = createMapAdapter(container, {
      center: config.city.center,
      onReady: () => {
        setStatus({ type: 'ready' });
        emitSafely(config, { type: 'ready', city: config.city });
      },
      onError: (message) => {
        setStatus({ type: 'error', message });
        emitSafely(config, { type: 'error', source: 'map', message });
      },
    });

    return () => adapter.destroy();
  }, [config]);

  return { containerRef, status };
}
