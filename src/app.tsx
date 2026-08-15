import type { ReactElement } from 'react';
import type { NormalizedConfig } from './config';
import { useMapLibre } from './map/use-maplibre';

export interface WidgetAppProps {
  readonly config: NormalizedConfig;
}

export function WidgetApp({ config }: WidgetAppProps): ReactElement {
  const { containerRef, status } = useMapLibre(config);

  return (
    <section data-pokemap-app="" aria-label={`PokeMap — ${config.city.name}`}>
      <div ref={containerRef} data-pokemap-map="" />
      {status.type !== 'ready' && (
        <p data-pokemap-status="" data-tone={status.type === 'error' ? 'error' : 'loading'}>
          {status.type === 'error' ? status.message : 'Подготовка карты…'}
        </p>
      )}
    </section>
  );
}
