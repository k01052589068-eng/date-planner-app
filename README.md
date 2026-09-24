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
- 분류 → 취향 매핑: `scripts/lib/places.js`, 조합 규칙: `scripts/lib/compose.js`, 계절 키워드: `data/templates/seasons.json`

## 배포

GitHub에 push하면 Netlify가 `netlify.toml` 설정대로 `web/`을 빌드해 자동 배포한다.
설정 탭 하단의 "버전 (빌드 시각)"으로 최신 배포가 반영됐는지 확인할 수 있다.
