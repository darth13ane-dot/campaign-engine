@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-desktop.ps1"
if errorlevel 1 (
  echo.
  echo Campaign Engine did not start. Review the message above.
  pause
)
