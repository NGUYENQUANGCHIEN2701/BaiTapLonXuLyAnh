param(
    [string]$TaskName = 'OMR-Exam',
    [ValidateSet('127.0.0.1', '0.0.0.0')]
    [string]$BindAddress = '0.0.0.0',
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$DataDir
)

$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$windowsPrincipal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $windowsPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator to register the startup task.'
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $DataDir) { $DataDir = Join-Path $repoRoot 'data' }
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
if (-not (Test-Path -LiteralPath (Join-Path $DataDir 'app.db'))) {
    throw 'Run start.ps1 interactively and verify login first; then stop it before installing the task.'
}
if (Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction SilentlyContinue) {
    throw "Task '$TaskName' already exists. Inspect it before changing or removing it."
}
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Stop the foreground server, or choose another port."
}
$startScript = Join-Path $PSScriptRoot 'start.ps1'
$taskArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -NonInteractive -BindAddress {1} -Port {2} -DataDir "{3}"' -f $startScript, $BindAddress, $Port, $DataDir
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powershellExe -Argument $taskArguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U keeps the task independent of the RDP session, without storing a login password.
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -TaskPath '\' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'OMR Exam: FastAPI, local SQLite and uploaded images' | Out-Null
Start-ScheduledTask -TaskName $TaskName -TaskPath '\'
Write-Host "Task '$TaskName' registered and start requested. Verify http://127.0.0.1:$Port/api/health"
Write-Host "Logs: $(Join-Path $DataDir 'logs')"
