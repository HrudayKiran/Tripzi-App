# Parallel Maestro Test Runner for NxtVibes
# Run this script in PowerShell to launch tests on both emulators in separate windows.

$maestro = "C:\Users\bhumi\.maestro\bin\maestro.bat"
$maestroDir = "C:\Users\bhumi\Downloads\Tripzi-App\apps\mobile\maestro"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    NxtVibes Parallel Maestro Test Runner" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check connected devices
Write-Host "Checking connected emulators..."
$devices = & $adb devices
if ($devices -match "emulator-5554" -and $devices -match "emulator-5556") {
    Write-Host "✅ Both emulator-5554 (Medium Phone) and emulator-5556 (Pixel 9 Pro) are ONLINE!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Warning: Make sure both emulators are fully booted and show up in 'adb devices'." -ForegroundColor Yellow
    Write-Host "Current devices:"
    Write-Host $devices
}

# Launch test on Medium Phone (emulator-5554)
Write-Host "Launching Email Login Test on emulator-5554 in separate window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Running Email Login Test on Medium Phone...' -ForegroundColor Cyan; & '$maestro' --device emulator-5554 test --env TEST_EMAIL='webbusinesswithkiran@gmail.com' --env TEST_PASSWORD='Chinnureddy@6' '$maestroDir\04_email_login.yaml'"

# Launch test on Pixel 9 Pro (emulator-5556)
Write-Host "Launching Welcome Screen Test on emulator-5556 in separate window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Running Welcome Screen Test on Pixel 9 Pro...' -ForegroundColor Cyan; & '$maestro' --device emulator-5556 test --env TEST_EMAIL='webbusinesswithkiran@gmail.com' --env TEST_PASSWORD='Chinnureddy@6' '$maestroDir\02_welcome_screen.yaml'"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Tests started successfully in separate pop-up windows!" -ForegroundColor Green
Write-Host "You can watch the automated interactions running live on the emulators."
Write-Host "==========================================================" -ForegroundColor Cyan
