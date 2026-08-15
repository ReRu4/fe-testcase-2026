import mapLibreStyles from 'maplibre-gl/dist/maplibre-gl.css?inline';

export const WIDGET_STYLES = `${mapLibreStyles}
  :host {
    display: block;
    min-width: 0;
    color: #1d2433;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.4;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  [data-pokemap-app] {
    position: relative;
    display: block;
    min-width: 0;
    height: 420px;
    min-height: 420px;
    overflow: hidden;
    border-radius: 4px;
    background: #f1f4f9;
    isolation: isolate;
  }

  [data-pokemap-map] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  [data-pokemap-status] {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    margin: 0;
    padding: 8px 12px;
    transform: translate(-50%, -50%);
    border-radius: 6px;
    background: rgb(255 255 255 / 90%);
    color: #4b5568;
    font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    pointer-events: none;
  }

  [data-pokemap-status][data-tone="error"] {
    max-width: min(360px, calc(100% - 32px));
    color: #9f1d1d;
    text-align: center;
  }

  [data-pokemap-data-status] {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    max-width: min(320px, calc(100% - 96px));
    margin: 0;
    padding: 7px 10px;
    border: 1px solid rgb(15 23 42 / 10%);
    border-radius: 999px;
    box-shadow: 0 4px 16px rgb(15 23 42 / 12%);
    background: rgb(255 255 255 / 92%);
    color: #334155;
    font-size: 12px;
    font-weight: 700;
    pointer-events: none;
  }

  [data-pokemap-data-status][data-tone="error"] {
    color: #9f1d1d;
  }

  [data-pokemap-data-status][data-tone="zoom"] {
    border-radius: 8px;
    color: #7c4a03;
  }

  [data-pokemap-card] {
    position: absolute;
    right: 12px;
    bottom: 12px;
    left: 12px;
    z-index: 3;
    display: flex;
    min-height: 88px;
    max-width: 420px;
    overflow: hidden;
    border: 1px solid rgb(15 23 42 / 12%);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgb(15 23 42 / 24%);
    background: rgb(255 255 255 / 96%);
  }

  [data-pokemap-card-image] {
    width: 112px;
    min-width: 112px;
    object-fit: cover;
  }

  [data-pokemap-card-content] {
    display: flex;
    min-width: 0;
    padding: 14px 42px 14px 14px;
    flex-direction: column;
    gap: 4px;
  }

  [data-pokemap-card-content] strong,
  [data-pokemap-card-content] span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  [data-pokemap-card-content] strong {
    color: #111827;
    white-space: nowrap;
  }

  [data-pokemap-card-content] span {
    display: -webkit-box;
    color: #526071;
    font-size: 13px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  [data-pokemap-card-content] a {
    width: fit-content;
    margin-top: auto;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
  }

  [data-pokemap-card-close] {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgb(226 232 240 / 92%);
    color: #334155;
    font: 700 20px/1 sans-serif;
    cursor: pointer;
    place-items: center;
  }

  [data-pokemap-card-close]:focus-visible,
  [data-pokemap-card-content] a:focus-visible {
    outline: 3px solid rgb(37 99 235 / 40%);
    outline-offset: 2px;
  }
`;
