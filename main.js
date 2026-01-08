const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let win;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
const createWindow = () => {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'build', 'bill_sphere.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('src/index.html');
    win.setMenuBarVisibility(false); // Optional: hides the default menu bar
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        if (win) win.webContents.send('update_available');
    });

    autoUpdater.on('update-downloaded', () => {
        if (win) win.webContents.send('update_downloaded');
    });

    ipcMain.on('download_update', () => {
        autoUpdater.downloadUpdate();
    });

    ipcMain.on('install_update', () => {
        autoUpdater.quitAndInstall();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});