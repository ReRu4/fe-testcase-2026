import { describe, expect, it } from 'vitest';
import {
  buildWikipediaUrl,
  getRarity,
  parseWikipediaResponse,
  WikipediaResponseError,
} from '../src/data/wikipedia';

const API_URL = 'https://ru.wikipedia.org/w/api.php';

function page(
  pageid: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    pageid,
    title: `Точка ${pageid}`,
    coordinates: [{ lat: 55.75, lon: 37.62, type: 'landmark' }],
    ...overrides,
  };
}

describe('Wikipedia response', () => {
  it('применяет правила редкости в нужном порядке', () => {
    expect(getRarity('landmark', true)).toBe('legendary');
    expect(getRarity('landmark', false)).toBe('epic');
    expect(getRarity('edu', true)).toBe('epic');
    expect(getRarity(undefined, true)).toBe('rare');
    expect(getRarity(undefined, false)).toBe('common');
  });

  it('проверяет поля, нормализует данные и создаёт стабильный ID источника', () => {
    const [point] = parseWikipediaResponse(
      {
        query: {
          pages: [
            page(42, {
              title: '  Кремль  ',
              description: '  исторический комплекс  ',
              thumbnail: { source: 'https://upload.wikimedia.org/image.jpg' },
            }),
          ],
        },
      },
      `${API_URL}?uselang=ru`,
    );

    expect(point).toEqual({
      id: 'https://ru.wikipedia.org/w/api.php#42',
      title: 'Кремль',
      coordinates: [37.62, 55.75],
      description: 'исторический комплекс',
      thumbnailUrl: 'https://upload.wikimedia.org/image.jpg',
      articleUrl: 'https://ru.wikipedia.org/?curid=42',
      wikiType: 'landmark',
      rarity: 'legendary',
      basePoints: 150,
    });
  });

  it('отбрасывает запрещённые и повреждённые страницы и дедуплицирует остальные', () => {
    const points = parseWikipediaResponse(
      {
        query: {
          pages: {
            valid: page(1, {
              coordinates: [{ lat: 55.75, lon: 37.62, type: 'EDU' }],
              thumbnail: { source: 'javascript:alert(1)' },
            }),
            duplicate: page(1),
            city: page(2, {
              coordinates: [{ lat: 55.75, lon: 37.62, type: 'city' }],
            }),
            invalidId: page(0),
            invalidCoordinates: page(3, {
              coordinates: [{ lat: 100, lon: 37.62 }],
            }),
            noTitle: page(4, { title: ' ' }),
          },
        },
      },
      API_URL,
    );

    expect(points).toHaveLength(1);
    expect(points[0]?.id).toBe('https://ru.wikipedia.org/w/api.php#1');
  });

  it('не маскирует ошибку, которую вернул API', () => {
    expect(() =>
      parseWikipediaResponse({ error: { code: 'badrequest', info: 'Неверный запрос' } }, API_URL),
    ).toThrow(new WikipediaResponseError('Wikipedia API: Неверный запрос'));
  });

  it('собирает GeoSearch URL без зависимости от window', () => {
    const url = new URL(buildWikipediaUrl(`${API_URL}?uselang=ru`, [37.62, 55.75]));

    expect(url.searchParams.get('uselang')).toBe('ru');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('generator')).toBe('geosearch');
    expect(url.searchParams.get('ggscoord')).toBe('55.75|37.62');
    expect(url.searchParams.get('ggsradius')).toBe('10000');
    expect(url.searchParams.get('ggslimit')).toBe('500');
  });
});
