import request from '@/utils/request'

/** 视频转码状态 + HLS 播放地址 + VIP 播放权限矩阵 */
export function fetchPlaybackInfo(fileId) {
  return request.get(`/video/${fileId}/playback-info`, { silent: true })
}

/** 手动触发 / 重试转码 */
export function submitTranscode(fileId) {
  return request.post(`/video/${fileId}/transcode`)
}

export function retryTranscode(fileId) {
  return request.post(`/video/${fileId}/transcode/retry`)
}

/** 校验清晰度是否在等级允许范围内（后端权威） */
export function checkQuality(fileId, height) {
  return request.get(`/video/${fileId}/quality/check`, { params: { height }, silent: true })
}

/** 校验倍速是否允许 */
export function checkRate(fileId, rate) {
  return request.get(`/video/${fileId}/rate/check`, { params: { rate }, silent: true })
}

/** 播放开始：登记并发播放流 */
export function acquireStream(sessionId) {
  return request.post('/video/stream/acquire', { sessionId }, { silent: true })
}

/** 播放结束：释放并发播放流 */
export function releaseStream(sessionId) {
  return request.post('/video/stream/release', { sessionId }, { silent: true })
}

/** 管理端：播放质量看板 */
export function fetchQoeDashboard(days = 7) {
  return request.get('/admin/qoe/dashboard', { params: { days } })
}

/** 管理端：转码队列概览 */
export function fetchTranscodeOverview() {
  return request.get('/admin/transcode/overview', { silent: true })
}

/** hls.m3u8 地址（带 token，供 hls.js / video 标签拉取） */
export function buildHlsUrl(fileId) {
  const token = localStorage.getItem('token') || ''
  return `/api/video/${fileId}/hls/master.m3u8?token=${encodeURIComponent(token)}`
}
