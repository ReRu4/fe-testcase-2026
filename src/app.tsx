import type { ReactElement } from 'react';
import type { NormalizedConfig } from './config';

export interface WidgetAppProps {
  readonly config: NormalizedConfig;
}

export function WidgetApp({ config }: WidgetAppProps): ReactElement {
  return (
    <section data-pokemap-app="" aria-label={`PokeMap — ${config.city.name}`}>
      <p data-pokemap-status="">Подготовка карты…</p>
    </section>
  );
}
