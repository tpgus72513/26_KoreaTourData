import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/discovery.css'), 'utf8');

describe('discovery narrow layouts', () => {
  test('keeps the home grid and horizontal navigation within the viewport', () => {
    expect(stylesheet).toContain('.discovery-app { grid-template-columns: minmax(0, 1fr); }');
    expect(stylesheet).toContain('.discovery-main { grid-template-columns: minmax(0, 1fr); }');
    expect(stylesheet).toContain('.side-navigation nav { display: flex; min-width: 0; max-width: 100%; overflow-x: auto; }');
    expect(stylesheet).toContain('.map-workspace, .map-frame, .map-canvas { max-width: 100%; min-width: 0; }');
  });
});
