INOPNC PWA 번들 (v20250127_002)
================================

이 폴더/ZIP의 파일들을 **웹 서버 루트(/)** 에 배치하세요.

업데이트 내용 (v20250127_002):
- 수익분석 페이지 다크모드 색상 오류 수정
- 아코디언 컴포넌트 다크모드 최적화
- 캘린더 셀 테두리 라운드 제거
- 공수 0/0.5 빨간색 표시 기능 추가

포함 파일
---------
- manifest.webmanifest (PWA 매니페스트)
- service-worker.js (서비스 워커)
- offline.html (오프라인 페이지)
- icon-192x192.png (앱 아이콘 192px)
- icon-512x512.png (앱 아이콘 512px)

적용 방법
---------
1) index.html의 <head>에 다음이 포함되어 있는지 확인:
   <link rel="manifest" href="/manifest.webmanifest">
   <meta name="theme-color" content="#0068FE">
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="default">
   <meta name="apple-mobile-web-app-title" content="INOPNC 현장관리">

2) 페이지 로드시 서비스 워커를 등록하세요(이미 구현되어 있다면 그대로 사용):
   navigator.serviceWorker.register('/service-worker.js', { scope: '/' });

3) HTTPS에서 접근해야 설치/캐싱이 동작합니다(로컬 개발은 http://localhost 허용).

4) 새 버전 반영:
   서비스 워커가 업데이트되면 콘솔에 안내가 표시됩니다. 필요시 postMessage로 SKIP_WAITING을 전송해 즉시 업데이트할 수 있습니다.

테스트
-----
- 페이지 방문 후 DevTools > Application > Service Workers에서 등록 상태 확인
- DevTools > Network에서 "Offline" 체크 후 화면 동작/오프라인 페이지 확인
- DevTools > Application > Manifest에서 PWA 설정 확인
- 모바일에서 "홈 화면에 추가" 기능 테스트

캐시 정책 (요약)
----------------
- 내비게이션: 네트워크 우선, 실패시 캐시/오프라인
- 동일 출처 정적/JSON: Stale-While-Revalidate
- 외부 CDN/글꼴: Cache-First
- 외부 리소스 프리캐시: Google Fonts, Font Awesome, XLSX.js, Supabase

주요 기능
---------
- 오프라인 지원 (기본 페이지 캐싱)
- 홈 화면 설치 가능
- 백그라운드 동기화 지원
- 반응형 디자인 (모바일 최적화)
- 다크모드 지원
- 실시간 데이터 동기화 (Supabase)

업데이트 방법
-------------
1. service-worker.js의 CACHE_VERSION을 변경
2. 서버에 새 파일 배포
3. 사용자가 페이지 새로고침 시 자동 업데이트
4. 즉시 업데이트를 원하면: navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'});
