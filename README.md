# 이번주 데이트

커플이 함께 쓰는 데이트 코스 추천 + 데이트 다이어리 PWA. 전체 명세는 [date-course-app-spec.md](date-course-app-spec.md) 참고.

## 폴더 구조

```
/web                 프런트엔드 (Vite + React + PWA)
/scripts             Node.js 파이프라인 (TourAPI 수집, 코스 생성, 업로드) — 3단계
/data/trends         C 파이프라인 결과 JSON (주차별) — 8단계
/data/templates      계절·테마 코스 템플릿 — 3단계
/.claude/commands    Claude Code 사용자 명령 (weekly-trends.md) — 8단계
/.github/workflows   weekly.yml, trends-upload.yml — 4·8단계
/tests              Firestore 보안 규칙 테스트 (에뮬레이터)
firestore.rules      Firestore 보안 규칙
firebase.json        Firebase CLI 설정 (규칙 배포·에뮬레이터)
netlify.toml         Netlify 빌드 설정 (base = web), 로그인 핸들러 프록시
```

## 로컬 실행

```bash
cd web
npm install
npm run dev       # 개발 서버
npm run build     # 배포용 빌드 (web/dist)
npm run preview   # 빌드 결과 미리보기 (서비스 워커 동작 확인용)
npm run icons     # public/icon.svg 로 PWA 아이콘 재생성
```

## Firebase

- 웹 설정값: `web/src/firebase.js` (공개돼도 되는 값, 데이터 보호는 보안 규칙이 담당)
- 보안 규칙 배포: `npx firebase-tools deploy --only firestore:rules` (최초 1회 `npx firebase-tools login`)
- 보안 규칙 테스트: `cd tests && npm install && npm test` (Java 21 이상 필요)
- 운영 도메인에서는 로그인 핸들러 `/__/auth/*` 를 Netlify가 `<프로젝트>.firebaseapp.com` 으로 프록시한다.
  사파리 등 서드파티 저장소를 막는 브라우저에서도 리디렉션 로그인이 되도록 하기 위함이다.

## A 파이프라인 (주간 코스 풀)

TourAPI에서 관광지·문화시설·레포츠·음식점·행사를 받아 규칙대로 코스를 조합하고 `coursePool/{주차}_{지역}` 에 올린다.

```bash
cd scripts
npm install
cp .env.example .env   # TOURAPI_KEY, GOOGLE_APPLICATION_CREDENTIALS 입력
npm run weekly                     # 이번 주 풀 생성 → data/output/{주차}/ (업로드 안 함)
npm run weekly -- --upload         # Firestore 업로드 + 4주 지난 풀 삭제
npm run weekly -- --week 2026-W40  # 특정 주차
npm run weekly -- --cache          # 오늘 받은 TourAPI 응답(data/cache/) 재사용 — 개발용
npm test                           # 주차·지역·분류·조합 단위 테스트
```

- 매주 전체 수집 (API 호출 약 40회, 개발계정 일 1,000회 한도)
- 지역은 16개. 2026년 통합된 광주·전남은 `전남광주` 하나로 다룬다 (`web/src/regions.js`, 앱과 공용)
- 자동 실행: `.github/workflows/weekly.yml` — 매주 월요일 00:00 KST, Actions 탭에서 수동 실행(주차 지정 가능). Secrets `TOURAPI_KEY`, `FIREBASE_SERVICE_ACCOUNT` 필요
- 찾기 탭 캐시도 함께 올린다: `events/{지역}`(앞으로 90일 행사 코스), `places/{지역}`(즉석 조합용 장소, 압축 문자열)
- 분류 → 취향 매핑: `web/src/shared/categories.js`, 조합 규칙: `web/src/shared/compose.js` (앱의 즉석 조합과 공용), 계절 키워드: `data/templates/seasons.json`

## C 파이프라인 (주간 트렌드, 선택)

매주 한 번 PC의 Claude Code에서 `/weekly-trends` 를 실행하면 이번 주 국내 데이트 트렌드를 웹에서 조사해
`data/trends/{주차}.json` 을 만들고, 확인받은 뒤 push 한다. push 되면 `.github/workflows/trends-upload.yml` 이
검증 → 주변 식사·카페 보강 → `coursePool/{주차}_{지역}.trendCourses`, `events/{지역}.trendCourses` 에 합친다.
C 를 실행하지 않은 주에도 A 만으로 추천은 정상 동작한다.

```bash
cd scripts
npm run trends -- info                                  # 이번 주 주차·계절
npm run trends -- geocode ../data/trends/2026-W40.json  # 좌표 채우기 (KAKAO_REST_KEY 필요)
npm run trends -- validate ../data/trends/2026-W40.json # 형식·기간·출처 검증
npm run trends -- upload ../data/trends/2026-W40.json --dry-run  # 합칠 결과 미리 보기
```

## 배포

GitHub에 push하면 Netlify가 `netlify.toml` 설정대로 `web/`을 빌드해 자동 배포한다.
설정 탭 하단의 "버전 (빌드 시각)"으로 최신 배포가 반영됐는지 확인할 수 있다.
