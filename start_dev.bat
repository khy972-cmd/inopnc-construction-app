@echo off
chcp 65001 >nul
title INOPNC 서버 실행
echo.
echo [1/2] Node.js가 설치되어 있어야 합니다. (https://nodejs.org/ko/)
echo [2/2] 의존성 설치 및 개발 서버 실행을 시작합니다...
echo.

REM 현재 배치 파일 위치로 이동
cd /d %~dp0

IF NOT EXIST node_modules (
  echo npm install 실행 중...
  call npm install
)

echo 서버 실행: http://localhost:8080
call npm run dev

pause
