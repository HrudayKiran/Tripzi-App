const { execSync } = require('child_process');

try {
    const devicesOutput = execSync('adb devices').toString();
    const lines = devicesOutput.split('\n');
    const devices = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && line.includes('\tdevice')) {
            const deviceId = line.split('\t')[0];
            devices.push(deviceId);
        }
    }

    if (devices.length === 0) {
        console.log('[ADB] No connected devices/emulators found.');
        process.exit(0);
    }

    console.log(`[ADB] Found ${devices.length} connected device(s). Setting up port forwarding...`);

    for (const deviceId of devices) {
        try {
            execSync(`adb -s ${deviceId} reverse tcp:4000 tcp:4000`);
            execSync(`adb -s ${deviceId} reverse tcp:3000 tcp:3000`);
            console.log(`  ✓ Port forwarding set for device: ${deviceId}`);
        } catch (err) {
            console.warn(`  ✗ Failed to set port forwarding for device ${deviceId}:`, err.message);
        }
    }
} catch (error) {
    console.error('[ADB] Error setting up adb reverse:', error.message);
}
