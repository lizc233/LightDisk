/**
 * 通用格式化工具
 */

/** 字节数 → 人类可读体积（B / KB / MB / GB / TB） */
export function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let size = bytes
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const digits = index === 0 ? 0 : size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[index]}`
}

/** 取小写扩展名（不含点），无扩展名返回空串 */
export function fileExt(name) {
  if (!name || typeof name !== 'string') return ''
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

/** 秒数 → mm:ss（超过 1 小时显示 h:mm:ss），用于播放器时间轴 */
export function formatDuration(seconds) {
  const total = Math.floor(Number(seconds) || 0)
  if (!Number.isFinite(total) || total <= 0) return '00:00'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
