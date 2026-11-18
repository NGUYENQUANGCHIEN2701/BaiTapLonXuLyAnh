param(
    [string]$PythonExecutable = 'python'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pythonCommand = Get-Command $PythonExecutable -CommandType Application -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    throw 'Python not found. Install Python 3.12, or pass -PythonExecutable with the full path to python.exe.'
}
$npmCommand = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    throw 'npm.cmd not found. Install Node.js LTS and reopen PowerShell.'
}

Push-Location $repoRoot
try {
    $venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        & $pythonCommand.Source -m venv (Join-Path $repoRoot '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python virtual environment.' }
    }
    & $venvPython -m pip install -r (Join-Path $repoRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
    & $venvPython -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Python dependencies are inconsistent.' }
    & $venvPython -c 'from omr.sheet_pdf import _register_fonts; _register_fonts()'
    if ($LASTEXITCODE -ne 0) { throw 'PDF fonts are missing. See docs/DEPLOY_WINDOWS_VPS.md.' }
    Write-Host 'PDF font OK'

    Push-Location (Join-Path $repoRoot 'frontend')
    try {
        & $npmCommand.Source ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally {
        Pop-Location
    }
    Write-Host 'Ready. Run: .\deploy\windows\start.ps1'
} finally {
    Pop-Location
}
