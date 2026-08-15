import type { ReactElement } from 'react';
import type { NormalizedConfig } from './config';
import { useMapLibre } from './map/use-maplibre';

export interface WidgetAppProps {
  readonly config: NormalizedConfig;
}

export function WidgetApp({ config }: WidgetAppProps): ReactElement {
  const {
    containerRef,
    status,
    dataStatus,
    selectedPoi,
    clearSelectedPoi,
    game,
    resetProgress,
  } = useMapLibre(config);

  const dataMessage =
    dataStatus?.type === 'zoom'
      ? 'Приблизьте карту для загрузки точек'
      : dataStatus?.type === 'error'
        ? `Не удалось обновить точки: ${dataStatus.message}`
        : dataStatus?.type === 'loading'
          ? dataStatus.count > 0
            ? `Обновление · ${dataStatus.count} точек`
            : 'Загрузка точек…'
          : dataStatus?.type === 'ready'
            ? `${dataStatus.count} точек`
            : null;

  return (
    <section data-pokemap-app="" aria-label={`PokeMap — ${config.city.name}`}>
      <div ref={containerRef} data-pokemap-map="" />
      <div data-pokemap-player="" aria-hidden="true">
        <span />
      </div>
      {status.type !== 'ready' && (
        <p data-pokemap-status="" data-tone={status.type === 'error' ? 'error' : 'loading'}>
          {status.type === 'error' ? status.message : 'Подготовка карты…'}
        </p>
      )}
      {status.type === 'ready' && dataMessage && (
        <p
          data-pokemap-data-status=""
          data-tone={dataStatus?.type === 'error' ? 'error' : dataStatus?.type}
          aria-live="polite"
        >
          {dataMessage}
        </p>
      )}
      {status.type === 'ready' && (
        <section data-pokemap-game="" aria-label="Игровой прогресс">
          <span>
            <small>Очки</small>
            <strong>{game.state.score}</strong>
          </span>
          <span>
            <small>Комбо</small>
            <strong>x{game.combo.toFixed(1)}</strong>
          </span>
          <span>
            <small>{game.frozen ? 'Заморозка' : 'Собрано'}</small>
            <strong>{game.frozen ? '❄' : game.state.collectedIds.size}</strong>
          </span>
          <button type="button" onClick={resetProgress} disabled={game.state.collectedIds.size === 0}>
            Сбросить
          </button>
        </section>
      )}
      {selectedPoi && (
        <article data-pokemap-card="" aria-label={`Точка: ${selectedPoi.title}`}>
          <button
            type="button"
            data-pokemap-card-close=""
            aria-label="Закрыть карточку"
            onClick={clearSelectedPoi}
          >
            ×
          </button>
          {selectedPoi.thumbnailUrl && (
            <img
              data-pokemap-card-image=""
              src={selectedPoi.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <div data-pokemap-card-content="">
            <strong>{selectedPoi.title}</strong>
            {selectedPoi.description && <span>{selectedPoi.description}</span>}
            <a href={selectedPoi.articleUrl} target="_blank" rel="noreferrer">
              Открыть в Wikipedia
            </a>
          </div>
        </article>
      )}
    </section>
  );
}
