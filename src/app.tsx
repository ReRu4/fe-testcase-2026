import type { ReactElement } from 'react';
import { CITIES, type NormalizedConfig } from './config';
import { useMapLibre } from './map/use-maplibre';
import type { CityConfig, Rarity } from './types';

export interface WidgetAppProps {
  readonly config: NormalizedConfig;
}

const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
  common: 'Обычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
};

function cityKey(city: CityConfig): keyof typeof CITIES | null {
  for (const [key, preset] of Object.entries(CITIES)) {
    if (
      preset.name === city.name &&
      preset.center[0] === city.center[0] &&
      preset.center[1] === city.center[1]
    ) {
      return key as keyof typeof CITIES;
    }
  }
  return null;
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
    activeCity,
    moveToCity,
    geolocationStatus,
    locatePlayer,
    heatmapVisible,
    toggleHeatmap,
  } = useMapLibre(config);
  const activeCityKey = cityKey(activeCity);

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
    <section data-pokemap-app="" aria-label={`PokeMap — ${activeCity.name}`}>
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
      {status.type === 'ready' && (
        <nav data-pokemap-controls="" aria-label="Управление картой">
          <label>
            <span>Город</span>
            <select
              aria-label="Город"
              value={activeCityKey ?? 'custom'}
              onChange={(event) => {
                const key = event.currentTarget.value as keyof typeof CITIES;
                const city = CITIES[key];
                if (city) moveToCity(city);
              }}
            >
              {!activeCityKey && <option value="custom">{activeCity.name}</option>}
              {Object.entries(CITIES).map(([key, city]) => (
                <option key={key} value={key}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={locatePlayer}
            disabled={geolocationStatus?.type === 'loading'}
          >
            {geolocationStatus?.type === 'loading' ? 'Определяем…' : 'Я здесь'}
          </button>
          <button type="button" aria-pressed={heatmapVisible} onClick={toggleHeatmap}>
            Теплокарта
          </button>
        </nav>
      )}
      {geolocationStatus?.type === 'error' && (
        <p data-pokemap-notice="" role="status">
          {geolocationStatus.message}
        </p>
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
            <small data-rarity={selectedPoi.rarity}>
              {RARITY_LABELS[selectedPoi.rarity]} · {selectedPoi.basePoints} очков
            </small>
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
