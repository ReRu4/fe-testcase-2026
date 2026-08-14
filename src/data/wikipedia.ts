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

export function getRarity(wikiType: string | undefined, hasThumbnail: boolean): Rarity {
  if (wikiType === 'landmark' && hasThumbnail) return 'legendary';
  if (wikiType && EPIC_TYPES.has(wikiType)) return 'epic';
  if (hasThumbnail) return 'rare';
  return 'common';
}

function getArticleUrl(apiBaseUrl: string, pageId: number): string {
  try {
    const url = new URL(apiBaseUrl);
    url.pathname = '/';
    url.search = `?curid=${pageId}`;
    return url.href;
  } catch {
    return `https://ru.wikipedia.org/?curid=${pageId}`;
  }
}

function parsePage(value: unknown, apiBaseUrl: string): Poi | null {
  if (!isRecord(value) || !isFiniteNumber(value.pageid)) return null;

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
    id: String(pageId),
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
  if (!isRecord(value) || !isRecord(value.query)) return [];

  const pages = value.query.pages;
  const rawPages = Array.isArray(pages)
    ? pages
    : isRecord(pages)
      ? Object.values(pages)
      : [];
  const unique = new Map<string, Poi>();

  for (const rawPage of rawPages) {
    const poi = parsePage(rawPage, apiBaseUrl);
    if (poi) unique.set(poi.id, poi);
  }

  return [...unique.values()];
}

export function buildWikipediaUrl(apiBaseUrl: string, center: Coordinates): string {
  const [longitude, latitude] = center;
  const url = new URL(apiBaseUrl, window.location.href);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${latitude}|${longitude}`,
    ggsradius: '10000',
    ggslimit: '500',
    prop: 'coordinates|pageimages|description',
    coprop: 'type|dim',
    piprop: 'thumbnail',
    pithumbsize: '160',
  }).toString();
  return url.href;
}

