@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo The built app was not found. Building it now...
  call npm.cmd run build
  if errorlevel 1 (
    echo.
    echo Build failed.
    pause
    exit /b 1
  )
)
start "" "%~dp0dist\index.html"
