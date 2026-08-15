import { DEFAULT_API_BASE_URL } from '../config';
import type { Coordinates, Poi, Rarity } from '../types';

export const BASE_POINTS: Readonly<Record<Rarity, number>> = {
  common: 10,
  rare: 25,
  epic: 60,
  legendary: 150,
};

const EXCLUDED_TYPES = new Set([
  'country',
  'adm1st',
  'adm2nd',
  'adm3rd',
  'city',
  'waterbody',
  'river',
  'event',
]);

const EPIC_TYPES = new Set(['landmark', 'edu', 'railwaystation']);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function resolveApiUrl(apiBaseUrl: string): URL {
  return new URL(apiBaseUrl, DEFAULT_API_BASE_URL);
}

function getSourceKey(apiBaseUrl: string): string {
  const url = resolveApiUrl(apiBaseUrl);
  return `${url.origin}${url.pathname}`;
}

export class WikipediaResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WikipediaResponseError';
  }
}

export function getRarity(wikiType: string | undefined, hasThumbnail: boolean): Rarity {
  if (wikiType === 'landmark' && hasThumbnail) return 'legendary';
  if (wikiType && EPIC_TYPES.has(wikiType)) return 'epic';
  if (hasThumbnail) return 'rare';
  return 'common';
}

function getArticleUrl(apiBaseUrl: string, pageId: number): string {
  const url = resolveApiUrl(apiBaseUrl);
  url.pathname = '/';
  url.search = '';
  url.searchParams.set('curid', String(pageId));
  url.hash = '';
  return url.href;
}

function parsePage(value: unknown, apiBaseUrl: string, sourceKey: string): Poi | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.pageid) ||
    !Number.isInteger(value.pageid) ||
    value.pageid <= 0
  ) {
    return null;
  }

  const title = optionalText(value.title);
  const coordinates = Array.isArray(value.coordinates) ? value.coordinates[0] : undefined;
  if (!title || !isRecord(coordinates)) return null;

  const latitude = coordinates.lat;
  const longitude = coordinates.lon;
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const wikiType = optionalText(coordinates.type)?.toLowerCase();
  if (wikiType && EXCLUDED_TYPES.has(wikiType)) return null;

  const thumbnail = isRecord(value.thumbnail) ? safeHttpUrl(value.thumbnail.source) : undefined;
  const rarity = getRarity(wikiType, Boolean(thumbnail));
  const pageId = value.pageid;

  return {
    id: `${sourceKey}#${pageId}`,
    title,
    coordinates: [longitude, latitude],
    description: optionalText(value.description),
    thumbnailUrl: thumbnail,
    articleUrl: getArticleUrl(apiBaseUrl, pageId),
    wikiType,
    rarity,
    basePoints: BASE_POINTS[rarity],
  };
}

export function parseWikipediaResponse(value: unknown, apiBaseUrl: string): Poi[] {
  if (!isRecord(value)) return [];

  if ('error' in value) {
    const error = isRecord(value.error) ? value.error : undefined;
    const details = optionalText(error?.info) ?? optionalText(error?.code);
    throw new WikipediaResponseError(
      details ? `Wikipedia API: ${details}` : 'Wikipedia API вернул ошибку',
    );
  }

  if (!isRecord(value.query)) return [];

  const pages = value.query.pages;
  const rawPages = Array.isArray(pages)
    ? pages
    : isRecord(pages)
      ? Object.values(pages)
      : [];
  const unique = new Map<string, Poi>();
  const sourceKey = getSourceKey(apiBaseUrl);

  for (const rawPage of rawPages) {
    const poi = parsePage(rawPage, apiBaseUrl, sourceKey);
    if (poi) unique.set(poi.id, poi);
  }

  return [...unique.values()];
}

export function buildWikipediaUrl(apiBaseUrl: string, center: Coordinates): string {
  const [longitude, latitude] = center;
  const url = resolveApiUrl(apiBaseUrl);
  const parameters = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${latitude}|${longitude}`,
    ggsradius: '10000',
    ggslimit: '500',
    prop: 'coordinates|pageimages|description',
    coprop: 'type|dim',
    piprop: 'thumbnail',
    pithumbsize: '160',
  };

  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }

  return url.href;
}
