# ═══════════════════════════════════════════════════════════════════════════
#  Funcţii comune pentru instaleaza.ps1 şi actualizeaza.ps1 (dot-source).
#  Structura pe server (implicit C:\Aplicatii\SDK):
#    cod\          clona git (doar manager\, configurator_usi\, deploy\windows\)
#    date\         manager.sqlite, backup\, server.log, actualizari.log
#    deploy-key\   cheia SSH doar-citire pentru GitHub + known_hosts
#    setari.cmd    NODE, MANAGER_PORT, MANAGER_BACKUP — scris la instalare
# ═══════════════════════════════════════════════════════════════════════════

$NumeSarcina = 'SDK Manager'

function Scrie([string]$text, [string]$culoare = 'Cyan') { Write-Host $text -ForegroundColor $culoare }

function Cere-Admin {
  $id = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $id.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Scriptul trebuie rulat ca administrator (clic dreapta -> Run as administrator).'
  }
}

# PATH-ul proaspăt din registru — după instalarea Node / Git în aceeaşi sesiune
function Reincarca-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Rulează un program extern; aruncă eroare dacă iese cu cod diferit de 0.
# stderr e afişat ca text (git scrie progresul acolo), nu ca eroare PowerShell.
function Ruleaza([string]$exe, [string[]]$argumente) {
  $vechi = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $exe @argumente 2>&1 | ForEach-Object { Write-Host "  $_" } }
  finally { $ErrorActionPreference = $vechi }
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argumente -join ' ') a ieşit cu codul $LASTEXITCODE" }
}

# setari.cmd -> hashtable (liniile: set "CHEIE=valoare")
function Citeste-Setari([string]$radacina) {
  $s = @{ NODE = 'node'; MANAGER_PORT = '8080' }
  $f = Join-Path $radacina 'setari.cmd'
  if (Test-Path $f) {
    foreach ($l in Get-Content $f) { if ($l -match '^set "([A-Z_]+)=(.*)"$') { $s[$Matches[1]] = $Matches[2] } }
  }
  return $s
}

# npm ci + build + testele (configurator şi manager). $true = totul a trecut.
function Construieste-Si-Testeaza([string]$cod, [switch]$FaraTeste) {
  try {
    Push-Location (Join-Path $cod 'configurator_usi')
    Scrie '  npm ci (dependenţe configurator)...'
    Ruleaza 'npm.cmd' @('ci', '--no-audit', '--no-fund')
    Scrie '  construiesc configuratorul...'
    Ruleaza 'npm.cmd' @('run', 'build')
    if (-not $FaraTeste) {
      Scrie '  testele configuratorului...'
      Ruleaza 'npm.cmd' @('test')
    }
    Pop-Location
    if (-not $FaraTeste) {
      Push-Location (Join-Path $cod 'manager')
      Scrie '  testele managerului...'
      # test-oprire.js nu rulează pe Windows (se bazează pe semnalul SIGINT)
      Ruleaza 'node' @('scripts\test.js')
      Ruleaza 'node' @('scripts\test-fara-scanare.js')
      Pop-Location
    }
    return $true
  } catch {
    Scrie "  EŞUAT: $_" 'Red'
    Pop-Location -ErrorAction SilentlyContinue; Pop-Location -ErrorAction SilentlyContinue
    return $false
  }
}

# Opreşte managerul: sarcina + orice node.exe care rulează serverul din $cod
function Opreste-Server([string]$cod) {
  Stop-ScheduledTask -TaskName $NumeSarcina -ErrorAction SilentlyContinue
  $server = Join-Path $cod 'manager\server\index.js'
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($server) } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
  Start-Sleep -Seconds 1
}

# Porneşte sarcina şi aşteaptă ca /login să răspundă. $true = serverul merge.
function Porneste-Si-Verifica([int]$port) {
  Start-ScheduledTask -TaskName $NumeSarcina
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      $r = Invoke-WebRequest "http://127.0.0.1:$port/login" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
  }
  return $false
}
