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
`;
