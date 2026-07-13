# dev.ps1 — Full dev environment startup script
# Run from the project root: .\dev.ps1
# Sets ADB reverse (permanent port forwarding), starts Phoenix + Expo Android.

Set-Location $PSScriptRoot

# ── 1. ADB Reverse ──────────────────────────────────────────────────────────
Write-Host "`n[1/3] Setting up ADB port forwarding..." -ForegroundColor Cyan

node apps/mobile/scripts/adb-reverse-all.js 2>&1

# Background job re-applies adb reverse every 15s (handles USB reconnects)
$adbWatcher = Start-Job -ScriptBlock {
    while ($true) {
        Start-Sleep -Seconds 15
        node "$using:PSScriptRoot\apps\mobile\scripts\adb-reverse-all.js" | Out-Null
    }
}
Write-Host "  ✓ ADB reverse watcher started (re-applies every 15s on reconnect)" -ForegroundColor Green

# ── 2. Phoenix Server ────────────────────────────────────────────────────────
Write-Host "`n[2/3] Starting Phoenix server (Elixir)..." -ForegroundColor Cyan
$env:Path = "C:\Program Files\Elixir\bin;C:\Program Files\Erlang OTP\bin;" + $env:Path

$phoenix = Start-Process -FilePath "powershell" `
    -ArgumentList "-NoExit -Command `"Set-Location '$PSScriptRoot\apps\api'; `$env:Path = 'C:\Program Files\Elixir\bin;C:\Program Files\Erlang OTP\bin;' + `$env:Path; mix phx.server`"" `
    -PassThru
Write-Host "  ✓ Phoenix server launched (PID: $($phoenix.Id))" -ForegroundColor Green

Start-Sleep -Seconds 3

# ── 3. Expo Android ─────────────────────────────────────────────────────────
Write-Host "`n[3/3] Starting Expo for Android..." -ForegroundColor Cyan
$expo = Start-Process -FilePath "powershell" `
    -ArgumentList "-NoExit -Command `"Set-Location '$PSScriptRoot\apps\mobile'; npx expo run:android`"" `
    -PassThru
Write-Host "  ✓ Expo launched (PID: $($expo.Id))" -ForegroundColor Green

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host " Dev environment running:" -ForegroundColor White
Write-Host "   Phoenix  → http://localhost:4000" -ForegroundColor Green
Write-Host "   WS       → ws://localhost:4000/socket/websocket" -ForegroundColor Green
Write-Host "   ADB      → device localhost:4000 tunnels to PC :4000" -ForegroundColor Green
Write-Host " Press Ctrl+C to stop the ADB watcher." -ForegroundColor DarkGray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray

# Keep the watcher alive until user exits
try {
    Wait-Job $adbWatcher | Out-Null
} finally {
    Stop-Job $adbWatcher -ErrorAction SilentlyContinue
    Remove-Job $adbWatcher -ErrorAction SilentlyContinue
}
