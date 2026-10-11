/**
 * 日期时间工具
 *
 * 注意：后端 LocalDateTime 经 Jackson 序列化后是 **数组** 形式，例如
 *   [2026, 10, 11, 16, 31, 51]
 * 而不是字符串。这里统一兼容 数组 / ISO字符串 / 时间戳 三种输入。
 */

/** 把任意后端时间值解析为 Date，解析失败返回 null */
export function parseDateValue(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = value
    return new Date(year, month - 1, day, hour, minute, second)
  }
  if (typeof value === 'number') {
    return new Date(value)
  }
  if (typeof value === 'string') {
    // 兼容 "yyyy-MM-dd HH:mm:ss"（Safari 不认空格分隔，需换成 /）
    const normalized = value.includes('T') ? value : value.replace(/-/g, '/')
    return new Date(normalized)
  }
  return null
}

/** 格式化为 YYYY-MM-DD HH:mm，无效时间返回 '-' */
export function formatDateTime(value) {
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 格式化为 YYYY-MM-DD，无效时间返回 '-' */
export function formatDate(value) {
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期 */
export function formatRelativeTime(value) {
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 7 * 86400 * 1000) return `${Math.floor(diff / 86400000)} 天前`
  return formatDate(value)
}
