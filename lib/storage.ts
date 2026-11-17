import * as React from 'react'

export function useStoredList<T>(key: string): [T[], React.Dispatch<React.SetStateAction<T[]>>, boolean] {
  const [failed, setFailed] = React.useState(false)
  const [value, setValue] = React.useState<T[]>(() => {
    try {
      const item: unknown = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(item) ? item : []
    } catch {
      return []
    }
  })
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [key, value])
  return [value, setValue, failed]
}

export function downloadFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
