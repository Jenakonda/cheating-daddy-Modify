const path = require('path');
const { spawn } = require('child_process');

const IDE_ENV_VARS = ['VSCODE_PID', 'TERM_PROGRAM', 'CI', 'JETBRAINS_IDE'];

function isIdeEnvironment(env = process.env) {
    if (!env || typeof env !== 'object') {
        return false;
    }
    if (env.KEEP_CONSOLE === '1') {
        return true;
    }
    return IDE_ENV_VARS.some(key => Boolean(env[key]));
}

function buildElectronLaunchOptions(projectRoot, env = process.env) {
    const cleanEnv = { ...(env || {}) };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;

    return {
        cwd: projectRoot,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: cleanEnv,
    };
}

function scheduleStandaloneConsoleClose(launcherPid = process.pid) {
    if (process.platform !== 'win32') {
        return;
    }

    const psScript = `
Start-Sleep -Milliseconds 350
$procs = @{}
Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ }
$cur = ${Number(launcherPid)}
$outerShell = $null
$visited = @{}
while ($procs.ContainsKey($cur) -and -not $visited.ContainsKey($cur)) {
    $visited[$cur] = $true
    $p = $procs[$cur]
    $name = [string]$p.Name
    if ($name -match '^(code|antigravity|cursor|devenv|idea64|webstorm64|windsurf)\\.exe$') {
        exit 0
    }
    if ($name -match '^(cmd|powershell|pwsh)\\.exe$') {
        $outerShell = $cur
    }
    $cur = [int]$p.ParentProcessId
}
if ($outerShell) {
    Stop-Process -Id $outerShell -Force -ErrorAction SilentlyContinue
}
`.trim();

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const killer = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    killer.unref();
}

function launchHidden() {
    const projectRoot = path.resolve(__dirname, '..');
    const electronPath = require('electron');
    const child = spawn(electronPath, ['.'], buildElectronLaunchOptions(projectRoot, process.env));
    child.unref();

    const keepConsole = process.argv.includes('--keep-console') || isIdeEnvironment(process.env);
    if (!keepConsole && process.platform === 'win32') {
        scheduleStandaloneConsoleClose(process.pid);
    }
}

if (require.main === module) {
    launchHidden();
}

module.exports = {
    isIdeEnvironment,
    buildElectronLaunchOptions,
};
