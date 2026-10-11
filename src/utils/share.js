/**
 * 分享码解析工具
 *
 * 用户在顶栏搜索框里经常直接粘贴整条分享链接，而不是只填分享码，例如：
 *   http://localhost:5173/share/MMSQao3H
 *   https://cloudstudio.net/a/xxx/share/MMSQao3H?extractCode=ab12
 *   MMSQao3H
 * 如果原样当分享码用，会请求到 /api/share/public/http://... 导致后端 No mapping 404。
 *
 * extractShareCode 负责把上面任意一种输入统一解析成纯分享码。
 */

// 分享码字符集：字母数字，长度 4~64（后端生成的是 8 位，这里放宽以兼容）
const CODE_PATTERN = /^[A-Za-z0-9]{4,64}$/

/**
 * 从用户输入 / 路由参数 / 完整链接中解析出纯分享码
 * @param {string} raw 原始输入
 * @returns {string} 解析后的分享码；无法解析时返回空字符串
 */
export function extractShareCode(raw) {
  if (!raw) return ''
  let input = String(raw).trim()
  if (!input) return ''

  // 0) 先解 URL 编码：粘贴的链接可能被编码成 http%3A%2F%2F...%2Fshare%2Fxxxx
  if (/%[0-9A-Fa-f]{2}/.test(input)) {
    try {
      input = decodeURIComponent(input)
    } catch (e) {
      /* 不是合法编码，保持原样 */
    }
  }

  // 1) 完整 URL 或带 /share/ 的路径：取 /share/ 之后的第一段
  if (input.includes('/share/')) {
    const after = input.split('/share/')[1] || ''
    input = after.split(/[/?#]/)[0]
  } else if (/^https?:\/\//i.test(input)) {
    // 2) 其他 URL（没有 /share/ 段）：退化为取最后一段路径
    try {
      const u = new URL(input)
      const segs = u.pathname.split('/').filter(Boolean)
      input = segs.length ? segs[segs.length - 1] : ''
    } catch (e) {
      input = input.replace(/^https?:\/\//i, '').split(/[/?#]/)[0]
    }
  } else {
    // 3) 纯文本：去掉可能残留的查询串/锚点
    input = input.split(/[?#]/)[0]
  }

  return input.trim()
}

/**
 * 判断字符串是否是一个“看起来合法”的分享码
 * @param {string} code
 */
export function isValidShareCode(code) {
  return CODE_PATTERN.test(String(code || '').trim())
}
