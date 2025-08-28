@echo off
chcp 65001 >nul
setlocal ENABLEDELAYEDEXPANSION

REM ===== 사용자 환경 설정 =====
set "REPO_URL=https://github.com/khy972-cmd/inopnc-construction-app.git"
set "WORK_DIR=C:\myproject"
set "CLONE_DIR=C:\inopnc-construction-app"
set "BRANCH=feature/pwa-admin-console-upload"

echo.
echo [1/6] Git 설치 확인...
git --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo Git이 설치되어 있지 않습니다. https://git-scm.com/download/win 에서 설치 후 다시 시도하세요.
  pause
  exit /b 1
)

echo [2/6] 원격 저장소 클론 준비: %REPO_URL%
IF NOT EXIST "%CLONE_DIR%\.git" (
  IF NOT EXIST "%CLONE_DIR%" mkdir "%CLONE_DIR%"
  echo 저장소를 클론합니다...
  git clone "%REPO_URL%" "%CLONE_DIR%"
  IF ERRORLEVEL 1 (
    echo 클론 실패. URL 권한/네트워크를 확인하세요.
    pause
    exit /b 1
  )
) ELSE (
  echo 기존 클론 감지: %CLONE_DIR%
)

echo [3/6] 작업 파일 복사: %WORK_DIR% -> %CLONE_DIR%
IF NOT EXIST "%WORK_DIR%" (
  echo 작업 폴더가 없습니다: %WORK_DIR%
  echo 먼저 C:\myproject 에 파일을 준비하세요.
  pause
  exit /b 1
)

REM robocopy로 동기화 (node_modules, .git 등 제외)
robocopy "%WORK_DIR%" "%CLONE_DIR%" /E /NFL /NDL /NJH /NJS /NP /XD .git node_modules .vercel .netlify dist build coverage .tmp /XF *.zip desktop.ini >nul

echo [4/6] 브랜치 생성/전환: %BRANCH%
cd /d "%CLONE_DIR%"
git fetch origin >nul 2>&1
git checkout -B "%BRANCH%" >nul 2>&1

echo [5/6] 변경 파일 스테이징 및 커밋
git add -A
git commit -m "feat: admin console + Excel bulk upload + PWA offline\n\n- keep existing data policy (no overwrite on duplicates)\n- icons/manifest/offline.html included\n- service worker caching + cache-reset UI" >nul 2>&1

IF ERRORLEVEL 1 (
  echo 커밋할 변경사항이 없거나 에러가 발생했습니다. (무시 가능)
) ELSE (
  echo 커밋 완료.
)

echo [6/6] 원격으로 푸시
git push -u origin "%BRANCH%"
IF ERRORLEVEL 1 (
  echo 푸시 실패. 원격 권한 또는 2단계 인증(토큰)을 확인하세요.
  echo GitHub Personal Access Token이 필요할 수 있습니다.
  pause
  exit /b 1
)

echo.
echo 완료! 이제 브라우저에서 Pull Request 를 생성하세요:
echo https://github.com/khy972-cmd/inopnc-construction-app/compare/%BRANCH%?expand=1
echo.
pause
