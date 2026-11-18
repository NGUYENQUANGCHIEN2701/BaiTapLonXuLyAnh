param(
    [ValidateSet('127.0.0.1', '0.0.0.0')]
    [string]$BindAddress = '0.0.0.0',
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$DataDir,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) { throw 'Run deploy/windows/prepare.ps1 first.' }
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'frontend\dist\index.html'))) {
    throw 'Frontend build missing. Run deploy/windows/prepare.ps1 first.'
}
if (-not $DataDir) { $DataDir = Join-Path $repoRoot 'data' }
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
$logsDir = Join-Path $DataDir 'logs'
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

# Isolate this server from database overrides inherited from another project.
$envNames = @('OMR_DATA_DIR', 'OMR_DATABASE_URL', 'OMR_ADMIN_PASSWORD', 'PYTHONUTF8', 'PYTHONUNBUFFERED')
$previousEnv = @{}
foreach ($envName in $envNames) {
    $previousEnv[$envName] = [Environment]::GetEnvironmentVariable($envName, 'Process')
}
$transcribing = $false
Push-Location $repoRoot
try {
    $env:OMR_DATA_DIR = $DataDir
    Remove-Item Env:OMR_DATABASE_URL -ErrorAction SilentlyContinue
    $env:PYTHONUTF8 = '1'
    $env:PYTHONUNBUFFERED = '1'
    if (-not (Test-Path -LiteralPath (Join-Path $DataDir 'app.db')) -and -not $env:OMR_ADMIN_PASSWORD) {
        if ($NonInteractive) { throw 'Initialize the database by running start.ps1 interactively first.' }
        $adminSecret = Read-Host 'New admin password (at least 6 characters)' -AsSecureString
        $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
        try {
            $env:OMR_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr)
        }
        if ($env:OMR_ADMIN_PASSWORD.Length -lt 6) { throw 'Admin password must have at least 6 characters.' }
    }
    $logPath = Join-Path $logsDir ("server_{0}_{1}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'), $PID)
    Start-Transcript -Path $logPath | Out-Null
    $transcribing = $true
    Write-Host "Data: $DataDir"
    Write-Host "Local health: http://127.0.0.1:$Port/api/health"
    & $venvPython -m uvicorn app.main:app --host $BindAddress --port $Port --workers 1 --proxy-headers --forwarded-allow-ips 127.0.0.1
    if ($LASTEXITCODE -ne 0) { throw "Server exited with code $LASTEXITCODE. See $logPath" }
} finally {
    if ($transcribing) { Stop-Transcript | Out-Null }
    foreach ($envName in $envNames) {
        [Environment]::SetEnvironmentVariable($envName, $previousEnv[$envName], 'Process')
    }
    Pop-Location
}
