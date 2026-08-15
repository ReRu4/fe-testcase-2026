import type { Coordinates } from '../types';

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

function errorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Доступ к геопозиции запрещён';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Не удалось определить местоположение';
  if (error.code === error.TIMEOUT) return 'Превышено время ожидания геопозиции';
  return 'Не удалось получить геопозицию';
}

export function requestGeolocation(environment: Navigator | undefined): Promise<Coordinates> {
  if (!environment?.geolocation) {
    return Promise.reject(new Error('Геолокация не поддерживается браузером'));
  }

  return new Promise((resolve, reject) => {
    environment.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        if (
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude) ||
          longitude < -180 ||
          longitude > 180 ||
          latitude < -90 ||
          latitude > 90
        ) {
          reject(new Error('Браузер вернул некорректную геопозицию'));
          return;
        }
        resolve([longitude, latitude]);
      },
      (error) => reject(new Error(errorMessage(error))),
      GEOLOCATION_OPTIONS,
    );
  });
}
