# 동행로컬 (With Local) — 안동 관광 의사결정 지원 MVP

안동시 관광·지역경제 담당자가 세 관광권역을 지도에서 탐색하고, 비교 근거·현장검증·정책 검토안을 한 흐름에서 확인하는 Next.js App Router MVP입니다.

대상 권역은 **원도심·월영교권**, **하회마을권**, **도산·예끼마을권**입니다. 관광객용 여행 추천, 예약·결제, 실시간 교통 정보, 자동 사업효과 예측은 이 MVP의 범위가 아닙니다.

## 검토와 다음 개발 순서

- [레포 검토·수정·추가 계획](docs/review/2026-09-21-review-and-roadmap.md): 발견한 문제, 이번 수정 범위, 후속 개발의 선행조건.
- [평가·근거 표시 계약](docs/evaluation-policy.md): 산출 대기, 가중치 미확정, 자료 기간, 점수와 검증 상태의 의미.
- [논문 근거와 평가모형 설계안](docs/research/scoring-literature.md): 논문 9편과 보충 문헌, 적용 방법과 해석 한계.
- [논문 기반 점수 계산 구현](docs/research/scoring-implementation.md): 정규화·AHP·결측·필수조건·민감도 코드와 원자료 추적 화면.

점수 계산 모듈을 구현했습니다. 현재 데모는 합성 관측값을 정규화·가중합하여 총점과 세부 기여분을 계산하며, 자료가 빠지면 총점을 보류합니다. `/evaluation`에서 값과 AHP 비교행렬을 바꾸고 결측·일관성·민감도를 확인할 수 있습니다. 논문은 계산 절차의 근거이며 임시 지표·가중치의 실증 검증을 의미하지 않습니다. `관광권역 여건 점수`는 미래 성장확률이 아닙니다. 라이브 자료·전문가 응답·현장 관측이 없으면 라이브 점수는 계속 산출 대기로 표시합니다.

## 데이터 해석 원칙

- 환경 변수가 없으면 앱은 여섯 화면을 열 수 있는 `demo` 모드로 동작합니다. 모든 점수와 판단은 **`예시 데이터 · 정책 판단 금지`**로 표시되며, 브라우저에서의 과제·검증 변경은 세션 시연용입니다.
- `live` 모드는 Supabase에 발행된 마지막 정상 스냅샷만 읽습니다. 수집 실패 시 데모 값으로 조용히 전환하지 않고, 마지막 라이브 결과와 오래됨 상태를 표시합니다.
- 첫 라이브 동기화가 성공하면 실제로 수집·발행한 원천 기준일(`source_date`)을 스냅샷에 기록합니다. 초기 화면의 기준일을 실행일이나 오늘 날짜로 추정해 표시하지 않습니다.
- 한국관광공사 `locgoRegnVisitrDDList`의 일별 시·군 방문자 수는 **안동시 전체 맥락**입니다. 이를 세 관광권역의 실측 방문·소비·접근성 값으로 표현하지 않습니다.
- `areaBasedList2`로 얻는 POI는 위치 기반 탐색용입니다. 권역 중심점·반경 기반 묶음은 법정 경계나 실제 방문권의 증명이 아닙니다.
- 독립적인 권역 단위 근거가 없으면 여건 점수는 `산출 대기`, 모형은 `검증 전`으로 표시합니다. 수집 완료 후의 `0`과 `정보 없음`, 미확인 건수의 `미집계`는 다른 상태입니다.

## 빠른 시작: 데모 모드

사전 계정이나 API 키 없이 시연 화면을 확인할 수 있습니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

브라우저에서 `http://localhost:3000`을 열고 다음 흐름을 확인합니다.

1. `/` — 지도 중심 관광권역 탐색
2. `/compare` — 세 권역 비교
3. `/regions/old-town-wolyeonggyo` 등 — 권역 근거 상세
4. `/actions` — 우선 실행과제
5. `/field` — 현장검증
6. `/report` — 정책 검토안 미리보기 및 인쇄
7. `/evaluation` — 논문 기반 계산방법 실험실: 지표·AHP·민감도, 실제 자료로 오인하지 않도록 합성 자료 표시

데모 모드에서는 실제 관리자 로그인·DB 저장·공공 API 수집이 수행되지 않아야 합니다. 화면의 예시 배지와 한계를 발표·검토 중에도 유지합니다.

## 로컬 검증

Node.js 24에서 검증합니다. `.github/workflows/ci.yml`은 push/PR 시 잠금 파일 설치, 테스트, 타입 검사, 린트, 빌드를 실행하도록 구성되어 있습니다. CI 설정을 추가한 것과 GitHub에서 실제 실행한 것은 구분합니다.

```powershell
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

현장검증 화면에서는 새 과제를 만들고 담당자·일정·메모를 저장할 수 있습니다. 데모 변경은 같은 탭의 세션 안에서 실행과제·현장검증·보고서에 반영되며 서버로 저장되지 않습니다. 라이브 생성·수정은 기존 관리자 인증과 DB 구성이 필요합니다. 체크리스트의 확인 완료는 조사 진행 상태이며 접근성 조건 충족이나 사업효과를 의미하지 않습니다.

## 실행 중인 프로덕션 서버 스모크 검사

스모크 검사는 서버를 시작·빌드·배포하지 않습니다. 이미 실행 중인 **로컬 production Next 서버**에만 HTTP 요청을 보냅니다. 운영 전에는 build가 끝난 뒤 한 터미널에서 `npm.cmd run start`로 서버를 준비하고, 다른 터미널에서 아래 검사를 실행합니다.

```powershell
npm.cmd run smoke
```

기본 대상은 `http://localhost:3000`입니다. 다른 로컬 포트를 사용하면 URL에 자격증명·쿼리 문자열을 넣지 않고 다음처럼 지정합니다.

```powershell
$env:BASE_URL = 'http://localhost:3100'
npm.cmd run smoke
```

검사 범위는 일곱 페이지(`/`, `/compare`, `/regions/old-town-wolyeonggyo`, `/actions`, `/field`, `/evaluation`, `/report`), 홈의 서버 렌더링된 `예시 데이터 · 정책 판단 금지` provenance 배지와 접근 가능한 지도 대체 목록, 보고서의 인쇄 CTA/`no-print` 마커, 인증되지 않은 `POST /api/tasks`의 `401`입니다. POST 요청에는 인증 정보나 유효 과제 데이터가 없으므로 저장을 수행하지 않습니다. 스크립트는 응답 본문·환경 변수·비밀 값을 출력하지 않습니다.

## 라이브 모드 준비

비밀은 절대 저장소에 넣거나 `NEXT_PUBLIC_` 접두사로 노출하지 않습니다. `.env*`는 Git에서 제외되어 있고, 이름만 포함한 [`.env.example`](.env.example)을 복사해 로컬 전용 `.env.local`을 만듭니다.

```powershell
Copy-Item .env.example .env.local
```

`.env.local`과 Vercel Project Settings → Environment Variables에 다음 값을 설정합니다.

| 변수 | 설정 위치/용도 | 공개 여부 |
| --- | --- | --- |
| `TOUR_API_SERVICE_KEY` | 제공된 한국관광공사 TourAPI 서비스 키. 서버 수집 요청에만 사용 | 비밀 |
| `TOUR_DATA_LAG_DAYS` | 선택 사항. 일별 방문자 API의 기준일을 UTC 실행일보다 앞당길 일수. `1`~`90` 정수만 허용하며, 비어 있거나 잘못된 값은 `30`일 | 서버 전용 |
| `DATABASE_URL` | **런타임용 Supabase PostgreSQL transaction pooler** 연결 문자열. SSL을 사용하며 prepared statements는 사용하지 않음 | 비밀 |
| `CRON_SECRET` | 최소 16자 이상의 임의 문자열. Vercel Cron과 보호된 동기화 호출의 Bearer 토큰 | 비밀 |
| `ADMIN_PASSWORD` | 현장검증·과제 저장을 허용할 단일 관리자 비밀번호 | 비밀 |
| `SESSION_SECRET` | 관리자 HttpOnly 세션 서명용 충분히 긴 임의 문자열 | 비밀 |
| `NEXT_PUBLIC_TILE_URL` | 공개 지도 타일 URL. 자격증명이 포함되면 안 됨 | 공개 가능 |

`DATABASE_URL`을 비워 두면 앱은 명시적인 데모 모드입니다. 반대로 `DATABASE_URL`이 설정된 라이브 구성에서 수집 또는 DB 조회가 실패하면 데모로 대신 보이지 않고 라이브 빈 상태 또는 마지막 정상 스냅샷을 표시합니다.

### 한국관광공사 API

1. 제공된 서비스 키를 로컬 `.env.local`과 Vercel의 비밀 환경 변수 `TOUR_API_SERVICE_KEY`에 설정합니다. API별 활용 승인 상태와 실제 응답은 배포 전에 확인합니다.
2. 브라우저 코드, 화면 캡처, 오류 로그, Git에 키나 전체 요청 URL을 남기지 않습니다.
3. 동기화는 `DataLabService/locgoRegnVisitrDDList`의 짧은 일자 구간과 `KorService2/areaBasedList2`의 제한된 페이지를 읽습니다. 안동의 지역 코드는 이름으로 `areaCode2` 응답에서 확인하며 상수를 추정해 고정하지 않습니다.
4. 배포 전에 실제 키로 응답 건수·결측률·할당량을 확인합니다. 이 저장소의 예시 데이터는 실 API 결과가 아닙니다.

키 값을 기록하지 않은 라이브 probe에서 `areaCode2`는 경상북도 아래 안동시의 `sigunguCode=11`을 반환했습니다. 흔히 추정되는 `7`을 상수로 쓰면 안 됩니다. 이어 `areaBasedList2`는 `resultCode=0000`, `totalCount=128`과 함께 `contentid`, `title`, `contenttypeid`, `mapx`, `mapy`, `addr1` 필드를 반환했습니다. `2026-08-20` DataLab 전체 응답에는 안동 행 3개(`touDivCd` 1/2/3)가 있고 `touNum`은 문자열로 반환됐습니다. 이는 단일·배열 응답 및 문자열 수치 정규화의 실제 응답 근거이지만, 이후 응답 수·필드 완전성·결측률을 보장하지 않습니다.

### 수집 기준일과 제공 지연

일별 방문자 API는 실행 당일 값을 즉시 제공한다는 보장이 없습니다. 키 값을 기록하지 않은 라이브 probe에서 `2026-09-19`의 총계는 `0`이었고, `2026-08-20`의 총계는 `807`이었습니다. 이 한 쌍의 관측은 최신 일자를 즉시 사용하지 않고 기준일을 기본 30일 앞당기는 이유이며, 전체 날짜의 제공 여부·결측률을 보증하는 결과는 아닙니다.

- `TOUR_DATA_LAG_DAYS`는 선택적인 서버 전용 환경 변수입니다. `1`~`90` 범위의 정수일 때만 적용하며, 누락·빈 값·잘못된 값은 모두 기본 `30`일로 처리합니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- 첫 동기화는 이 지연을 적용한 실제 요청 기준일이 유효하게 수집됐을 때만 발행합니다. 발행된 `source_date`/기준 기간은 화면과 보고서에 그대로 표시합니다.
- 아직 정상 발행본이 없으면 라이브 빈 상태를 표시합니다. 데모 값으로 대체하지 않습니다.
- 마지막 정상 발행본이 있는 상태에서 API 오류, 응답 형식 오류 또는 사용 가능한 원천 데이터 부재가 확인되면 새 값으로 덮어쓰지 않고 기존 라이브 스냅샷을 `stale`로 유지합니다.
- API가 유효한 레코드로 반환한 `0`과 수집하지 못한 날짜의 `정보 없음`은 다릅니다. `0`을 임의로 오류나 성과 부재로 해석하지 않습니다.

### Supabase/PostGIS 마이그레이션

Supabase 프로젝트와 데이터베이스는 자동 생성되지 않습니다. 별도의 Supabase 프로젝트를 만든 뒤 PostGIS를 사용할 수 있는 PostgreSQL 데이터베이스를 준비합니다.

1. Supabase Dashboard의 SQL Editor에서 [`db/migrations/001_init.sql`](db/migrations/001_init.sql)을 **한 번만** 실행합니다. 이 SQL은 `postgis` 확장, 수집/발행 스냅샷, lease, 과제·현장검증 저장 구조와 인덱스를 만듭니다.
2. 이 마이그레이션은 공개 Data API 접근을 만들지 않습니다. public 스키마 테이블에는 RLS를 적용하고 `anon`·`authenticated` 역할의 테이블 권한을 회수하므로, 브라우저·Supabase Data API에서 운영 데이터에 직접 접근할 수 없어야 합니다.
3. 마이그레이션 관리에는 Supabase가 안내하는 직접 DB 연결 방식을 사용하고, 애플리케이션의 `DATABASE_URL`에는 서버리스 런타임에 맞는 **권한 있는 서버 전용** transaction pooler URL을 설정합니다. 이 연결은 RLS 적용 테이블의 **소유자** 또는 `BYPASSRLS` 역할로 인증돼야 하며, `anon`·`authenticated` 또는 일반 저권한 역할로는 동작하지 않습니다. 이 URL과 TourAPI 서비스 키를 `NEXT_PUBLIC_` 변수, 클라이언트 코드, Data API 호출에 넣지 않습니다.
4. 배포 전 라이브 DB에서 동기화를 한 번 실행해 마지막 정상 발행 스냅샷, 중복 실행 lease, 재실행 upsert, 수집 실패 시 stale 상태를 확인합니다.
5. DB가 준비되지 않았거나 관리자 비밀이 없으면 쓰기 API는 성공처럼 처리하지 않고 읽기/시연 전용 또는 구성 오류 상태를 반환해야 합니다.

> 아직 Supabase 프로젝트·실제 연결 문자열은 이 저장소에 제공되지 않았습니다. 따라서 SQL 파일과 환경 변수 계약만 포함하며, 실제 마이그레이션 또는 라이브 동기화 성공을 주장하지 않습니다.

### 지도 타일

기본 시연은 Leaflet과 공개 타일 URL을 쓸 수 있지만, 타일 제공자의 이용약관·표시·요청 제한을 확인해야 합니다. 지도에는 출처 표시가 항상 필요하며, 대규모 공개 배포 전에는 상용 타일 공급자 또는 도메인 등록을 마친 Kakao Maps 등 적합한 공급자를 별도로 결정합니다. 타일을 대량 다운로드하거나 사전 로딩하지 않습니다. 타일이 실패할 때도 접근 가능한 권역 목록/표 대체 표현을 사용합니다.

## Vercel 배포와 Cron

[`vercel.json`](vercel.json)은 매일 **18:00 UTC**에 `/api/sync`를 호출하도록 설정합니다. 한국 표준시로는 다음 날 03:00 KST입니다. Cron 표현식은 Vercel에서 항상 UTC로 해석됩니다.

배포 순서:

1. Vercel에 이 저장소를 새 프로젝트로 연결합니다. 실제 배포는 Vercel 권한이 있는 담당자가 별도로 실행합니다.
2. 위 환경 변수를 Production에 설정합니다. Preview 환경에 실제 운영 키를 복사하지 않는 것을 기본으로 하며, 필요하다면 별도 테스트 키·DB를 사용합니다.
3. `CRON_SECRET`을 난수로 설정합니다. Vercel은 Cron 호출 시 이를 `Authorization: Bearer <CRON_SECRET>` 헤더로 전달하고, `/api/sync`는 같은 값을 검사해야 합니다.
4. 배포 후 Vercel Dashboard의 Settings → Cron Jobs에서 스케줄과 Runtime Logs를 확인합니다. 성공·실패·busy 응답을 확인하되 서비스 키를 로그에 노출하지 않습니다.
5. 첫 라이브 수집 이후 여섯 화면에서 기준일·출처·한계, 마지막 정상 스냅샷 유지, 예시/라이브 상태 표시를 검토합니다.

### Vercel 운영 한계

- Hobby 플랜도 하루 한 번 Cron은 가능하지만, 지정한 시각의 **해당 한 시간 안**에 실행될 수 있으므로 정시 실행을 전제로 하지 않습니다. 더 잦거나 분 단위 정밀한 일정은 Pro 이상이 필요합니다.
- Cron도 Vercel Function을 호출하므로 함수 실행 시간·사용량 한계를 공유합니다. 수집은 한 번에 짧은 날짜 창과 제한된 페이지 수만 처리하도록 유지합니다.
- 동기화 Route Handler의 `maxDuration: 60`초는 짧은 일일 배치의 상한입니다. Next.js App Router에서는 이 값을 `src/app/api/sync/route.ts`에서 export하며, 실제 플랜·Fluid compute 설정의 상한을 넘겨 늘리지 말고 timeout이 발생하면 호출량을 줄이거나 작업을 분할합니다.
- Cron의 지연, 중복 또는 겹침 가능성에 대비해 DB lease와 날짜별 upsert가 필요합니다. Cron은 재시도·정확한 한 번 실행을 보장하는 큐가 아닙니다.

공식 최신 정책은 [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [Cron 사용량 및 플랜별 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Functions 제한](https://vercel.com/docs/functions/limitations)에서 배포 직전에 다시 확인합니다.

## 보안과 운영 경계

- 공개 조회와 실제 쓰기를 분리합니다. 과제·현장검증 변경은 인증된 관리자 세션과 구성된 PostgreSQL이 모두 있어야만 영구 저장합니다.
- 관리자 세션 쿠키는 HttpOnly/SameSite이며, 비밀이나 세션 토큰을 localStorage에 저장하지 않습니다.
- Supabase public Data API는 앱 데이터 접근 경로가 아닙니다. 권한 있는 `DATABASE_URL`과 TourAPI 서비스 키는 Next.js 서버 코드에서만 사용하며, 브라우저 번들·`NEXT_PUBLIC_` 변수·클라이언트 요청에 노출하지 않습니다.
- 수집 실패 시 마지막 정상 라이브 스냅샷을 보존합니다. 오류를 데모 데이터로 숨기지 않습니다.
- 사진 업로드, 다기관 권한관리, 예약·결제, 외부 계정 생성, 공개 배포는 이 MVP 구현에 포함되지 않습니다.

## 아직 외부에서 해야 하는 일

- 제공된 한국관광공사 API 키의 활용 승인 상태 및 실제 응답 검증
- Supabase 프로젝트 생성, 마이그레이션 실행, runtime pooler URL 설정
- Vercel 프로젝트 연결, 환경 변수 입력, Cron 로그 점검
- 지도 타일 공급자/도메인/이용약관 결정
- 실제 관리자 비밀의 안전한 발급·보관

이 저장소는 위 외부 계정·비밀·배포 권한을 포함하지 않으며, 해당 작업이 완료되었다고 주장하지 않습니다.
