param([switch]$Build)
$taskAppDirectory = Split-Path -Parent $PSScriptRoot
$taskEnvFile = Join-Path $taskAppDirectory '.env'
$taskPort = 5175
if (Test-Path -LiteralPath $taskEnvFile) {
  $taskPortMatch = [regex]::Match((Get-Content -LiteralPath $taskEnvFile -Raw), '(?m)^PORT\s*=\s*(\d+)\s*$')
  if ($taskPortMatch.Success) { $taskPort = [int]$taskPortMatch.Groups[1].Value }
}
$taskUrl = "http://127.0.0.1:$taskPort"
try {
  $taskConfig = Invoke-RestMethod -Uri "$taskUrl/api/config" -TimeoutSec 2
  if ($taskConfig.storage -eq 'sqlite') { Write-Output "Merit Lens is already running: $taskUrl/#/showcase"; return }
} catch {}
$taskListener = New-Object System.Net.Sockets.TcpClient
try { $taskListener.Connect('127.0.0.1', $taskPort); throw "Port $taskPort is occupied by another service. Choose another PORT in this project's .env." }
catch [System.Net.Sockets.SocketException] {}
finally { $taskListener.Dispose() }
if ($Build -or !(Test-Path -LiteralPath (Join-Path $taskAppDirectory 'dist/index.html'))) {
  Push-Location $taskAppDirectory
  try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'The frontend build did not complete.' } }
  finally { Pop-Location }
}
$taskRunDirectory = Join-Path $taskAppDirectory '.run'
New-Item -ItemType Directory -Path $taskRunDirectory -Force | Out-Null
$taskNodePath = (Get-Command node).Source
$taskPreviousHost = $env:HOST
$taskPreviousPort = $env:PORT
try {
  $env:HOST = '127.0.0.1'
  $env:PORT = [string]$taskPort
  $taskServer = Start-Process -FilePath $taskNodePath -ArgumentList '--env-file-if-exists=.env','server/index.js' -WorkingDirectory $taskAppDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRunDirectory 'server.out.log') -RedirectStandardError (Join-Path $taskRunDirectory 'server.err.log')
  Set-Content -LiteralPath (Join-Path $taskRunDirectory 'server.pid') -Value $taskServer.Id
} finally { $env:HOST = $taskPreviousHost; $env:PORT = $taskPreviousPort }
Write-Output "Starting Merit Lens: $taskUrl/#/showcase"
