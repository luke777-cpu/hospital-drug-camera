@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
cd /d "%~dp0"
title Hospital Drug Camera v2.6
if not exist "drugs.json" goto wrongfolder
if not exist "families.json" goto wrongfolder
where py >nul 2>nul
if errorlevel 1 goto nopy
where curl.exe >nul 2>nul
if errorlevel 1 goto nocurl
echo 기존 서버 창을 Ctrl+C로 종료한 뒤 아무 키나 누르세요.
pause >nul
set "UPDATE_STAGE=%CD%\update-v26-%RANDOM%-%RANDOM%"
mkdir "%UPDATE_STAGE%"
if errorlevel 1 goto failed
mkdir "%UPDATE_STAGE%\backup"
if errorlevel 1 goto failed
set "UPDATE_FILES=server.py base_server.py external_lookup.py app.js app.html matcher.js"
set "UPDATE_URL=https://raw.githubusercontent.com/luke777-cpu/hospital-drug-camera/88879da242fb21de91696b725046dc9acc3d8932"
echo 업데이트 파일을 내려받습니다...
for %%F in (%UPDATE_FILES%) do (
  curl.exe --fail --location --retry 2 --connect-timeout 15 --max-time 90 "%UPDATE_URL%/%%F" -o "%UPDATE_STAGE%\%%F"
  if errorlevel 1 goto failed
)
py -3 -c "import pathlib,sys; p=pathlib.Path(sys.argv[1]); [compile((p/f).read_text(encoding='utf-8'), f, 'exec') for f in ('server.py','base_server.py','external_lookup.py')]" "%UPDATE_STAGE%"
if errorlevel 1 goto failed
for %%F in (%UPDATE_FILES%) do (
  if exist "%%F" (
    copy /y "%%F" "%UPDATE_STAGE%\backup\%%F" >nul
    if errorlevel 1 goto failed
  )
)
for %%F in (%UPDATE_FILES%) do (
  copy /y "%UPDATE_STAGE%\%%F" "%%F" >nul
  if errorlevel 1 goto rollback
)
echo.
echo 업데이트 완료. 기존 파일 백업: %UPDATE_STAGE%\backup
echo 아래 Wi-Fi의 IPv4 주소를 서버 질문에 입력하세요.
ipconfig
echo.
echo 서버를 시작합니다. API 키 입력은 화면에 보이지 않습니다.
py -3 server.py --lan
echo.
echo 서버가 종료되었습니다.
pause
exit /b
:rollback
echo 교체 실패. 기존 파일을 복구합니다.
for %%F in (%UPDATE_FILES%) do if exist "%UPDATE_STAGE%\backup\%%F" copy /y "%UPDATE_STAGE%\backup\%%F" "%%F" >nul
goto failed
:wrongfolder
echo 이 파일을 drugs.json과 server.py가 있는 기존 약 프로그램 폴더에 넣어주세요.
pause
exit /b 1
:nopy
echo Python 실행기 py를 찾을 수 없습니다.
pause
exit /b 1
:nocurl
echo Windows curl.exe를 찾을 수 없습니다.
pause
exit /b 1
:failed
echo 업데이트를 완료하지 못했습니다. 위 오류를 확인하세요. 서버는 시작하지 않습니다.
pause
exit /b 1
