@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1" -IncludeArchivistData
if errorlevel 1 (
  echo.
  echo The build did not finish. Review the message above.
  pause
)
