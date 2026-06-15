const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const localDb = require('./localDb.cjs')

const isDev = !app.isPackaged

function registerDbHandlers() {
  ipcMain.handle('db:get-raw-rows', () => localDb.getRawRows())
  ipcMain.handle('db:add-sample-row', () => localDb.addSampleRow())
  ipcMain.handle('db:run-validation', () => localDb.runValidation())
  ipcMain.handle('db:save-sql-snapshot', () => localDb.saveSqlSnapshot())
  ipcMain.handle('db:get-validation-issues', () => localDb.getValidationIssues())
  ipcMain.handle('db:get-closing-queue', () => localDb.getClosingQueue())
  ipcMain.handle('db:get-upload-templates', () => localDb.getUploadTemplates())
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:4358')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  registerDbHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  localDb.closePool()
})
