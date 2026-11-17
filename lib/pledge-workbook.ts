import * as XLSX from '@e965/xlsx'
import JSZip from 'jszip'
import type { CampaignPledge } from '@/src/types'

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Match the provided response workbook's B Nazanin typography and purple/lavender palette.
const workbookStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="0"/>
  <fonts count="5">
    <font><sz val="12"/><color rgb="FF2D1B3D"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="FF4A148C"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF6A1B9A"/><name val="B Nazanin"/><family val="2"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="B Nazanin"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4A148C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1C4E9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF176"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3E5F5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF6A1B9A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE1BEE7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD1C4E9"/></left><right style="thin"><color rgb="FFD1C4E9"/></right><top style="thin"><color rgb="FFD1C4E9"/></top><bottom style="thin"><color rgb="FFD1C4E9"/></bottom><diagonal/></border>
    <border><left/><right/><top/><bottom style="medium"><color rgb="FF6A1B9A"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`

function asText(value: unknown): string {
  return value == null ? '—' : String(value)
}

function applyRtlAndStyles(sheetXml: string): string {
  let xml = sheetXml
  const view = xml.match(/<sheetView\b([^>]*)\/?\s*>/)
  if (view) {
    const attributes = view[1]
      .replace(/\/\s*$/, '')
      .replace(/\s+rightToLeft="[^"]*"/g, '')
      .replace(/\s+showGridLines="[^"]*"/g, '')
    xml = xml.replace(view[0], `<sheetView${attributes} rightToLeft="1" showGridLines="0"/>`)
  } else {
    xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"/></sheetViews>')
  }

  // Keep the header visible while scrolling through the register, like the supplied workbook.
  xml = xml.replace(/<sheetViews>([\s\S]*?)<\/sheetViews>/, (_whole, inner: string) => {
    const viewTag = inner.match(/<sheetView\b[^>]*\/>/)?.[0]
    if (!viewTag) return `<sheetViews>${inner}</sheetViews>`
    const frozenView = viewTag.replace('/>', '><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView>')
    return `<sheetViews>${inner.replace(viewTag, frozenView)}</sheetViews>`
  })

  return xml.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g, (_whole, attributes: string, column: string, rowValue: string) => {
    const row = Number(rowValue)
    let style = 0
    if (row === 1) style = 1
    else if (row === 2) style = column <= 'D' ? 2 : 3
    else if (row === 3) style = 4
    else if (row === 5) style = 5
    else if (row >= 6) {
      const evenRow = row % 2 === 0
      style = column === 'A' ? (evenRow ? 8 : 9) : (evenRow ? 6 : 7)
    }
    const cleanAttributes = attributes.replace(/\s+s="\d+"/g, '')
    return `<c${cleanAttributes} s="${style}">`
  })
}

export async function createPledgeWorkbook(pledges: CampaignPledge[]): Promise<Blob> {
  const createdAt = new Date().toLocaleDateString('fa-IR')
  const dataRows = pledges.map((row, index) => {
    const parsedDate = new Date(row.joinedAt)
    const joinedAt = Number.isNaN(parsedDate.getTime()) ? asText(row.joinedAt) : parsedDate.toLocaleString('fa-IR')
    return [
      (index + 1).toLocaleString('fa-IR'),
      asText(row.fullName),
      asText(row.personnelCode),
      asText(row.province),
      asText(row.grade),
      asText(row.district),
      asText(row.phone),
      asText(row.school),
      joinedAt,
    ]
  })
  const rows = [
    ['گزارش رسمی عهدنامه هم‌آموزی', '', '', '', '', '', '', '', ''],
    ['گزارش محرمانه دبیرخانه', '', '', '', `تعداد ثبت‌نام: ${pledges.length.toLocaleString('fa-IR')}  |  تاریخ تهیه: ${createdAt}`, '', '', '', ''],
    ['این گزارش شامل اطلاعات شخصی ثبت‌نام‌کنندگان است؛ از ارسال عمومی آن خودداری کنید.', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['ردیف', 'نام و نام خانوادگی', 'کد پرسنلی / کد ملی', 'استان / واحد', 'مقطع', 'ناحیه / منطقه', 'شماره همراه', 'مدرسه', 'تاریخ ثبت'],
    ...dataRows,
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ]
  sheet['!cols'] = [
    { wch: 10 }, { wch: 26 }, { wch: 18 }, { wch: 22 }, { wch: 24 },
    { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 25 },
  ]
  sheet['!rows'] = [
    { hpt: 34 }, { hpt: 24 }, { hpt: 22 }, { hpt: 8 }, { hpt: 30 },
    ...dataRows.map(() => ({ hpt: 26 })),
  ]
  sheet['!autofilter'] = { ref: `A5:I${Math.max(rows.length, 5)}` }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'عهدنامه')
  const archive = await JSZip.loadAsync(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }))
  const worksheetFile = archive.file('xl/worksheets/sheet1.xml')
  if (!worksheetFile) throw new Error('ساخت برگه Excel ناموفق بود.')
  archive.file('xl/worksheets/sheet1.xml', applyRtlAndStyles(await worksheetFile.async('string')))
  archive.file('xl/styles.xml', workbookStyles)
  return archive.generateAsync({
    type: 'blob',
    mimeType: EXCEL_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
