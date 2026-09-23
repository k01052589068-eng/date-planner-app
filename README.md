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
netlify.toml         Netlify 빌드 설정 (base = web)
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

## 배포

GitHub에 push하면 Netlify가 `netlify.toml` 설정대로 `web/`을 빌드해 자동 배포한다.
설정 탭 하단의 "버전 (빌드 시각)"으로 최신 배포가 반영됐는지 확인할 수 있다.
