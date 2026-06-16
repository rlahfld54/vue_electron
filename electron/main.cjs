const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const localDb = require('./localDb.cjs')

const isDev = !app.isPackaged

function getClosingAttachmentDir() {
  return path.join(app.getPath('documents'), 'ExcelDesktopApp', 'Exports', 'ClosingAttachments')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildClosingPdfHtml(company) {
  const safe = Object.fromEntries(
    Object.entries(company || {}).map(([key, value]) => [key, escapeHtml(value)])
  )

  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: "Malgun Gothic", Arial, sans-serif; color: #111827; margin: 42px; }
          h1 { color: #047857; font-size: 28px; margin: 0 0 8px; }
          .meta { color: #64748b; font-size: 12px; margin-bottom: 28px; }
          .box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 18px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: 120px 1fr 120px 1fr; gap: 8px 16px; }
          .label { color: #64748b; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background: #ecfdf7; color: #047857; }
          .message { white-space: pre-line; border: 1px solid #cbd5e1; padding: 16px; margin-top: 16px; line-height: 1.7; }
        </style>
      </head>
      <body>
        <h1>마감 확인 요청서</h1>
        <div class="meta">Excel Desktop App · ${new Date().toLocaleDateString('ko-KR')}</div>
        <div class="box">
          <div class="grid">
            <div class="label">업체명</div><div>${safe.name}</div>
            <div class="label">담당자</div><div>${safe.owner}</div>
            <div class="label">마감일</div><div>${safe.due}</div>
            <div class="label">마감 금액</div><div>${safe.amount}</div>
            <div class="label">확인 유형</div><div>${safe.type}</div>
            <div class="label">발송 채널</div><div>${safe.channel}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>수신 이메일</th><th>파일명</th><th>상태</th></tr>
          </thead>
          <tbody>
            <tr><td>${safe.email}</td><td>${safe.pdf}</td><td>생성 완료</td></tr>
          </tbody>
        </table>
        <h2>요청 문구</h2>
        <div class="message">${safe.name} 담당자님,
첨부드린 마감장과 PDF 확인본을 검토하신 뒤 금액 이상 여부를 회신 부탁드립니다.

마감일: ${safe.due}
마감 금액: ${safe.amount}
확인 유형: ${safe.type}

감사합니다.</div>
      </body>
    </html>
  `
}

function registerDbHandlers() {
  ipcMain.handle('db:get-raw-rows', () => localDb.getRawRows())
  ipcMain.handle('db:add-sample-row', () => localDb.addSampleRow())
  ipcMain.handle('db:run-validation', () => localDb.runValidation())
  ipcMain.handle('db:save-sql-snapshot', () => localDb.saveSqlSnapshot())
  ipcMain.handle('db:get-validation-issues', () => localDb.getValidationIssues())
  ipcMain.handle('db:get-closing-queue', () => localDb.getClosingQueue())
  ipcMain.handle('db:get-upload-templates', () => localDb.getUploadTemplates())
  ipcMain.handle('file:save', async (_event, { fileName, bytes, filters }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: fileName,
      filters: filters || [
        { name: 'Excel Workbook', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    fs.writeFileSync(result.filePath, Buffer.from(bytes))
    return { canceled: false, filePath: result.filePath }
  })
  ipcMain.handle('file:select-spreadsheet', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const stat = fs.statSync(filePath)

    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      size: stat.size
    }
  })
  ipcMain.handle('file:get-closing-attachment-dir', () => {
    const directory = getClosingAttachmentDir()
    fs.mkdirSync(directory, { recursive: true })
    return directory
  })
  ipcMain.handle('file:open-path', async (_event, targetPath) => {
    if (!targetPath) {
      return { success: false, error: '열 경로가 없습니다.' }
    }

    const error = await shell.openPath(targetPath)
    return { success: !error, error }
  })
  ipcMain.handle('file:show-item-in-folder', (_event, targetPath) => {
    if (!targetPath) {
      return { success: false, error: '표시할 파일 경로가 없습니다.' }
    }

    shell.showItemInFolder(targetPath)
    return { success: true }
  })
  ipcMain.handle('pdf:save-closing-request', async (_event, company) => {
    const result = await dialog.showSaveDialog({
      defaultPath: company?.pdf || '마감확인요청서.pdf',
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true
      }
    })

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildClosingPdfHtml(company))}`)
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      }
    })
    fs.writeFileSync(result.filePath, pdfBuffer)
    pdfWindow.close()

    return { canceled: false, filePath: result.filePath }
  })
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
