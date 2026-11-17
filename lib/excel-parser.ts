import * as XLSX from '@e965/xlsx'

export interface ParsedAttendee {
  id: string
  fullName: string
  province: string
  personnelCode?: string
  district?: string
  certificateFileName?: string
}

// Known Iranian Provinces for high-precision column auto-detection
const KNOWN_PROVINCES = [
  'تهران', 'فارس', 'اصفهان', 'خراسان', 'خراسان رضوی', 'خراسان جنوبی', 'خراسان شمالی',
  'یزد', 'کردستان', 'خوزستان', 'آذربایجان شرقی', 'آذربایجان غربی', 'کرمان', 'مازندران',
  'گیلان', 'سمنان', 'مرکزی', 'همدان', 'لرستان', 'ایلام', 'بوشهر', 'زنجان', 'قم',
  'قزوین', 'گلستان', 'اردبیل', 'کرمانشاه', 'چهارمحال و بختیاری', 'کهگیلویه و بویراحمد',
  'هرمزگان', 'البرز', 'سیستان و بلوچستان'
]

function normalizeFa(str: any): string {
  return String(str || '')
    .replace(/\u064A/g, 'ی')
    .replace(/\u0649/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u200C\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanProvinceName(str: string): string {
  let p = normalizeFa(str)
  p = p.replace(/^استان\s+/, '')
  p = p.replace(/^شهرستان\s+/, '')
  p = p.replace(/\s*\(.*\)\s*/, '')
  return p || 'سراسری'
}

/**
 * Parses an Excel or CSV file containing attendee records into structured attendee objects.
 * Accurately extracts:
 * 1. نام و نام خانوادگی
 * 2. کد پرسنلی
 * 3. استان محل خدمت
 * 4. شهرستان / منطقه
 */
export async function parseAttendanceExcel(
  file: File,
  _webinarTitle: string = 'وبینار تخصصی کشوری',
  _webinarDate: string = '۱۴۰۵'
): Promise<ParsedAttendee[]> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  let targetSheet: any = null
  let rawRows: any[][] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (sheet) {
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })
      if (rows && rows.length > 0) {
        targetSheet = sheet
        rawRows = rows
        break
      }
    }
  }

  if (!targetSheet || rawRows.length === 0) return []

  let headerRowIndex = -1
  let nameColIdx = -1
  let personnelColIdx = -1
  let provinceColIdx = -1
  let districtColIdx = -1

  // Scan first 40 rows for header row
  for (let r = 0; r < Math.min(rawRows.length, 40); r++) {
    const row = rawRows[r]
    if (!Array.isArray(row)) continue

    for (let c = 0; c < row.length; c++) {
      const cellText = normalizeFa(row[c])
      if (
        /نام.*خانوادگی|نام.*و.*نام|نام.*خانودگی|نام.*شخص|نام.*دبیر|نام.*معلم|نام.*شرکت/i.test(cellText)
      ) {
        nameColIdx = c
        headerRowIndex = r
        break
      }
    }

    if (headerRowIndex !== -1) {
      const hRow = rawRows[headerRowIndex]
      for (let c = 0; c < hRow.length; c++) {
        const cellText = normalizeFa(hRow[c])
        if (/کد.*پرسنلی|شماره.*پرسنلی|پرسنلی/i.test(cellText)) {
          personnelColIdx = c
        } else if (/استان.*خدمت|استان.*محل|استان.*اشتغال|استان/i.test(cellText)) {
          provinceColIdx = c
        } else if (/شهرستان.*منطقه|شهرستان|منطقه|ناحیه/i.test(cellText)) {
          districtColIdx = c
        }
      }
      break
    }
  }

  // Fallbacks if province wasn't found in header
  if (headerRowIndex !== -1 && provinceColIdx === -1) {
    const sampleRows = rawRows.slice(headerRowIndex + 1, headerRowIndex + 20)
    for (let c = 0; c < (rawRows[headerRowIndex]?.length || 10); c++) {
      if (c === nameColIdx) continue
      const matchCount = sampleRows.filter((r) => {
        const val = normalizeFa(r[c])
        return KNOWN_PROVINCES.some((kp) => val.includes(kp))
      }).length

      if (matchCount >= 2) {
        provinceColIdx = c
        break
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0
    nameColIdx = 1
    provinceColIdx = 3
    personnelColIdx = 2
    districtColIdx = 4
  }

  if (nameColIdx === -1) nameColIdx = 1
  if (provinceColIdx === -1) provinceColIdx = 3

  const attendees: ParsedAttendee[] = []
  const seenPersons = new Set<string>()

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r]
    if (!Array.isArray(row)) continue

    const rawName = normalizeFa(row[nameColIdx])
    const rawPersonnel = personnelColIdx !== -1 ? normalizeFa(row[personnelColIdx]) : ''
    let rawProvince = cleanProvinceName(row[provinceColIdx])
    const rawDistrict = districtColIdx !== -1 ? normalizeFa(row[districtColIdx]) : ''

    if (!rawName || rawName.length < 2) continue
    if (
      rawName.includes('نام و نام خانوادگی') ||
      rawName.includes('انتخاب استان') ||
      rawName.includes('تعداد نتایج') ||
      rawName.includes('پاسخ های ثبت نام')
    ) {
      continue
    }

    if (/^\d+$/.test(rawName) || /^\d{4}\/\d{2}\/\d{2}/.test(rawName)) continue

    if (!rawProvince || rawProvince === 'استان' || rawProvince.length < 2) {
      rawProvince = 'سراسری'
    }

    const dedupeKey = `${rawName}|${rawProvince}`.toLowerCase()
    if (seenPersons.has(dedupeKey)) continue
    seenPersons.add(dedupeKey)

    attendees.push({
      id: `att-${attendees.length + 1}`,
      fullName: rawName,
      province: rawProvince,
      personnelCode: rawPersonnel || undefined,
      district: rawDistrict || undefined,
      certificateFileName: `گواهی-حضور-${rawName.replace(/\s+/g, '-')}.jpg`,
    })
  }

  return attendees
}
