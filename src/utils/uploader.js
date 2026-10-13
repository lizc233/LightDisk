import SparkMD5 from 'spark-md5'
import request from '@/utils/request'

/** 超过该大小走分片链路（小于则一次性直传，省去 MD5 与握手开销） */
export const CHUNK_THRESHOLD = 5 * 1024 * 1024
/** 默认分片大小 */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024
/** 默认并发分片数 */
export const DEFAULT_CONCURRENCY = 3
/** 计算 MD5 时的读取块大小 */
const MD5_READ_SIZE = 8 * 1024 * 1024

export const isAbortError = (e) => e && (e.name === 'AbortError' || e.name === 'CanceledError' || e.code === 'ERR_CANCELED')

const abortError = () => {
  const e = new Error('已取消')
  e.name = 'AbortError'
  return e
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 增量计算文件 MD5（spark-md5 + FileReader 分块读取）。
 *
 * 全量 readAsArrayBuffer 一个 3GB 文件会直接 OOM，所以这里按 8MB 切片逐块 append，
 * 内存占用恒定。
 */
export function calcFileMd5(file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const totalChunks = Math.max(1, Math.ceil(file.size / MD5_READ_SIZE))
    let index = 0
    const reader = new FileReader()

    const step = () => {
      if (signal && signal.aborted) {
        reader.abort()
        reject(abortError())
        return
      }
      if (index >= totalChunks) {
        if (onProgress) onProgress(1)
        resolve(spark.end())
        return
      }
      const start = index * MD5_READ_SIZE
      const end = Math.min(start + MD5_READ_SIZE, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    reader.onload = (e) => {
      spark.append(e.target.result)
      index++
      if (onProgress) onProgress(index / totalChunks)
      step()
    }
    reader.onerror = () => reject(new Error('读取文件失败，无法计算校验值'))
    step()
  })
}

/**
 * 由「用户 + 文件名 + 大小 + 最后修改时间」派生出稳定的 uploadId。
 *
 * 同一文件重复上传得到同一个 ID —— 服务端据此认出「这就是上次没传完的那个文件」，
 * 从而直接返回断点。ID 只含 [0-9a-z]，长度约 15，满足后端 [A-Za-z0-9_-]{8,64} 约束。
 */
export function deriveUploadId(file, userId) {
  const raw = `${userId}|${file.name}|${file.size}|${file.lastModified || 0}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  const a = (h1 >>> 0).toString(36).padStart(7, '0')
  const b = (h2 >>> 0).toString(36).padStart(7, '0')
  return `u${a}${b}`
}

/**
 * 小文件一次性直传（沿用原有 /file/upload 接口）。
 * 返回 { promise, abort }。
 */
export function uploadSmallFile(file, { folderId, onProgress } = {}) {
  const controller = new AbortController()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folderId', folderId == null ? 0 : folderId)

  const promise = request.post('/file/upload', formData, {
    timeout: 0,
    signal: controller.signal,
    onUploadProgress: (e) => {
      if (onProgress) onProgress(e.loaded, e.total || file.size)
    }
  }).then(res => ({ fileId: res.data, instant: false }))

  return { promise, abort: () => controller.abort() }
}

/**
 * 分片上传器：init（可秒传）→ 并发传分片 → complete（服务端合并校验）。
 *
 * - init 返回的 received 分片会被直接跳过（断点续传）
 * - pause() 让工作协程停在分片边界，已发出的分片请求照常落盘
 * - cancel() 中断所有进行中的请求并通知服务端清理
 */
export class ChunkUploader {
  constructor(options) {
    this.file = options.file
    this.folderId = options.folderId == null ? 0 : options.folderId
    this.userId = options.userId
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
    this.concurrency = options.concurrency || DEFAULT_CONCURRENCY
    this.onProgress = options.onProgress || (() => {})
    this.onPhase = options.onPhase || (() => {})

    this.uploadId = deriveUploadId(this.file, this.userId)
    this.totalChunks = Math.max(1, Math.ceil(this.file.size / this.chunkSize))

    this.paused = false
    this.canceled = false
    this.controller = new AbortController()

    /** 已完成（含服务端已存在）分片的字节数 */
    this.completedBytes = 0
    /** index -> 该分片已上传字节数（进行中） */
    this.inflight = new Map()
    this.fileId = null
    this.instant = false
  }

  chunkLengthOf(index) {
    const start = index * this.chunkSize
    return Math.min(this.chunkSize, this.file.size - start)
  }

  emitProgress() {
    let sum = this.completedBytes
    this.inflight.forEach(v => { sum += v })
    this.onProgress(Math.min(sum, this.file.size), this.file.size)
  }

  async start() {
    this.canceled = false
    this.paused = false
    this.completedBytes = 0
    this.inflight = new Map()
    this.controller = new AbortController()

    // ---------- 1. 计算整文件 MD5（用于秒传前移 + 服务端完整性校验） ----------
    this.onPhase('hashing')
    const fileMd5 = await calcFileMd5(this.file, (ratio) => {
      this.onPhase('hashing', ratio)
    }, this.controller.signal)

    // ---------- 2. init ----------
    this.onPhase('init')
    const initRes = await request.post('/upload/init', {
      uploadId: this.uploadId,
      fileName: this.file.name,
      fileSize: this.file.size,
      chunkSize: this.chunkSize,
      totalChunks: this.totalChunks,
      folderId: this.folderId,
      fileMd5
    }, { timeout: 0, signal: this.controller.signal })

    const init = initRes.data || {}
    if (init.instant) {
      this.fileId = init.fileId
      this.instant = true
      this.completedBytes = this.file.size
      this.emitProgress()
      return { fileId: this.fileId, instant: true }
    }

    const received = new Set(Array.isArray(init.received) ? init.received : [])
    received.forEach((idx) => { this.completedBytes += this.chunkLengthOf(idx) })
    this.emitProgress()

    // ---------- 3. 并发上传缺失分片 ----------
    const missing = []
    for (let i = 0; i < this.totalChunks; i++) {
      if (!received.has(i)) missing.push(i)
    }

    if (missing.length) {
      this.onPhase('uploading', 0, { pending: missing.length, total: this.totalChunks })
      await this.runPool(missing)
    }
    if (this.canceled) throw abortError()

    // ---------- 4. 合并 ----------
    this.onPhase('merging')
    const completeRes = await request.post('/upload/complete', {
      uploadId: this.uploadId
    }, { timeout: 0, signal: this.controller.signal })

    const done = completeRes.data || {}
    this.fileId = done.fileId
    this.instant = !!done.instant
    this.completedBytes = this.file.size
    this.emitProgress()
    return { fileId: this.fileId, instant: this.instant }
  }

  /** 并发工作池：worker 在分片边界检查暂停 / 取消标志 */
  async runPool(indexes) {
    const queue = indexes.slice()
    const workerCount = Math.max(1, Math.min(this.concurrency, queue.length))
    const workers = []
    for (let w = 0; w < workerCount; w++) {
      workers.push((async () => {
        while (queue.length) {
          if (this.canceled) throw abortError()
          while (this.paused && !this.canceled) {
            await sleep(150)
          }
          if (this.canceled) throw abortError()
          const index = queue.shift()
          if (index == null) break
          await this.uploadOne(index)
        }
      })())
    }
    await Promise.all(workers)
  }

  async uploadOne(index) {
    const start = index * this.chunkSize
    const end = Math.min(start + this.chunkSize, this.file.size)
    const blob = this.file.slice(start, end)
    const formData = new FormData()
    formData.append('uploadId', this.uploadId)
    formData.append('index', String(index))
    formData.append('chunk', blob, `${index}.part`)

    try {
      await request.post('/upload/chunk', formData, {
        timeout: 0,
        signal: this.controller.signal,
        onUploadProgress: (e) => {
          this.inflight.set(index, e.loaded || 0)
          this.emitProgress()
        }
      })
      this.inflight.delete(index)
      this.completedBytes += (end - start)
      this.emitProgress()
    } catch (e) {
      this.inflight.delete(index)
      throw e
    }
  }

  /** 暂停（不中断已发出的分片请求，等待其自然完成） */
  pause() {
    this.paused = true
  }

  /** 继续：从暂停处接着传，已完成的分片不会重传 */
  async resume() {
    if (!this.paused) return
    this.paused = false
    // 上次 start 的 Promise 仍在等待工作池；这里只需解锁
  }

  /** 取消：中断请求并通知服务端清理分片 */
  async cancel() {
    this.canceled = true
    this.paused = false
    try {
      this.controller.abort()
    } catch (e) { /* 忽略 */ }
    try {
      await request.delete(`/upload/${this.uploadId}`, { timeout: 10000, skipAuthRedirect: true })
    } catch (e) {
      /* 清理失败不影响前端状态 */
    }
  }
}

/**
 * 统一上传入口：按文件大小自动选择直传 / 分片。
 * 返回 { promise, control }，control 提供 pause / resume / cancel。
 */
export function uploadFile(file, options = {}) {
  const { folderId, userId, onProgress, onPhase, threshold = CHUNK_THRESHOLD } = options

  if (file.size < threshold) {
    const { promise, abort } = uploadSmallFile(file, { folderId, onProgress })
    return {
      promise,
      control: {
        cancel: () => abort(),
        // 小文件一发即达，不提供暂停
        pause: null,
        resume: null
      }
    }
  }

  const uploader = new ChunkUploader({
    file,
    folderId,
    userId,
    onProgress,
    onPhase
  })
  return {
    promise: uploader.start(),
    uploader,
    control: {
      pause: () => uploader.pause(),
      resume: () => uploader.resume(),
      cancel: () => uploader.cancel()
    }
  }
}
