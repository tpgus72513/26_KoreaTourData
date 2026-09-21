/* global URL, console, fetch, process */

const rawBaseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

const pageContracts = [
  { path: '/', text: '예시 데이터 · 정책 판단 금지' },
  { path: '/compare', text: '후보 권역 비교' },
  { path: '/regions/old-town-wolyeonggyo', text: '원도심·월영교권' },
  { path: '/actions', text: '우선 실행과제' },
  { path: '/field', text: '현장검증' },
  { path: '/data', text: '한국관광공사 OpenAPI 실제 응답' },
  { path: '/evaluation', text: '평가방법 실험실' },
  { path: '/report', text: '정책 검토안' },
];

function baseUrl() {
  let url;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error('BASE_URL must be a valid http(s) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('BASE_URL must be an http(s) origin without credentials, query, or fragment.');
  }

  return url;
}

function endpoint(path) {
  return new URL(path, baseUrl());
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(endpoint(path), { redirect: 'manual', ...options });
  } catch {
    throw new Error(`${path}: request failed.`);
  }
  return response;
}

async function expectPage({ path, text }) {
  const response = await request(path);
  expect(response.status === 200, `${path}: expected HTTP 200, received ${response.status}.`);
  const html = await response.text();
  expect(html.includes(text), `${path}: expected page content was not rendered.`);
  console.log(`PASS ${path}`);
  return html;
}

async function expectUnauthorizedMutation() {
  const response = await request('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  expect(response.status === 401, `/api/tasks: expected unauthenticated POST to return 401, received ${response.status}.`);
  console.log('PASS /api/tasks unauthenticated POST denied');
}

async function main() {
  const renderedPages = [];
  for (const contract of pageContracts) {
    renderedPages.push(await expectPage(contract));
  }

  const home = renderedPages[0];
  expect(home.includes('예시 데이터 · 정책 판단 금지'), '/: expected demo provenance label.');
  console.log('PASS / demo provenance');
  expect(home.includes('지도 대체 목록'), '/: expected accessible map fallback content.');
  console.log('PASS / map fallback');

  const report = renderedPages.at(-1);
  expect(report.includes('PDF 미리보기'), '/report: expected print action.');
  expect(report.includes('no-print'), '/report: expected print-layout control marker.');
  console.log('PASS /report print layout');
  expect(report.includes('권역별 계산 결과와 근거 버전'), '/report: expected shared evaluation evidence.');
  console.log('PASS /report calculation evidence');

  await expectUnauthorizedMutation();
  console.log('Smoke checks passed.');
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error instanceof Error ? error.message : 'unexpected error.'}`);
  process.exitCode = 1;
});
