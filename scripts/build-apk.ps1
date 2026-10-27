<#
.SYNOPSIS
  Builds a standalone Android APK of YourTime on this computer, inside Docker.

.EXAMPLE
  .\scripts\build-apk.ps1                      # uses this PC's WiFi address
  .\scripts\build-apk.ps1 -ApiUrl http://192.168.1.50:8080
  .\scripts\build-apk.ps1 -Committed           # only what is in the last commit

  The address is only the default: it can be changed inside the app (Servidor).
  Requires Docker Desktop. The first run downloads the Android SDK (several GB).
#>
param(
  [string]$ApiUrl,
  [string]$Abis = 'arm64-v8a',
  # Build exactly what is committed (git HEAD), ignoring uncommitted work in progress.
  [switch]$Committed
)
# Not 'Stop': Windows PowerShell 5.1 would treat Docker's progress output (stderr) as an
# error. Failures are caught through $LASTEXITCODE below.
$ErrorActionPreference = 'Continue'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..')

if (-not $ApiUrl) {
  $ip = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1 -ExpandProperty IPv4Address | Select-Object -ExpandProperty IPAddress
  if (-not $ip) { throw 'No encontre la IP de este PC; pasala con -ApiUrl http://IP:8080' }
  $ApiUrl = "http://${ip}:8080"
}
Write-Host "Servidor por defecto del APK: $ApiUrl"

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker no esta encendido. Abre Docker Desktop y vuelve a intentar.' }

$source = $repo
if ($Committed) {
  $source = Join-Path $env:TEMP 'yourtime-src'
  if (Test-Path $source) { Remove-Item -Recurse -Force $source }
  New-Item -ItemType Directory -Force $source | Out-Null
  cmd /c "git -C `"$repo`" archive HEAD | tar -x -C `"$source`""
  if ($LASTEXITCODE -ne 0) { throw 'No pude exportar el ultimo commit' }
  Write-Host "Compilando el ultimo commit: $(git -C $repo log -1 --format='%h %s')"
}

$dist = Join-Path $repo 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null

Write-Host '==> Preparando la imagen de compilacion (la primera vez tarda)'
docker build -t yourtime-android-build (Join-Path $repo 'infra/android-build')
if ($LASTEXITCODE -ne 0) { throw 'Fallo la imagen de compilacion' }

Write-Host '==> Compilando el APK (20-40 min la primera vez)'
docker run --rm `
  -v "${source}:/src:ro" `
  -v "${dist}:/out" `
  -v yt-gradle:/root/.gradle `
  -v yt-pnpm:/root/.local/share/pnpm `
  -e API_URL=$ApiUrl -e ABIS=$Abis `
  yourtime-android-build `
  bash -c "tr -d '\r' < /src/infra/android-build/build.sh | bash"
if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion del APK' }

Write-Host "Listo: $dist\YourTime.apk"
