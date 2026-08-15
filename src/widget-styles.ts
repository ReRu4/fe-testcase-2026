export const WIDGET_STYLES = `
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
    display: grid;
    min-width: 0;
    min-height: 420px;
    place-items: center;
    overflow: hidden;
    border-radius: 4px;
    background: #f1f4f9;
    isolation: isolate;
  }

  [data-pokemap-status] {
    margin: 0;
    color: #4b5568;
    font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
`;
