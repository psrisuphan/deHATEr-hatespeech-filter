#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Determine project directories relative to this script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerDir = Join-Path $ScriptDir 'deHATEr'
$VenvDir = Join-Path $ServerDir '.venv'

if (-not (Test-Path -Path $ServerDir -PathType Container)) {
    Write-Error 'deHATEr directory not found next to this script.'
    exit 1
}

if (-not $env:VIRTUAL_ENV) {
    $ActivateScript = Join-Path $VenvDir 'Scripts\Activate.ps1'
    if (Test-Path -Path $ActivateScript -PathType Leaf) {
        . $ActivateScript
    }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error 'python not found in PATH.'
    exit 1
}

Push-Location $ServerDir
try {
    $hostValue = if ($env:HOST) { $env:HOST } else { '127.0.0.1' }
    $portValue = if ($env:PORT) { $env:PORT } else { '8000' }

    $arguments = @('-m', 'uvicorn', 'api_server:app', '--host', $hostValue, '--port', $portValue)
    if ($env:UVICORN_RELOAD -eq '1') {
        $arguments += '--reload'
    }

    & python @arguments
} finally {
    Pop-Location
}
