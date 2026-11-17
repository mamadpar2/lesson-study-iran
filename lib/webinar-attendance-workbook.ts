import * as XLSX from '@e965/xlsx'
import JSZip from 'jszip'
import { formatTehranDateTime } from './webinar-registration-time'

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface WebinarAttendanceRow {
  fullName: string
  personnelCode: string
  province: string
  district: string
  createdAt: string | Date
}

// Styles are copied in code from the supplied report's visible palette and B Nazanin typography.
// No participant rows or workbook file from the attachment are bundled with the deployment.
const attendanceStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="0"/>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF2D1B3D"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="FF4A148C"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="B Nazanin"/><family val="2"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4A148C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1C4E9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF176"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF6A1B9A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD1C4E9"/></left><right style="thin"><color rgb="FFD1C4E9"/></right><top style="thin"><color rgb="FFD1C4E9"/></top><bottom style="thin"><color rgb="FFD1C4E9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`

function safeCellText(value: unknown): string {
  const text = String(value ?? '')
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function formatRegisteredAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (!Number.isNaN(date.getTime())) return formatTehranDateTime(date)
  return safeCellText(value)
}

function addRtlFreezePaneAndStyles(sheetXml: string): string {
  let xml = sheetXml.replace(/<sheetView\b([^>]*)\/?\s*>/, (_whole, rawAttributes: string) => {
    const attributes = rawAttributes.replace(/\/\s*$/, '').replace(/\s+rightToLeft="[^"]*"/g, '').replace(/\s+showGridLines="[^"]*"/g, '')
    return `<sheetView${attributes} rightToLeft="1" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView>`
  })
  xml = xml.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g, (_whole, attributes: string, column: string, rowValue: string) => {
    const row = Number(rowValue)
    let style = 0
    if (row === 1) style = 1
    else if (row === 2) style = column === 'A' ? 2 : 3
    else if (row === 3) style = column === 'A' ? 2 : 3
    else if (row === 5) style = 4
    else if (row >= 6) style = row % 2 === 0 ? 7 : 8
    return `<c${attributes.replace(/\s+s="\d+"/g, '')} s="${style}">`
  })
  return xml
}

export async function createWebinarAttendanceWorkbook(title: string, registrations: WebinarAttendanceRow[]): Promise<Blob> {
  const rows: unknown[][] = [
    [`گزارش حضور و غیاب – ${safeCellText(title)}`],
    ['استان‌ها:', 'همه (نمایش همه)'],
    ['تعداد نتایج یافت‌شده:', registrations.length],
    [],
    ['زمان ثبت', 'نام و نام خانوادگی', 'کد پرسنلی', 'استان محل خدمت', 'شهرستان / منطقه'],
    ...registrations.map(row => [
      formatRegisteredAt(row.createdAt),
      safeCellText(row.fullName),
      safeCellText(row.personnelCode),
      safeCellText(row.province),
      safeCellText(row.district),
    ]),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
  sheet['!cols'] = [{ wch: 23 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 26 }]
  sheet['!rows'] = [
    { hpt: 34 }, { hpt: 24 }, { hpt: 20 }, { hpt: 8 }, { hpt: 28 },
    ...registrations.map(() => ({ hpt: 22 })),
  ]
  sheet['!autofilter'] = { ref: `A5:E${Math.max(rows.length, 5)}` }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'گزارش')
  const archive = await JSZip.loadAsync(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }))
  const worksheetFile = archive.file('xl/worksheets/sheet1.xml')
  if (!worksheetFile) throw new Error('ساخت برگه Excel ناموفق بود.')
  archive.file('xl/worksheets/sheet1.xml', addRtlFreezePaneAndStyles(await worksheetFile.async('string')))
  archive.file('xl/styles.xml', attendanceStyles)
  return archive.generateAsync({
    type: 'blob',
    mimeType: EXCEL_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
