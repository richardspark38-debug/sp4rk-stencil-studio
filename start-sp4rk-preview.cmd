@echo off
setlocal
cd /d "%~dp0"
echo Starting SP4RK Stencil Studio...
echo.
echo Project folder:
echo %cd%
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js or open this project in a terminal where node works.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing app packages...
  call npm.cmd install --cache .npm-cache
  if errorlevel 1 (
    echo.
    echo Package install failed.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo Building app...
  call npm.cmd run build
  if errorlevel 1 (
    echo.
    echo Build failed.
    pause
    exit /b 1
  )
)

echo.
echo Keep this window open while using the app.
echo Browser URL: http://127.0.0.1:4173/
echo.
start "" "http://127.0.0.1:4173/"
node preview-server.mjs

echo.
echo The preview server stopped.
pause
