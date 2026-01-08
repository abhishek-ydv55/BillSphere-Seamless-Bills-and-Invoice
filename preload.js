const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('electronStore', {
  // Renderer to Main: Get data
  get: (key) => ipcRenderer.invoke('electron-store-get', key),

  // Renderer to Main: Set data
  set: (key, value) => ipcRenderer.invoke('electron-store-set', key, value),

  // Renderer to Main: Delete data
  delete: (key) => ipcRenderer.invoke('electron-store-delete', key),

  // Renderer to Main: Clear all data
  clear: () => ipcRenderer.invoke('electron-store-clear'),

  // Renderer to Main: Trigger update download
  downloadUpdate: () => ipcRenderer.send('download_update'),

  // Renderer to Main: Install update
  installUpdate: () => ipcRenderer.send('install_update'),

  // Renderer to Main: Check for updates manually
  checkForUpdates: () => ipcRenderer.send('check_for_updates'),

  // Main to Renderer: Listen for an event (if needed in the future)
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});