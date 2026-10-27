const { app, BrowserWindow, ipcMain, screen, clipboard, shell, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const { exec, execFile, execSync } = require('child_process');
const loudness = require('loudness');

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const WINDOW_WIDTH = 560;
  const WINDOW_HEIGHT = 580;
  const x = Math.round((screenWidth - WINDOW_WIDTH) / 2);
  const y = 0; // Anchored to top bezel

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Start with ignoring mouse events on transparent regions
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Register Global Hotkey (Ctrl+Space to summon Hitodama / Dictation)
  try {
    globalShortcut.register('CommandOrControl+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('trigger-dictation-hotkey');
      }
    });
  } catch (err) {
    console.warn('Could not register shortcut:', err);
  }
}

// 1. Mouse Hit-Testing & Pass-Through
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

// 2. App Lifecycle
ipcMain.on('window-close', () => {
  app.quit();
});

// 3. Native Windows Audio (Loudness)
ipcMain.handle('get-volume', async () => {
  try {
    return await loudness.getVolume();
  } catch {
    return 70;
  }
});

ipcMain.handle('set-volume', async (event, val) => {
  try {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    await loudness.setVolume(clamped);
    return clamped;
  } catch (err) {
    console.error('Failed to set volume:', err);
    return null;
  }
});

ipcMain.handle('get-muted', async () => {
  try {
    return await loudness.getMuted();
  } catch {
    return false;
  }
});

ipcMain.handle('toggle-mute', async () => {
  try {
    const cur = await loudness.getMuted();
    await loudness.setMuted(!cur);
    return !cur;
  } catch (err) {
    console.error('Failed to toggle mute:', err);
    return false;
  }
});

// 4. Native Windows Dark Mode
ipcMain.handle('get-dark-mode', async () => {
  try {
    const out = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
      { encoding: 'utf8' }
    );
    // 0x0 is Dark mode, 0x1 is Light mode
    return out.includes('0x0');
  } catch {
    return true;
  }
});

ipcMain.handle('toggle-dark-mode', async (event, makeDark) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'src', 'setTheme.ps1');
    const darkParam = makeDark ? 1 : 0;
    execFile('powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Dark', darkParam.toString()], (err) => {
      if (err) console.error('Error toggling dark mode:', err);
      resolve(!err);
    });
  });
});

// 5. Native Windows Wi-Fi Information
ipcMain.handle('get-wifi-info', async () => {
  return new Promise((resolve) => {
    exec('netsh wlan show interfaces', (err, stdout) => {
      if (err || !stdout) {
        return resolve({ ssid: 'Offline', signal: '0%', connected: false });
      }
      const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      const signalMatch = stdout.match(/^\s*Signal\s*:\s*(.+)$/m);
      const stateMatch = stdout.match(/^\s*State\s*:\s*(.+)$/m);

      const connected = stateMatch ? stateMatch[1].trim().toLowerCase() === 'connected' : false;
      const ssid = ssidMatch ? ssidMatch[1].trim() : (connected ? 'Wi-Fi' : 'Disconnected');
      const signal = signalMatch ? signalMatch[1].trim() : (connected ? '100%' : '0%');

      resolve({ ssid, signal, connected });
    });
  });
});

// 6. Open Windows Settings / External URI
ipcMain.handle('open-url', async (event, url) => {
  return shell.openExternal(url);
});

// 7. Live System Hardware Stats
let prevCpu = null;
ipcMain.handle('get-hardware-stats', async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = Math.round((usedMem / totalMem) * 100);
  const appMem = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));

  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  let cpuPct = 1.8;
  if (prevCpu) {
    const idleDiff = totalIdle - prevCpu.idle;
    const totalDiff = totalTick - prevCpu.total;
    if (totalDiff > 0) {
      cpuPct = Math.max(0.2, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
    }
  }
  prevCpu = { idle: totalIdle, total: totalTick };

  return {
    cpuPct: `${cpuPct}%`,
    ramPct: `${memPct}%`,
    appRam: `${appMem} MB`,
    freeRam: `${(freeMem / (1024 * 1024 * 1024)).toFixed(1)} GB free`
  };
});

// 8. Set Windows Desktop Wallpaper (Uses custom generated Arena image)
ipcMain.handle('set-wallpaper', async (event, imageFileName) => {
  const targetImage = path.join(__dirname, 'src', 'assets', imageFileName || 'wallpaper-lofi.png');
  const scriptPath = path.join(__dirname, 'src', 'setWallpaper.ps1');

  return new Promise((resolve) => {
    execFile('powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-ImagePath', targetImage], (err) => {
      if (err) console.error('Wallpaper set error:', err);
      resolve(!err);
    });
  });
});

// 9. Send Text directly into cursor (Active App)
ipcMain.handle('paste-text-at-cursor', async (event, text) => {
  if (!text) return false;
  clipboard.writeText(text);

  // Send Ctrl+V after slight delay so focus restores to active background app
  setTimeout(() => {
    exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"', (err) => {
      if (err) console.error('Paste error:', err);
    });
  }, 120);

  return true;
});

// 10. Universal AI Chat Completion (Ollama / Groq / OpenRouter / Gemini)
ipcMain.handle('ai-completion', async (event, { prompt, config }) => {
  const baseURL = (config?.baseURL || 'http://localhost:11434/v1').replace(/\/+$/, '');
  const apiKey = config?.apiKey || '';
  const model = config?.model || 'llama3.2';

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are Hitodama, an ambient intelligent companion. Keep your answer ultra-concise, helpful, and under 2 sentences.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'No response returned.';
    return { success: true, text: reply.trim() };
  } catch (err) {
    // If local Ollama/LM Studio is not currently running, provide a helpful fallback answer
    return {
      success: false,
      error: `Could not reach AI at ${baseURL} (${err.message}). Is Ollama or your LLM server running?`
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
