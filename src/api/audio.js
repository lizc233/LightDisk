/**
 * 音频相关接口。
 *
 * 目前后端只有一个「内嵌封面」只读接口：解析 ID3 APIC / FLAC PICTURE / MP4 covr，
 * 按物理文件 MD5 缓存成 jpg。无封面时后端返回 404，前端直接回落到通用音符图标。
 */

const readToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

/**
 * 音频内嵌封面地址。
 * `<img src>` 带不了 Authorization 头，因此 token 走查询参数（拦截器支持）。
 * 返回值不以 http 开头，直接交给 <img src> 使用。
 */
export function buildAudioCoverUrl(fileId, size = 240) {
  if (!fileId) return ''
  return `/api/file/audio-cover/${fileId}?token=${encodeURIComponent(readToken())}&size=${size}`
}
