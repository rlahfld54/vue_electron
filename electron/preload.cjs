const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  db: {
    getRawRows: () => ipcRenderer.invoke('db:get-raw-rows'),
    addSampleRow: () => ipcRenderer.invoke('db:add-sample-row'),
    runValidation: () => ipcRenderer.invoke('db:run-validation'),
    saveSqlSnapshot: () => ipcRenderer.invoke('db:save-sql-snapshot'),
    getValidationIssues: () => ipcRenderer.invoke('db:get-validation-issues'),
    getClosingQueue: () => ipcRenderer.invoke('db:get-closing-queue'),
    getUploadTemplates: () => ipcRenderer.invoke('db:get-upload-templates')
  },
  files: {
    saveFile: (payload) => ipcRenderer.invoke('file:save', payload)
  }
})
