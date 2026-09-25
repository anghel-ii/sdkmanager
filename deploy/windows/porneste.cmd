@echo off
rem Porneste managerul de comenzi. Il ruleaza sarcina programata "SDK Manager"
rem la pornirea serverului (instaleaza.ps1). Nu se ruleaza de mana.
setlocal
set "RADACINA=%~dp0..\..\.."
for %%I in ("%RADACINA%") do set "RADACINA=%%~fI"
set "NODE=node"
set "MANAGER_DB=%RADACINA%\date\manager.sqlite"
set "MANAGER_BACKUP=%RADACINA%\date\backup"
rem setari.cmd (scris de instalare, in afara codului): NODE, MANAGER_PORT, MANAGER_BACKUP
if exist "%RADACINA%\setari.cmd" call "%RADACINA%\setari.cmd"
cd /d "%RADACINA%\cod\manager"
rem ponytail: jurnalul creste fara limita; de rotit daca ajunge mare
"%NODE%" "%RADACINA%\cod\manager\server\index.js" >> "%RADACINA%\date\server.log" 2>&1
