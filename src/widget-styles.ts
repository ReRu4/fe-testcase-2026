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

  [data-pokemap-player] {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    display: grid;
    width: 34px;
    height: 34px;
    transform: translate(-50%, -50%);
    border: 3px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgb(15 23 42 / 45%);
    background: rgb(37 99 235 / 24%);
    pointer-events: none;
    place-items: center;
  }

  [data-pokemap-player] span {
    width: 10px;
    height: 10px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    background: #dc2626;
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

  [data-pokemap-game] {
    position: absolute;
    top: 12px;
    right: 56px;
    z-index: 3;
    display: flex;
    min-height: 46px;
    overflow: hidden;
    border: 1px solid rgb(15 23 42 / 10%);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgb(15 23 42 / 14%);
    background: rgb(255 255 255 / 94%);
  }

  [data-pokemap-game] > span {
    display: flex;
    min-width: 62px;
    padding: 6px 10px;
    flex-direction: column;
    justify-content: center;
  }

  [data-pokemap-game] small {
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  [data-pokemap-game] strong {
    color: #0f172a;
    font-size: 14px;
    line-height: 1.25;
  }

  [data-pokemap-game] button {
    padding: 0 11px;
    border: 0;
    border-left: 1px solid rgb(15 23 42 / 10%);
    background: #f8fafc;
    color: #475569;
    font: 700 11px/1 sans-serif;
    cursor: pointer;
  }

  [data-pokemap-game] button:disabled {
    color: #94a3b8;
    cursor: default;
  }

  [data-pokemap-controls] {
    position: absolute;
    top: 56px;
    left: 12px;
    z-index: 3;
    display: flex;
    max-width: calc(100% - 24px);
    padding: 5px;
    gap: 5px;
    border: 1px solid rgb(15 23 42 / 10%);
    border-radius: 9px;
    box-shadow: 0 4px 16px rgb(15 23 42 / 14%);
    background: rgb(255 255 255 / 94%);
  }

  [data-pokemap-controls] label {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  [data-pokemap-controls] label > span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    clip-path: inset(50%);
  }

  [data-pokemap-controls] select,
  [data-pokemap-controls] button {
    min-height: 30px;
    border: 0;
    border-radius: 6px;
    background: #f1f5f9;
    color: #334155;
    font: 700 11px/1 sans-serif;
  }

  [data-pokemap-controls] select {
    max-width: 150px;
    padding: 0 28px 0 9px;
    cursor: pointer;
  }

  [data-pokemap-controls] button {
    padding: 0 10px;
    cursor: pointer;
  }

  [data-pokemap-controls] button[aria-pressed="true"] {
    background: #7c3aed;
    color: #ffffff;
  }

  [data-pokemap-controls] button:disabled {
    color: #94a3b8;
    cursor: wait;
  }

  [data-pokemap-controls] select:focus-visible,
  [data-pokemap-controls] button:focus-visible,
  [data-pokemap-game] button:focus-visible {
    outline: 3px solid rgb(37 99 235 / 40%);
    outline-offset: 1px;
  }

  [data-pokemap-notice] {
    position: absolute;
    top: 104px;
    left: 12px;
    z-index: 3;
    max-width: min(320px, calc(100% - 24px));
    margin: 0;
    padding: 8px 10px;
    border-radius: 7px;
    box-shadow: 0 4px 16px rgb(15 23 42 / 14%);
    background: rgb(254 242 242 / 96%);
    color: #991b1b;
    font-size: 12px;
    font-weight: 700;
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

  [data-pokemap-card-content] small {
    width: fit-content;
    padding: 2px 6px;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 10px;
    font-weight: 800;
  }

  [data-pokemap-card-content] small[data-rarity="rare"] {
    background: #dbeafe;
    color: #1d4ed8;
  }

  [data-pokemap-card-content] small[data-rarity="epic"] {
    background: #ede9fe;
    color: #6d28d9;
  }

  [data-pokemap-card-content] small[data-rarity="legendary"] {
    background: #fef3c7;
    color: #92400e;
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
