import { describe, expect, it } from 'vitest';

import { parseTaskInput } from './tasks';

describe('task input validation', () => {
  it('rejects a malformed task before any write is attempted', () => {
    expect(
      parseTaskInput({
        regionId: 'not-a-region',
        title: '',
        location: '',
        question: 4,
        status: 'done',
      }),
    ).toEqual({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  });

  it('accepts only an explicit workflow status and a bounded checklist', () => {
    expect(
      parseTaskInput({
        regionId: 'hahoemaeul',
        title: '하회마을 주변 음식·숙박 연결 확인',
        location: '하회마을 입구',
        question: '주말 대중교통 연결이 실제로 운영되나요?',
        status: 'in-progress',
        checklist: [{ id: 'transit-connection', label: '대중교통 연결', completed: true }],
      }),
    ).toMatchObject({
      ok: true,
      value: {
        regionId: 'hahoemaeul',
        status: 'in-progress',
        checklist: [{ id: 'transit-connection', label: '대중교통 연결', completed: true }],
      },
    });
  });

  it('rejects an impossible scheduled calendar date', () => {
    expect(
      parseTaskInput({
        regionId: 'hahoemaeul',
        title: '하회마을 주변 음식·숙박 연결 확인',
        location: '하회마을 입구',
        question: '주말 대중교통 연결이 실제로 운영되나요?',
        status: 'not-started',
        scheduledFor: '2026-02-30',
      }),
    ).toEqual({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  });
});
