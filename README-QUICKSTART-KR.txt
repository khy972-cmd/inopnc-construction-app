# INOPNC QuickStart (Windows · 한국어)

## 0) 압축 풀 위치
- 권장 경로: `C:\myproject` (예: `C:\myproject\` 안에 이 파일들과 index.html, admin-console.html 등이 보이면 정상)

## 1) 서버 실행
1. Node.js LTS 설치 (https://nodejs.org/ko/)
2. `start_dev.bat` 더블클릭 → 자동으로 `npm install` 후 개발 서버 실행
3. 브라우저에서 열기:
   - 메인 앱: http://localhost:8080/
   - 관리자 콘솔: http://localhost:8080/admin-console.html

## 2) 첫 설정(Supabase)
1. 관리자 콘솔 → 시스템 설정 탭
2. Supabase URL, API Key 입력 → [설정 저장] → [연결 테스트]
3. 저장 후, 작업자/현장 등록 또는 엑셀 업로드 진행

## 3) 엑셀 업로드 팁
- 작업(Work): `년-월-일, 현장, 작업자, 공수, 메모`
- 경비(Expense): `현장, 사용일, 항목, 금액, 사용처, 주소, 메모`
- 중복 키 원칙(기존값 보존):
  - 작업: 일자+현장+작업자
  - 경비: 일자+현장+항목+금액
- 관리자 콘솔에서 미리보기/검증 후 [처리] → [동기화]

## 4) PWA/아이콘/오프라인
- 이 폴더에는 `manifest.webmanifest`, `icon-192x192.png`, `icon-512x512.png`, `offline.html`이 포함되어 있습니다.
- 서비스워커가 정상 등록되려면 반드시 **서버**로 열어야 합니다(`file://`로는 동작 X).
- 새 버전 반영이 안 될 때는 앱 상단의 [새로고침/캐시 삭제] 버튼 사용.

## 5) 문제가 생기면
- 아이콘/매니페스트 404 → 파일이 이 루트 폴더에 있는지 확인
- Supabase 인증 에러 → URL/Key 재확인, 테이블/권한 정책 확인
- 포트 충돌 → `package.json`의 포트(8080)를 다른 번호로 바꾸고 다시 실행

행운을 빕니다! 🙌
