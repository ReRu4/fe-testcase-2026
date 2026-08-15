import { describe, expect, it, vi } from 'vitest';
import { requestGeolocation } from '../src/map/geolocation';

type GetCurrentPosition = (
  success: PositionCallback,
  error?: PositionErrorCallback | null,
  options?: PositionOptions,
) => void;

function navigatorWith(implementation: Geolocation['getCurrentPosition']): Navigator {
  return {
    geolocation: { getCurrentPosition: implementation } as Geolocation,
  } as Navigator;
}

describe('геолокация', () => {
  it('возвращает координаты в порядке longitude, latitude', async () => {
    const getCurrentPosition = vi.fn<GetCurrentPosition>((success) => {
      success({ coords: { longitude: 37.62, latitude: 55.75 } } as GeolocationPosition);
    });

    await expect(
      requestGeolocation(navigatorWith(getCurrentPosition as Geolocation['getCurrentPosition'])),
    ).resolves.toEqual([37.62, 55.75]);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });

  it('объясняет отсутствие API и отказ пользователя', async () => {
    await expect(requestGeolocation({} as Navigator)).rejects.toThrow(
      'Геолокация не поддерживается',
    );

    const denied = {
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;
    const getCurrentPosition = vi.fn<GetCurrentPosition>((_success, error) => error?.(denied));

    await expect(
      requestGeolocation(navigatorWith(getCurrentPosition as Geolocation['getCurrentPosition'])),
    ).rejects.toThrow('Доступ к геопозиции запрещён');
  });

  it('отбрасывает некорректные координаты браузера', async () => {
    const getCurrentPosition = vi.fn<GetCurrentPosition>((success) => {
      success({ coords: { longitude: Number.NaN, latitude: 55.75 } } as GeolocationPosition);
    });

    await expect(
      requestGeolocation(navigatorWith(getCurrentPosition as Geolocation['getCurrentPosition'])),
    ).rejects.toThrow('некорректную геопозицию');
  });
});
