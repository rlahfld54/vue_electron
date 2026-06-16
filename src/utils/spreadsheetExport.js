function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    || 'excel-template'
}

function getColumnWidth(column, rows, index) {
  const maxLength = rows.reduce((max, row) => {
    const length = String(row[index] ?? '').length
    return Math.max(max, length)
  }, String(column).length)

  return Math.min(Math.max(maxLength + 2, 12), 30)
}

async function saveWorkbook(workbook, suggestedName) {
  const buffer = await workbook.xlsx.writeBuffer()
  const bytes = new Uint8Array(buffer)

  if (window.electronAPI?.files?.saveFile) {
    const result = await window.electronAPI.files.saveFile({
      fileName: suggestedName,
      bytes: Array.from(bytes),
      filters: [
        { name: 'Excel Workbook', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result?.canceled) {
      const error = new Error('다운로드가 취소되었습니다.')
      error.name = 'AbortError'
      throw error
    }

    return { fileName: suggestedName, saveMode: 'electron-dialog', filePath: result?.filePath }
  }

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = suggestedName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { fileName: suggestedName, saveMode: 'browser-download' }
}

export async function exportRowsToXlsx({
  columns,
  rows,
  title,
  sheetName = 'Data'
}) {
  const displayTitle = title?.trim() || '엑셀_내보내기'
  const suggestedName = `${sanitizeFileName(displayTitle)}.xlsx`
  const ExcelModule = await import('exceljs')
  const ExcelJS = ExcelModule.default ?? ExcelModule
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31))

  workbook.creator = 'Excel Desktop App'
  workbook.created = new Date()
  workbook.modified = new Date()

  worksheet.columns = columns.map((column, index) => ({
    header: column.label,
    key: column.key,
    width: getColumnWidth(column.label, rows.map((row) => columns.map((item) => row[item.key])), index)
  }))
  worksheet.spliceRows(1, 0, [displayTitle])
  worksheet.mergeCells(1, 1, 1, columns.length)
  worksheet.getRow(1).height = 26
  worksheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF064E3B' } }
  worksheet.getCell(1, 1).alignment = { vertical: 'middle' }
  worksheet.addRows(rows)

  worksheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
  worksheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.views = [{ state: 'frozen', ySplit: 2 }]
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length }
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 2) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      }
    })
  })

  return saveWorkbook(workbook, suggestedName)
}

function styleTemplateWorksheet(worksheet, accent = 'FF0F766E') {
  worksheet.getRow(1).height = 28
  worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
  worksheet.getRow(1).alignment = { vertical: 'middle' }

  worksheet.getRow(2).height = 24
  worksheet.getRow(2).font = { color: { argb: 'FF4B5563' } }

  worksheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }
  worksheet.getRow(3).alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.views = [{ state: 'frozen', ySplit: 3 }]
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: worksheet.columnCount }
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      }
    })
  })
}

function addTemplateSheet(workbook, template) {
  const accent = 'FF0F766E'
  const columns = [...template.requiredColumns, ...template.optionalColumns]
  const rows = template.sampleRows || []
  const worksheet = workbook.addWorksheet(template.title.slice(0, 30))

  worksheet.columns = columns.map((column, index) => ({
    header: column,
    key: `col_${index}`,
    width: getColumnWidth(column, rows, index)
  }))
  worksheet.spliceRows(1, 0, [`${template.title} 업로드 양식`])
  worksheet.mergeCells(1, 1, 1, columns.length)
  worksheet.spliceRows(2, 0, [template.description])
  worksheet.mergeCells(2, 1, 2, columns.length)
  worksheet.addRows(rows)
  styleTemplateWorksheet(worksheet, accent)

  template.requiredColumns.forEach((_, index) => {
    worksheet.getCell(3, index + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: accent }
    }
  })

  const guide = workbook.addWorksheet(`${template.title.slice(0, 24)}_작성규칙`)
  guide.columns = [
    { header: '구분', key: 'type', width: 16 },
    { header: '내용', key: 'content', width: 80 }
  ]
  guide.addRows([
    ['양식명', template.title],
    ['사용 메뉴', template.targetMenu],
    ['필수 컬럼', template.requiredColumns.join(', ')],
    ['선택 컬럼', template.optionalColumns.join(', ')],
    ...(template.rules || []).map((rule, index) => [`규칙 ${index + 1}`, rule])
  ])
  guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
  guide.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      }
    })
  })
}

export async function exportUploadTemplateToXlsx(template) {
  const ExcelModule = await import('exceljs')
  const ExcelJS = ExcelModule.default ?? ExcelModule
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'Excel Desktop App'
  workbook.created = new Date()
  workbook.modified = new Date()
  addTemplateSheet(workbook, template)

  return saveWorkbook(workbook, `${sanitizeFileName(template.fileName)}.xlsx`)
}

export async function exportAllUploadTemplatesToXlsx(templates) {
  const ExcelModule = await import('exceljs')
  const ExcelJS = ExcelModule.default ?? ExcelModule
  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'Excel Desktop App'
  workbook.created = new Date()
  workbook.modified = new Date()
  templates.forEach((template) => addTemplateSheet(workbook, template))

  return saveWorkbook(workbook, '엑셀_첨부_표준_양식_전체.xlsx')
}
