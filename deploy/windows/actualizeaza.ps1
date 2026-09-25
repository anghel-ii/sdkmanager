# ═══════════════════════════════════════════════════════════════════════════
#  UPDATE pe server — se rulează cu „Actualizeaza aplicatia.bat" din C:\Aplicatii\SDK.
#  Ordinea: backup la bază -> codul nou de pe GitHub -> construire + teste ->
#  repornire -> verificare. Dacă ceva pică, revine singur la versiunea de dinainte.
#  Ideal când nu lucrează nimeni în aplicaţie (configuratorul se schimbă în timpul
#  construirii, înainte de repornire).
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

$cod = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Radacina = Split-Path $cod
$date = Join-Path $Radacina 'date'
$s = Citeste-Setari $Radacina
$env:Path = (Split-Path $s.NODE) + ';' + $env:Path      # acelaşi Node ca serverul
$port = [int]$s.MANAGER_PORT
$backupDir = if ($s.MANAGER_BACKUP) { $s.MANAGER_BACKUP } else { Join-Path $date 'backup' }
# comun.ps1 e citit din cod — după git reset el se poate schimba; funcţiile sunt deja încărcate

Start-Transcript -Path (Join-Path $date 'actualizari.log') -Append | Out-Null
$vechi = $null
try {
  Cere-Admin
  Scrie "`n=== Update manager de comenzi — $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===`n" 'White'

  Scrie '[1/5] Caut versiune nouă pe GitHub'
  Ruleaza 'git' @('-C', $cod, 'fetch', '--quiet', 'origin', 'main')
  $vechi = (& git -C $cod rev-parse HEAD).Trim()
  $nou   = (& git -C $cod rev-parse origin/main).Trim()
  if ($vechi -eq $nou) { Scrie '  Aplicaţia e deja la zi. Nu am schimbat nimic.' 'Green'; return }
  Scrie '  Schimbări noi:' 'Yellow'
  & git -C $cod log --oneline "$vechi..$nou" | ForEach-Object { Write-Host "    $_" }

  Scrie '[2/5] Backup la baza de date'
  $copie = Join-Path $backupDir ("inainte-update-$(Get-Date -Format 'yyyy-MM-dd_HHmm').sqlite")
  Ruleaza 'node' @((Join-Path $PSScriptRoot 'backup-baza.js'), (Join-Path $date 'manager.sqlite'), $copie)

  Scrie '[3/5] Aduc codul nou'
  Ruleaza 'git' @('-C', $cod, 'reset', '--hard', '--quiet', $nou)

  Scrie '[4/5] Construire şi teste'
  if (-not (Construieste-Si-Testeaza $cod)) {
    Scrie '  Versiunea nouă NU a trecut testele — revin la cea de dinainte.' 'Red'
    Ruleaza 'git' @('-C', $cod, 'reset', '--hard', '--quiet', $vechi)
    Construieste-Si-Testeaza $cod -FaraTeste | Out-Null
    Scrie '  Serverul a rămas pe versiunea veche şi nu a fost oprit.' 'Yellow'
    exit 1
  }

  Scrie '[5/5] Repornesc serverul'
  Opreste-Server $cod
  if (Porneste-Si-Verifica $port) {
    Scrie "`n=== Update reuşit. Serverul rulează versiunea $($nou.Substring(0,7)). ===" 'Green'
    return
  }
  Scrie '  Serverul nou nu răspunde — revin la versiunea de dinainte.' 'Red'
  Ruleaza 'git' @('-C', $cod, 'reset', '--hard', '--quiet', $vechi)
  Construieste-Si-Testeaza $cod -FaraTeste | Out-Null
  Opreste-Server $cod
  if (Porneste-Si-Verifica $port) {
    Scrie '  Serverul merge din nou pe versiunea veche.' 'Yellow'
  } else {
    Scrie "  ATENŢIE: nici versiunea veche nu porneşte. Jurnal: $(Join-Path $date 'server.log')" 'Red'
    Scrie "  Baza de dinainte de update: $copie" 'Red'
  }
  exit 1
} catch {
  Scrie "`nUPDATE-UL S-A OPRIT: $_" 'Red'
  if ($vechi) { Scrie "  Versiunea de dinainte: $vechi (git -C `"$cod`" reset --hard $vechi)" 'Yellow' }
  exit 1
} finally {
  Stop-Transcript | Out-Null
}
