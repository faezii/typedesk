@echo off
rem TypeDesk: double-click to open.
rem Starts the app on this PC (port 3000) if it isn't running yet, then opens it in its own window.
rem Data lives in the Neon cloud database set in .env. Close the minimised "TypeDesk server" window to stop it.
setlocal
cd /d "%~dp0"
set "URL=http://localhost:3000"

call :ready && goto open

rem Build on first use, and again whenever the code changes (new git commit).
rem A new commit may bring database changes: apply them (prisma migrate deploy) before building.
set "HEAD="
set "BUILT="
for /f %%h in ('git rev-parse HEAD 2^>nul') do set "HEAD=%%h"
if exist ".next\typedesk-build.txt" set /p BUILT=<".next\typedesk-build.txt"
if not exist ".next\BUILD_ID" set "BUILT=none"
if not "%HEAD%"=="%BUILT%" (
  echo Preparing TypeDesk, this takes about a minute...
  call npx prisma migrate deploy || goto dbfailed
  call npm run build || goto failed
  >".next\typedesk-build.txt" echo %HEAD%
)

start "TypeDesk server" /min cmd /c "npm run start -- -p 3000"
echo Starting TypeDesk...
for /l %%i in (1,1,60) do (
  call :ready && goto open
  timeout /t 1 /nobreak >nul
)
goto failed

:open
start "" msedge --app=%URL%
exit /b 0

:ready
curl -sf -o NUL --max-time 2 "%URL%/login" >nul 2>&1
exit /b %errorlevel%

:dbfailed
echo.
echo TypeDesk could not update its database: "npx prisma migrate deploy" failed (message above).
echo Nothing was rebuilt or started. Check the internet connection and the message, then try again.
pause
exit /b 1

:failed
echo.
echo TypeDesk could not start. Check the "TypeDesk server" window for the error message.
pause
exit /b 1
