# GitHub 업로드 빠른 가이드 (Windows)

## 전제
- 로컬 작업 폴더: `C:\myproject`
- 원격 저장소: `https://github.com/khy972-cmd/inopnc-construction-app.git` (작성자 계정에 권한이 있다고 가정)

## A. 한방 스크립트 사용 (초보 추천)
1) `push_to_github.bat` 더블클릭
2) 완료 후 출력되는 링크로 들어가 **Pull Request** 생성

> 기본 브랜치명: `feature/pwa-admin-console-upload`  
> 변경하려면 배치 파일 상단의 `BRANCH` 값을 바꾸세요.

## B. 수동 명령어 (CMD 또는 PowerShell)
```bat
git --version

REM 1) 저장소 클론
git clone https://github.com/khy972-cmd/inopnc-construction-app.git C:\inopnc-construction-app

REM 2) 파일 복사 (기존 .git 보존)
robocopy C:\myproject C:\inopnc-construction-app /E /XD .git node_modules .vercel .netlify dist build coverage .tmp /XF *.zip

REM 3) 브랜치 만들기
cd /d C:\inopnc-construction-app
git checkout -b feature/pwa-admin-console-upload

REM 4) 커밋/푸시
git add -A
git commit -m "feat: admin console + Excel bulk upload + PWA offline"
git push -u origin feature/pwa-admin-console-upload
```

## C. 자주 막히는 부분
- **권한/인증 실패**: GitHub 계정 권한 확인, Personal Access Token 사용
- **덮어쓰기 금지 정책**: 서버 로직에서 `INSERT ... ON CONFLICT DO NOTHING` 사용 권장
- **비밀키 노출 방지**: `.env`, `service_role` 키는 **커밋 금지** (아래 `.gitignore` 참고)

## D. 배포(선택)
- **GitHub Pages**: 정적 사이트에 적합. `index.html`, `service-worker.js`, `manifest.webmanifest`, 아이콘 파일이 루트에 있어야 합니다.
- **Vercel/Netlify**: 루트 배포, 빌드 없이 정적 배포 가능.
