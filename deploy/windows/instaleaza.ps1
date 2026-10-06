# ═══════════════════════════════════════════════════════════════════════════
#  INSTALARE pe serverul Windows — o singură dată. Se rulează cu instaleaza.bat
#  (cere singur drepturi de administrator). Poate fi rulat din nou fără grijă:
#  sare peste ce e deja făcut.
#
#  Parametri (opţionali):
#    -Radacina  C:\Aplicatii\SDK      unde stau codul, datele şi cheia
#    -Port      8080                  portul managerului în reţeaua firmei
#    -Backup    D:\Backup\SDK         backup-urile zilnice (ideal pe ALT disc)
# ═══════════════════════════════════════════════════════════════════════════
param(
  [string]$Radacina = 'C:\Aplicatii\SDK',
  [int]$Port = 8080,
  [string]$Backup = '',
  [string]$Repo = 'git@github.com:anghel-ii/sdkmanager.git'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest e mult mai rapid fără bara de progres

# Cheia publică a GitHub (ed25519), cea publicată oficial — conexiunea e refuzată
# dacă serverul de la celălalt capăt nu o are.
$GitHubHostKey = 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl'

function Descarca-Verificat([string]$url, [string]$sha256, [string]$fisier) {
  Scrie "  descarc $url"
  Invoke-WebRequest $url -OutFile $fisier -UseBasicParsing
  $h = (Get-FileHash $fisier -Algorithm SHA256).Hash.ToLower()
  if ($h -ne $sha256.ToLower()) {
    Remove-Item $fisier -Force
    throw "Amprenta fişierului descărcat NU se potriveşte ($h, aşteptat $sha256). Nu instalez nimic."
  }
  Scrie '  amprenta SHA-256 verificată' 'Green'
}

function Versiune-Node {
  try { $v = & node -v 2>$null } catch { return $null }
  if ($v -match '^v(\d+)\.(\d+)\.(\d+)') { return [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" }
  return $null
}

try {
  Cere-Admin
  Scrie "`n=== Instalare manager de comenzi în $Radacina ===`n" 'White'

  # ── 1. Node.js (minim 22.5 pt. node:sqlite; se instalează ultimul Node 24 LTS) ──
  Scrie '[1/8] Node.js'
  $v = Versiune-Node
  if ($v -and $v -ge [version]'22.5.0') {
    Scrie "  găsit Node $v — e bun" 'Green'
  } else {
    if ($v) { Scrie "  Node $v e prea vechi (minim 22.5) — instalez Node 24 LTS" 'Yellow' }
    else    { Scrie '  Node nu e instalat — instalez Node 24 LTS' 'Yellow' }
    $baza = 'https://nodejs.org/dist/latest-v24.x/'
    $linie = (Invoke-WebRequest "${baza}SHASUMS256.txt" -UseBasicParsing).Content -split "`n" |
      Where-Object { $_ -match '^([0-9a-f]{64})\s+(node-v24\.\d+\.\d+-x64\.msi)$' } | Select-Object -First 1
    if (-not $linie) { throw 'Nu găsesc instalatorul Node 24 x64 în lista oficială.' }
    $null = $linie -match '^([0-9a-f]{64})\s+(\S+)$'
    $msi = Join-Path $env:TEMP $Matches[2]
    Descarca-Verificat ($baza + $Matches[2]) $Matches[1] $msi
    Scrie '  instalez Node (fără ferestre)...'
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
    if ($p.ExitCode -notin 0, 3010) { throw "Instalarea Node a eşuat (cod $($p.ExitCode))." }
    Reincarca-Path
    $v = Versiune-Node
    if (-not $v) { throw 'Node pare instalat, dar nu îl găsesc în PATH. Reporneşte sesiunea şi rulează din nou.' }
    Scrie "  Node $v instalat" 'Green'
  }
  $nodeExe = (Get-Command node).Source

  # ── 2. Git for Windows ──
  Scrie '[2/8] Git'
  $areGit = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
  if ($areGit) {
    Scrie "  găsit $(& git --version)" 'Green'
  } else {
    Scrie '  Git nu e instalat — instalez ultima versiune Git for Windows' 'Yellow'
    $rel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'
    $asset = $rel.assets | Where-Object { $_.name -match '^Git-[\d.]+-64-bit\.exe$' } | Select-Object -First 1
    if (-not $asset) { throw 'Nu găsesc instalatorul Git 64-bit în ultima versiune.' }
    # amprentele SHA-256 sunt în descrierea versiunii: „Git-...-64-bit.exe | <sha>"
    if ($rel.body -notmatch ([regex]::Escape($asset.name) + '\s*\|\s*([0-9a-f]{64})')) {
      throw 'Nu găsesc amprenta SHA-256 a instalatorului Git în descrierea versiunii.'
    }
    $exe = Join-Path $env:TEMP $asset.name
    Descarca-Verificat $asset.browser_download_url $Matches[1] $exe
    Scrie '  instalez Git (fără ferestre)...'
    $p = Start-Process $exe -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES' -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "Instalarea Git a eşuat (cod $($p.ExitCode))." }
    Reincarca-Path
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git pare instalat, dar nu îl găsesc în PATH.' }
    Scrie "  $(& git --version) instalat" 'Green'
  }
  $gitExe = (Get-Command git).Source                      # ...\Git\cmd\git.exe
  $sshKeygen = Join-Path (Split-Path (Split-Path $gitExe)) 'usr\bin\ssh-keygen.exe'

  # ── 3. Foldere ──
  Scrie '[3/8] Foldere'
  $cod = Join-Path $Radacina 'cod'
  $date = Join-Path $Radacina 'date'
  $chei = Join-Path $Radacina 'deploy-key'
  if (-not $Backup) { $Backup = Join-Path $date 'backup' }
  foreach ($d in $Radacina, $date, $Backup, $chei) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  Scrie "  cod: $cod`n  date: $date`n  backup: $Backup" 'Green'

  # ── 4. Cheia de deploy (doar citire, doar pt. acest repository) ──
  Scrie '[4/8] Cheia de acces la GitHub'
  $cheie = Join-Path $chei 'id_ed25519'
  $knownHosts = Join-Path $chei 'known_hosts'
  if (-not (Test-Path $cheie)) {
    Start-Process $sshKeygen -ArgumentList "-q -t ed25519 -N `"`" -C `"server-rack-$env:COMPUTERNAME`" -f `"$cheie`"" -Wait -NoNewWindow
    if (-not (Test-Path $cheie)) { throw 'Nu am putut genera cheia SSH.' }
  }
  Set-Content -Path $knownHosts -Value $GitHubHostKey -Encoding Ascii
  # doar SYSTEM şi Administratorii pot citi cheia (SID-uri, ca să meargă pe orice limbă a Windows-ului)
  & icacls.exe $chei /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  $fw = { param($p) $p -replace '\\', '/' }
  $sshCmd = "ssh -i '$(& $fw $cheie)' -o IdentitiesOnly=yes -o UserKnownHostsFile='$(& $fw $knownHosts)' -o StrictHostKeyChecking=yes"
  $env:GIT_SSH_COMMAND = $sshCmd

  $vechi = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & git ls-remote $Repo HEAD *> $null; $acces = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $vechi
  while (-not $acces) {
    Scrie "`n  Adaugă cheia de mai jos în GitHub, la repository:" 'Yellow'
    Scrie '    github.com/anghel-ii/sdkmanager -> Settings -> Deploy keys -> Add deploy key' 'Yellow'
    Scrie '    Title: Server rack   |   NU bifa „Allow write access"' 'Yellow'
    Scrie "`n$(Get-Content "$cheie.pub")`n" 'White'
    Read-Host '  Apasă Enter după ce ai adăugat-o (Ctrl+C ca să renunţi)'
    $ErrorActionPreference = 'Continue'
    & git ls-remote $Repo HEAD *> $null; $acces = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $vechi
    if (-not $acces) { Scrie '  GitHub încă refuză accesul — verifică cheia şi încearcă din nou.' 'Red' }
  }
  Scrie '  acces la GitHub: OK (doar citire)' 'Green'

  # ── 5. Codul — doar ce trebuie să ruleze pe server ──
  Scrie '[5/8] Codul de pe GitHub'
  $sigur = (& $fw $cod)
  if (-not ((& git config --system --get-all safe.directory 2>$null) -contains $sigur)) {
    Ruleaza 'git' @('config', '--system', '--add', 'safe.directory', $sigur)
  }
  if (-not (Test-Path (Join-Path $cod '.git'))) {
    Ruleaza 'git' @('clone', '--no-checkout', $Repo, $cod)
  }
  Ruleaza 'git' @('-C', $cod, 'config', 'core.sshCommand', $sshCmd)
  # sparse checkout: fără documente, fără unelte de lucru de pe laptop
  Ruleaza 'git' @('-C', $cod, 'sparse-checkout', 'set', '--no-cone',
                  '/manager/', '/configurator_usi/', '/deploy/windows/', '!/configurator_usi/dev.js')
  Ruleaza 'git' @('-C', $cod, 'checkout', 'main')
  Ruleaza 'git' @('-C', $cod, 'pull', '--ff-only')

  # ── 6. Setări + construire + teste ──
  Scrie '[6/8] Setări, construire şi teste'
  $setari = @("@echo off", "rem Scris de instaleaza.ps1 — setările serverului, în afara codului",
              "set `"NODE=$nodeExe`"", "set `"MANAGER_PORT=$Port`"", "set `"MANAGER_BACKUP=$Backup`"")
  Set-Content -Path (Join-Path $Radacina 'setari.cmd') -Value $setari -Encoding Ascii
  if (-not (Construieste-Si-Testeaza $cod)) { throw 'Construirea sau testele au eşuat — serverul NU a fost pornit.' }

  # ── 7. Baza de date ──
  Scrie '[7/8] Baza de date'
  $baza = Join-Path $date 'manager.sqlite'
  if (Test-Path $baza) {
    Scrie "  există deja: $baza — o păstrez" 'Green'
  } else {
    Scrie "  Nu există încă o bază în $baza." 'Yellow'
    Scrie '  - ca să păstrezi ofertele şi conturile de pe laptop: copiază acum fişierul' 'Yellow'
    Scrie "    manager.sqlite (copia curată de pe laptop) exact la $baza, apoi apasă Enter" 'Yellow'
    Scrie '  - ca să porneşti cu o bază nouă: scrie N şi apasă Enter' 'Yellow'
    $r = Read-Host '  Enter / N'
    if (-not (Test-Path $baza)) {
      if ($r -notmatch '^[nN]') { throw "Nu găsesc $baza. Rulează din nou instalarea după ce copiezi fişierul." }
      $env:MANAGER_DB = $baza; $env:MANAGER_BACKUP = $Backup
      Push-Location (Join-Path $cod 'manager'); Ruleaza 'node' @('scripts\init.js'); Pop-Location
      Read-Host '  Notează parola de mai sus, apoi apasă Enter'
    }
  }

  # ── 8. Firewall + pornire automată ──
  Scrie '[8/8] Firewall şi pornire automată'
  $regula = "SDK Manager (TCP $Port)"
  Get-NetFirewallRule -DisplayName 'SDK Manager (TCP *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $regula -Direction Inbound -Protocol TCP -LocalPort $Port `
    -Action Allow -Profile Domain, Private | Out-Null
  Scrie "  firewall: portul $Port deschis doar pentru reţeaua internă (Domain, Private)" 'Green'

  Opreste-Server $cod
  $porneste = Join-Path $cod 'deploy\windows\porneste.cmd'
  $actiune = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$porneste`""
  $declansator = New-ScheduledTaskTrigger -AtStartup
  $cine = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $setariSarcina = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $NumeSarcina -Action $actiune -Trigger $declansator -Principal $cine `
    -Settings $setariSarcina -Description 'Managerul de comenzi (Node). Porneşte odată cu serverul.' -Force | Out-Null
  Asigura-Paza

  # sarcina de update, fără declanşator: o porneşte serverul din /admin (tot SYSTEM),
  # ca update-ul să se poată face din browser, fără cont de administrator pe Windows
  $actualizeaza = Join-Path $cod 'deploy\windows\actualizeaza.ps1'
  $actiuneUpdate = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$actualizeaza`""
  $setariUpdate = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName 'SDK Actualizare' -Action $actiuneUpdate -Principal $cine `
    -Settings $setariUpdate -Description 'Update din GitHub, pornit din pagina /admin a managerului.' -Force | Out-Null

  # scurtătura de update, în rădăcină
  Set-Content -Path (Join-Path $Radacina 'Actualizeaza aplicatia.bat') -Encoding Ascii `
    -Value @('@echo off', 'call "%~dp0cod\deploy\windows\actualizeaza.bat"')

  if (-not (Porneste-Si-Verifica $Port)) {
    throw "Serverul nu răspunde pe portul $Port. Vezi jurnalul: $(Join-Path $date 'server.log')"
  }

  $ipuri = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object IPAddress
  Scrie "`n=== Gata. Managerul rulează şi porneşte singur odată cu serverul. ===" 'Green'
  foreach ($ip in $ipuri) { Scrie "  http://${ip}:$Port" 'White' }
  Scrie "`n  Update-uri: dublu-clic pe  $(Join-Path $Radacina 'Actualizeaza aplicatia.bat')" 'White'
} catch {
  Scrie "`nINSTALAREA S-A OPRIT: $_" 'Red'
  exit 1
}
