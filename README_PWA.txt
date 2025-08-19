INOPNC PWA 번들
=================

이 폴더/ZIP의 파일들을 **웹 서버 루트(/)** 에 배치하세요.

포함 파일
---------
- manifest.webmanifest
- service-worker.js
- offline.html
- icon-192x192.png
- icon-512x512.png

적용 방법
---------
1) index.html의 <head>에 다음이 포함되어 있는지 확인:
   <link rel="manifest" href="/manifest.webmanifest">
   <meta name="theme-color" content="#0068FE">

2) 페이지 로드시 서비스 워커를 등록하세요(이미 구현되어 있다면 그대로 사용):
   navigator.serviceWorker.register('/service-worker.js', { scope: '/' });

3) HTTPS에서 접근해야 설치/캐싱이 동작합니다(로컬 개발은 http://localhost 허용).

4) 새 버전 반영:
   서비스 워커가 업데이트되면 콘솔에 안내가 표시됩니다. 필요시 postMessage로 SKIP_WAITING을 전송해 즉시 업데이트할 수 있습니다.

테스트
-----
- 페이지 방문 후 DevTools > Application > Service Workers에서 등록 상태 확인
- DevTools > Network에서 "Offline" 체크 후 화면 동작/오프라인 페이지 확인

캐시 정책 (요약)
----------------
- 내비게이션: 네트워크 우선, 실패시 캐시/오프라인
- 동일 출처 정적/JSON: Stale-While-Revalidate
- 외부 CDN/글꼴: Cache-First
