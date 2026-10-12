/**
 * 极简 CSV 解析（RFC 4180 风格，零依赖）
 * - 支持双引号包裹的字段，字段内可含逗号 / 换行 / 转义双引号("")
 * - 兼容 CRLF、LF、以及 UTF-8 BOM
 * 返回 { headers: string[], rows: string[][] }
 */
export function parseCsv(text, options = {}) {
  const { delimiter = ',', maxRows = 2000 } = options
  const result = { headers: [], rows: [], truncated: false, totalRows: 0 }
  if (!text) return result

  let content = text
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1) // 去 BOM

  const records = []
  let field = ''
  let record = []
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      record.push(field)
      field = ''
    } else if (ch === '\n') {
      record.push(field)
      records.push(record)
      field = ''
      record = []
    } else if (ch === '\r') {
      // 交给 \n 处理；单独的 \r 也当行结束
      if (content[i + 1] !== '\n') {
        record.push(field)
        records.push(record)
        field = ''
        record = []
      }
    } else {
      field += ch
    }
  }
  // 收尾
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  // 丢掉完全空白的尾行
  while (records.length && records[records.length - 1].every((c) => c.trim() === '')) {
    records.pop()
  }

  if (!records.length) return result

  result.headers = records[0].map((h, idx) => (h && h.trim() ? h.trim() : `列${idx + 1}`))
  const body = records.slice(1)
  result.totalRows = body.length
  if (body.length > maxRows) {
    result.truncated = true
    result.rows = body.slice(0, maxRows)
  } else {
    result.rows = body
  }
  // 补齐列数不足的行（避免表格错位）
  const width = result.headers.length
  result.rows = result.rows.map((r) => {
    if (r.length === width) return r
    const copy = r.slice(0, width)
    while (copy.length < width) copy.push('')
    return copy
  })
  return result
}
