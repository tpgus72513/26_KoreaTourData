import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { createDemoEvaluation } from '../../lib/evaluation/catalog';

import { SensitivityPanel } from './SensitivityPanel';

afterEach(cleanup);

describe('weight sensitivity panel', () => {
  test('shows all regions while withholding cohort ranks and the missing-data score', () => {
    render(<SensitivityPanel bundle={createDemoEvaluation('old-town-wolyeonggyo')} />);
    const table = screen.getByRole('table', { name: '권역별 가중치 시나리오 범위' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const missingRegion = within(table).getByRole('row', { name: /하회마을권/ });
    expect(within(missingRegion).getAllByText('산출 보류')).toHaveLength(2);
    expect(within(table).getAllByText('산출 보류')).toHaveLength(4);
    expect(screen.getByText(/신뢰구간이나 성공확률이 아닙니다/)).not.toBeNull();
  });

  test('evaluates twelve scenarios from the current edited observations instead of a cached result', () => {
    const bundle = createDemoEvaluation('old-town-wolyeonggyo');
    bundle.input.observations[4].value = 0;
    render(<SensitivityPanel bundle={bundle} />);
    fireEvent.click(screen.getByText('시나리오별 가중치와 현재 권역 점수'));
    const table = screen.getByRole('table', { name: '현재 권역의 12개 가중치 시나리오' });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(within(within(table).getByRole('row', { name: /현재 가중치/ })).getByText('52.0점')).not.toBeNull();
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
  });
});
