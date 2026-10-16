@echo off
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
if exist "dist\win-unpacked\Allods Survivors.exe" (
  start "" "%~dp0dist\win-unpacked\Allods Survivors.exe"
  exit /b
)
if exist "dist\Allods-Survivors-win-x64.exe" (
  start "" "%~dp0dist\Allods-Survivors-win-x64.exe"
  exit /b
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start this game.
  pause
  exit /b 1
)
if exist "node_modules\electron\cli.js" (
  node tools\run-electron.cjs
) else (
  node survivors\launcher.cjs
)
pause
