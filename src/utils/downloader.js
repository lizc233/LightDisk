/**
 * 带进度的下载器。
 *
 * 为什么不用 `<a download>` / `window.open`？
 * 那种方式把传输完全交给浏览器，页面上既拿不到进度、也无法暂停/取消，
 * 而且大文件在浏览器下载管理器里是「黑盒」。这里改用 fetch + ReadableStream，
 * 自己读字节流 → 自己写盘，于是进度、速度、取消都变得可控。
 *
 * 保存策略：
 *  - 支持 File System Access API（Chromium）→ 边下边写盘，内存恒定，可下超大文件
 *  - 否则回退到 Blob 一次性保存
 */

const abortError = () => {
  const e = new Error('已取消')
  e.name = 'AbortError'
  return e
}

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const supportsFileSystemAccess = () => typeof window !== 'undefined' && !!window.showSaveFilePicker

/**
 * 让用户提前选好保存位置（必须在用户手势里同步调用，所以放在下载开始前）。
 * 用户取消选择时返回 null。
 */
export async function pickSaveHandle(filename) {
  if (!supportsFileSystemAccess()) return null
  try {
    return await window.showSaveFilePicker({ suggestedName: filename })
  } catch (e) {
    if (e && e.name === 'AbortError') return null
    return null
  }
}

/**
 * 执行下载。
 *
 * @param {object} options
 * @param {string} options.url 完整请求地址（相对 /api 前缀即可）
 * @param {string} [options.method] 默认 GET
 * @param {any}    [options.body] POST 时用
 * @param {object} [options.headers]
 * @param {string} options.filename 保存文件名
 * @param {number} [options.total] 已知的文件大小（服务端未回 Content-Length 时用）
 * @param {FileSystemFileHandle} [options.handle] 预先选好的保存句柄
 * @param {(loaded:number,total:number)=>void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 */
export async function downloadWithProgress(options) {
  const {
    url,
    method = 'GET',
    body = null,
    headers = {},
    filename = 'download',
    total: knownTotal = 0,
    handle = null,
    onProgress,
    signal
  } = options

  const response = await fetch(url, {
    method,
    headers,
    body,
    signal
  })

  // 后端流式接口出错时会返回 JSON（业务错误），这里把它翻译成友好提示
  const contentType = response.headers.get('Content-Type') || ''
  if (!response.ok || contentType.includes('application/json')) {
    let message = `下载失败（HTTP ${response.status}）`
    try {
      const text = await response.text()
      const parsed = JSON.parse(text)
      if (parsed && parsed.msg) message = parsed.msg
    } catch (e) { /* 非 JSON 响应，沿用默认文案 */ }
    throw new Error(message)
  }

  const total = Number(response.headers.get('Content-Length')) || knownTotal || 0

  // ---------- 流式边下边写盘 ----------
  if (handle && response.body && typeof handle.createWritable === 'function') {
    const writable = await handle.createWritable()
    const reader = response.body.getReader()
    let loaded = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        await writable.write(value)
        loaded += value.length
        if (onProgress) onProgress(loaded, total)
      }
      await writable.close()
      return { loaded, total }
    } catch (e) {
      try { await writable.abort() } catch (ignore) { /* 忽略 */ }
      throw e
    }
  }

  // ---------- 回退：整体读入 Blob ----------
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const chunks = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      if (onProgress) onProgress(loaded, total)
    }
    const blob = new Blob(chunks, { type: contentType || 'application/octet-stream' })
    saveBlob(blob, filename)
    return { loaded, total: total || loaded }
  }

  // 极端兜底：环境不支持流式读取
  const blob = await response.blob()
  if (onProgress) onProgress(blob.size, blob.size)
  saveBlob(blob, filename)
  return { loaded: blob.size, total: blob.size }
}

export { abortError }
