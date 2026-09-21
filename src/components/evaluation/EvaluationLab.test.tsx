import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { EvaluationLab } from './EvaluationLab';

afterEach(cleanup);

describe('evaluation laboratory', () => {
  test('exposes five independent observations and ten reciprocal AHP comparisons', () => {
    render(<EvaluationLab />);

    expect(screen.getAllByRole('spinbutton')).toHaveLength(5);
    expect(within(screen.getByRole('group', { name: '영역 간 쌍대비교' })).getAllByRole('combobox')).toHaveLength(10);
    expect(screen.getByText('시연용 비교행렬 · 전문가 조사 전')).not.toBeNull();
    expect(screen.getByRole('table', { name: '지표별 계산 추적표' })).not.toBeNull();
  });

  test('recalculates immediately and withholds a total when an observation is blank', () => {
    render(<EvaluationLab />);
    const summary = screen.getByRole('region', { name: '평가 계산 결과' });
    expect(within(summary).queryByText('산출 보류')).toBeNull();

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } });

    expect(within(summary).getByText('산출 보류')).not.toBeNull();
    expect(within(summary).getByText('80.0%')).not.toBeNull();
    expect(screen.getAllByText(/결측.*0점/).length).toBeGreaterThan(0);
  });

  test('uses edited independent observations in both the total and the calculation trace', () => {
    render(<EvaluationLab />);
    fireEvent.change(screen.getAllByRole('spinbutton')[4], { target: { value: '0' } });

    expect(within(screen.getByRole('region', { name: '평가 계산 결과' })).getByText('52.0점')).not.toBeNull();
    const lastIndicator = within(screen.getByRole('table', { name: '지표별 계산 추적표' })).getAllByRole('row')[5];
    expect(within(lastIndicator).getByText('0 %')).not.toBeNull();
    expect(within(lastIndicator).getAllByText('0.0점')).toHaveLength(2);
  });

  test('withholds the current total for an inconsistent AHP matrix instead of showing a stale score', () => {
    render(<EvaluationLab />);
    const comparisons = within(screen.getByRole('group', { name: '영역 간 쌍대비교' })).getAllByRole('combobox');
    fireEvent.change(comparisons[0], { target: { value: '9' } });
    fireEvent.change(comparisons[1], { target: { value: String(1 / 9) } });

    expect(screen.getByRole('alert').textContent).toContain('일관성');
    expect(within(screen.getByRole('region', { name: '평가 계산 결과' })).getByText('산출 보류')).not.toBeNull();
    expect(screen.queryByRole('table', { name: '지표별 계산 추적표' })).toBeNull();
    expect(screen.queryByText('결측에 따른 계산상 범위')).toBeNull();
    expect(screen.queryByRole('region', { name: '가중치 민감도' })).toBeNull();
  });

  test('switching regions resets editable values and the comparison matrix', () => {
    render(<EvaluationLab />);
    const firstInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '' } });
    fireEvent.change(within(screen.getByRole('group', { name: '영역 간 쌍대비교' })).getAllByRole('combobox')[0], { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('시연 권역'), { target: { value: 'dosan-yekki' } });

    expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).not.toBe('');
    expect(within(screen.getByRole('region', { name: '평가 계산 결과' })).queryByText('산출 보류')).toBeNull();
    expect(screen.getByText('필수조건 미충족 · 사업검토 제한')).not.toBeNull();
    for (const comparison of within(screen.getByRole('group', { name: '영역 간 쌍대비교' })).getAllByRole('combobox')) {
      expect((comparison as HTMLSelectElement).value).toBe('1');
    }
  });
});
