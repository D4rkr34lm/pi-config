param(
  [string]$InstallDir = (Join-Path $HOME 'bin'),
  [string]$CommandName = 'pi-s',
  [string]$BashPath
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
  throw 'This setup script is intended to run on Windows.'
}

$repoRoot = Split-Path -Parent $PSCommandPath
$startupScript = Join-Path $repoRoot 'pi-s.sh'

if (-not (Test-Path -LiteralPath $startupScript)) {
  throw "Could not find pi-s.sh next to this setup script: $startupScript"
}

if (-not $BashPath) {
  $candidates = @()

  if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles 'Git\bin\bash.exe'
  }

  if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe'
  }

  if ($env:LocalAppData) {
    $candidates += Join-Path $env:LocalAppData 'Programs\Git\bin\bash.exe'
  }

  $BashPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

  if (-not $BashPath) {
    $cmd = Get-Command bash.exe -ErrorAction SilentlyContinue
    if ($cmd) {
      $BashPath = $cmd.Source
    }
  }
}

if (-not $BashPath -or -not (Test-Path -LiteralPath $BashPath)) {
  throw 'Could not find Git Bash. Install Git for Windows or pass -BashPath "C:\Path\To\bash.exe".'
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$cmdPath = Join-Path $InstallDir "$CommandName.cmd"
$cmdContent = @"
@echo off
setlocal
set "PI_S_BASH=$BashPath"
set "PI_S_SCRIPT=$startupScript"
"%PI_S_BASH%" "%PI_S_SCRIPT%" %*
"@

Set-Content -LiteralPath $cmdPath -Value $cmdContent -Encoding ASCII

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathParts = @($userPath -split ';' | Where-Object { $_ })
$alreadyOnPath = $pathParts | Where-Object { $_.TrimEnd('\') -ieq $InstallDir.TrimEnd('\') } | Select-Object -First 1

if (-not $alreadyOnPath) {
  $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
  [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
  $env:Path = "$env:Path;$InstallDir"
  Write-Host "Added to user PATH: $InstallDir"
} else {
  Write-Host "Already on user PATH: $InstallDir"
}

Write-Host "Installed command: $cmdPath"
Write-Host "Open a new terminal, then run: $CommandName"
