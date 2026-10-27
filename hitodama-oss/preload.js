const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hitodama', {
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  closeApp: () => {
    ipcRenderer.send('window-close');
  },
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (val) => ipcRenderer.invoke('set-volume', val),
  getMuted: () => ipcRenderer.invoke('get-muted'),
  toggleMute: () => ipcRenderer.invoke('toggle-mute'),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  toggleDarkMode: (makeDark) => ipcRenderer.invoke('toggle-dark-mode', makeDark),
  getWifiInfo: () => ipcRenderer.invoke('get-wifi-info'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  getHardwareStats: () => ipcRenderer.invoke('get-hardware-stats'),
  setWallpaper: (imageFileName) => ipcRenderer.invoke('set-wallpaper', imageFileName),
  pasteTextAtCursor: (text) => ipcRenderer.invoke('paste-text-at-cursor', text),
  aiCompletion: (payload) => ipcRenderer.invoke('ai-completion', payload),
  onDictationHotkey: (callback) => {
    ipcRenderer.on('trigger-dictation-hotkey', () => callback());
  }
});
