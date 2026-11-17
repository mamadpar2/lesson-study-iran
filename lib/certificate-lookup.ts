/** Match Persian/Arabic letter variants and spacing without merging distinct provinces. */
export function normalizeCertificateProvince(value: unknown): string {
  return String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^استان\s+/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, '')
}
