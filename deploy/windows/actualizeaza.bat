@echo off
rem Ruleaza actualizeaza.ps1 ca administrator (cere singur drepturile, pastreaza optiunile).
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "$a='%*'; if ($a) { Start-Process -Verb RunAs -FilePath '%~f0' -ArgumentList $a } else { Start-Process -Verb RunAs -FilePath '%~f0' }"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizeaza.ps1" %*
echo.
pause
