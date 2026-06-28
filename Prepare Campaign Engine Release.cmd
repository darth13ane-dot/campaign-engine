@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-release.ps1"
if errorlevel 1 (
  echo.
  echo The release was not prepared. Review the message above.
  pause
)
