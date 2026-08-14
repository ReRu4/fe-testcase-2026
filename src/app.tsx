import type { ReactElement } from 'react';

/**
 * Минимальный React-корень. Содержимое появится на следующих этапах, когда
 * будет реализован управляемый lifecycle экземпляра виджета.
 */
export function WidgetApp(): ReactElement {
  return <div data-pokemap-app="" />;
}
