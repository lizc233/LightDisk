/**
 * 上传队列调度器（文件级并发闸门）
 *
 * 为什么需要它：
 *   之前是「选了几个文件就同时发起几个上传」，一次拖 10+ 个文件会瞬间打出
 *   十几条并发请求。浏览器对同域并发连接本来就有限制，反向代理（例如
 *   Cloud Studio 预览网关）也常按连接数限流，超出的请求会被丢弃 / 返回 4xx，
 *   表现为「上传列表里一部分文件莫名其妙失败」。
 *
 * 现在改成：最多 MAX_CONCURRENT_UPLOADS 个上传同时进行，其余排队（状态 waiting），
 * 一个结束就自动把队首放出去。断点续传 / 秒传逻辑不受影响。
 */

/** 同时进行的上传任务数上限 */
export const MAX_CONCURRENT_UPLOADS = 3

let running = 0
/** 排队中的任务：{ taskId, start } */
const waiting = []

/** 当前队列状态（面板可用于提示「排队中 N 个」） */
export const uploadQueueStats = () => ({ running, waiting: waiting.length })

/**
 * 把一个上传任务放进队列。
 * @param {{ taskId?: string, start: () => Promise<any> }} job
 */
export function scheduleUpload(job) {
  if (!job || typeof job.start !== 'function') return
  waiting.push(job)
  pump()
}

/** 从队列里移除某个任务（用户取消时调用，避免取消后又被放出去） */
export function dropQueuedUpload(taskId) {
  if (!taskId) return
  const idx = waiting.findIndex((j) => j.taskId === taskId)
  if (idx >= 0) waiting.splice(idx, 1)
}

/** 清空队列（退出登录 / 切换账号时调用） */
export function clearUploadQueue() {
  waiting.length = 0
}

function pump() {
  while (running < MAX_CONCURRENT_UPLOADS && waiting.length) {
    const job = waiting.shift()
    running += 1
    let settled = false
    const release = () => {
      if (settled) return
      settled = true
      running -= 1
      pump()
    }
    Promise.resolve()
      .then(() => job.start())
      .catch(() => { /* 具体失败由调用方（runUpload）写入任务状态 */ })
      .then(release, release)
  }
}
