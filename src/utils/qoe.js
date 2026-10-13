import request from '@/utils/request'

/**
 * 播放质量（QoE）采集与上报。
 *
 * 一次播放会话 = 打开播放器到关闭/切换文件。期间记录：
 * - startupMs      首帧耗时（从调用 load 到 canplay/playing 首次触发）
 * - playDurationMs 累计播放时长
 * - stallCount     卡顿次数（waiting 事件）
 * - stallDurationMs 卡顿总时长
 * - switchCount    清晰度自动切换次数
 * - avgBitrate     每次分片加载的码率估算均值
 *
 * 采用「分段累加」而不是长连接，关闭页面时用 sendBeacon 兜底，避免丢数据。
 */
export class QoeReporter {
  constructor({ fileId, playType = 'direct' }) {
    this.fileId = fileId
    this.playType = playType
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    this.startupMs = 0
    this.firstFrameReported = false
    this.loadStartAt = 0

    this.playDurationMs = 0
    this.playStartedAt = 0
    this.stallCount = 0
    this.stallDurationMs = 0
    this.stallStartedAt = 0
    this.switchCount = 0
    this.bitrateSamples = []
    this.quality = ''

    this.closed = false
  }

  /** 开始加载：记录起点，用于计算首帧耗时 */
  markLoadStart() {
    this.loadStartAt = Date.now()
    this.firstFrameReported = false
  }

  /** 首帧到达 */
  markFirstFrame() {
    if (this.firstFrameReported || !this.loadStartAt) return
    this.firstFrameReported = true
    this.startupMs = Date.now() - this.loadStartAt
  }

  /** 播放开始（计时累计） */
  markPlaying() {
    if (!this.playStartedAt) this.playStartedAt = Date.now()
  }

  /** 暂停/停止播放（结算播放时长） */
  markPaused() {
    if (this.playStartedAt) {
      this.playDurationMs += Date.now() - this.playStartedAt
      this.playStartedAt = 0
    }
  }

  /** 卡顿开始 */
  markStallStart() {
    if (this.stallStartedAt) return
    this.stallCount += 1
    this.stallStartedAt = Date.now()
  }

  /** 卡顿结束 */
  markStallEnd() {
    if (!this.stallStartedAt) return
    this.stallDurationMs += Date.now() - this.stallStartedAt
    this.stallStartedAt = 0
  }

  /** 清晰度切换 */
  markQualitySwitch(quality) {
    if (quality) this.quality = quality
    this.switchCount += 1
  }

  setQuality(quality) {
    if (quality) this.quality = quality
  }

  /** 采样一次分片码率（hls.js LEVEL_LOADED 事件给的是 level 的 bitrate） */
  sampleBitrate(bps) {
    const v = Number(bps)
    if (Number.isFinite(v) && v > 0) {
      this.bitrateSamples.push(v)
      if (this.bitrateSamples.length > 60) this.bitrateSamples.shift()
    }
  }

  buildPayload() {
    // 结算仍在进行的时长
    const pendingPlay = this.playStartedAt ? Date.now() - this.playStartedAt : 0
    const pendingStall = this.stallStartedAt ? Date.now() - this.stallStartedAt : 0
    const avg = this.bitrateSamples.length
      ? Math.round(this.bitrateSamples.reduce((a, b) => a + b, 0) / this.bitrateSamples.length)
      : 0
    return {
      fileId: this.fileId,
      sessionId: this.sessionId,
      playType: this.playType,
      quality: this.quality || 'auto',
      startupMs: this.startupMs,
      playDurationMs: this.playDurationMs + pendingPlay,
      stallCount: this.stallCount,
      stallDurationMs: this.stallDurationMs + pendingStall,
      switchCount: this.switchCount,
      avgBitrate: avg,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    }
  }

  /** 上报并关闭（幂等） */
  report() {
    if (this.closed || !this.fileId) return
    this.closed = true
    const payload = this.buildPayload()
    // 播放时间过短（< 1s）且无首帧数据的会话没有分析价值，丢弃
    if (!payload.startupMs && payload.playDurationMs < 1000) return
    try {
      request.post('/qoe/report', payload, { silent: true }).catch(() => {})
    } catch (e) {
      /* 静默 */
    }
  }

  /** 页面卸载时的同步兜底上报 */
  reportOnUnload() {
    if (this.closed || !this.fileId) return
    this.closed = true
    const payload = this.buildPayload()
    if (!payload.startupMs && payload.playDurationMs < 1000) return
    try {
      const token = localStorage.getItem('token') || ''
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      // sendBeacon 不能带自定义头，token 走查询参数由拦截器解析
      const ok = navigator.sendBeacon &&
        navigator.sendBeacon(`/api/qoe/report?token=${encodeURIComponent(token)}`, blob)
      if (!ok) {
        request.post('/qoe/report', payload, { silent: true }).catch(() => {})
      }
    } catch (e) {
      /* 静默 */
    }
  }
}
