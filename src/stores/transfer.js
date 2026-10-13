import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'lightdisk.transfer.state'
const MAX_KEEP = 40
/** 速度采样窗口：只保留最近 3 秒的采样点，避免把「很久以前的平均速度」算进来 */
const SPEED_WINDOW_MS = 3000

/**
 * 传输任务状态：
 * waiting 排队中 / running 进行中 / paused 已暂停
 * success 已完成 / error 失败 / canceled 已取消
 */
export const ACTIVE_STATUSES = ['waiting', 'running', 'paused']

let taskSeq = 0

const loadSaved = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

/**
 * 全局传输列表（上传 / 下载）。
 *
 * 与「任务如何执行」解耦：store 只记录任务的状态与进度，
 * 真正的上传分片、下载流由 utils/uploader.js、utils/downloader.js 驱动，
 * 通过 registerControl 把「暂停 / 继续 / 取消」的回调挂进来。
 * 这样传输浮层可以挂在 BasicLayout 上跨路由常驻。
 */
export const useTransferStore = defineStore('transfer', () => {
  const savedList = loadSaved()

  const tasks = ref(savedList.map(item => ({
    id: item.id || `t${++taskSeq}`,
    kind: item.kind === 'download' ? 'download' : 'upload',
    name: item.name || '未命名',
    size: Number(item.size) || 0,
    loaded: Number(item.loaded) || 0,
    status: ACTIVE_STATUSES.includes(item.status) ? 'error' : (item.status || 'success'),
    error: ACTIVE_STATUSES.includes(item.status) ? '页面刷新导致任务中断' : (item.error || ''),
    speed: 0,
    fileId: item.fileId || null,
    instant: !!item.instant,
    createdAt: item.createdAt || Date.now(),
    finishedAt: item.finishedAt || null,
    retryable: item.retryable !== false,
    pausable: !!item.pausable,
    phase: ''
  })))

  /** 面板是否展开 */
  const panelVisible = ref(false)

  /** taskId -> { pause, resume, cancel }（由 uploader/downloader 注册） */
  const controls = new Map()
  /** taskId -> [{ t, loaded }]，用于滑动窗口测速 */
  const samples = new Map()

  const activeCount = computed(() =>
    tasks.value.filter(t => ACTIVE_STATUSES.includes(t.status)).length)

  const runningCount = computed(() =>
    tasks.value.filter(t => t.status === 'running').length)

  const finishedTasks = computed(() =>
    tasks.value.filter(t => !ACTIVE_STATUSES.includes(t.status)))

  const totalSpeed = computed(() =>
    tasks.value.reduce((sum, t) => sum + (t.status === 'running' ? (t.speed || 0) : 0), 0)
  )

  const persist = () => {
    try {
      const keep = tasks.value.slice(-MAX_KEEP).map(t => ({
        id: t.id,
        kind: t.kind,
        name: t.name,
        size: t.size,
        loaded: t.loaded,
        status: t.status,
        error: t.error,
        fileId: t.fileId,
        instant: t.instant,
        createdAt: t.createdAt,
        finishedAt: t.finishedAt,
        retryable: t.retryable,
        pausable: t.pausable
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keep))
    } catch (e) {
      /* 超配额时静默失败，不影响上传 */
    }
  }

  const findTask = (id) => tasks.value.find(t => t.id === id)

  const addTask = ({ kind = 'upload', name, size = 0, id = null, retryable = true, pausable = false }) => {
    const task = {
      id: id || `t${Date.now().toString(36)}${(++taskSeq).toString(36)}`,
      kind,
      name,
      size,
      loaded: 0,
      status: 'waiting',
      error: '',
      speed: 0,
      fileId: null,
      instant: false,
      createdAt: Date.now(),
      finishedAt: null,
      retryable,
      pausable,
      /** 阶段文案（如「计算校验值 45%」「上传分片」），仅内存态 */
      phase: ''
    }
    tasks.value.push(task)
    samples.set(task.id, [])
    persist()
    return task
  }

  const patchTask = (id, patch) => {
    const task = findTask(id)
    if (!task) return null
    Object.assign(task, patch)
    persist()
    return task
  }

  /** 只更新阶段文案（高频调用，不写 localStorage） */
  const setPhase = (id, phase) => {
    const task = findTask(id)
    if (task) task.phase = phase || ''
  }

  /** 上报进度：累加已传字节并按滑动窗口算瞬时速度 */
  const reportProgress = (id, loaded) => {
    const task = findTask(id)
    if (!task) return
    if (task.status === 'waiting') task.status = 'running'
    if (typeof loaded === 'number' && loaded >= 0) {
      task.loaded = Math.min(loaded, task.size || loaded)
    }
    const now = Date.now()
    const list = samples.get(id) || []
    list.push({ t: now, loaded: task.loaded })
    while (list.length > 2 && now - list[0].t > SPEED_WINDOW_MS) list.shift()
    samples.set(id, list)

    if (list.length >= 2) {
      const first = list[0]
      const last = list[list.length - 1]
      const dt = (last.t - first.t) / 1000
      const db = last.loaded - first.loaded
      // 采样区间太短时不更新，避免速度数字乱跳
      task.speed = dt >= 0.4 && db >= 0 ? Math.max(0, db / dt) : task.speed
    }
  }

  const finishTask = (id, { fileId = null, instant = false } = {}) => {
    patchTask(id, {
      status: 'success',
      finishedAt: Date.now(),
      speed: 0,
      fileId,
      instant,
      error: ''
    })
    if (tasks.value.length > MAX_KEEP) {
      tasks.value.splice(0, tasks.value.length - MAX_KEEP)
      persist()
    }
  }

  const failTask = (id, message) => {
    patchTask(id, {
      status: 'error',
      finishedAt: Date.now(),
      speed: 0,
      error: message || '传输失败'
    })
  }

  const cancelTask = (id) => {
    const task = findTask(id)
    if (!task) return
    const control = controls.get(id)
    if (control && typeof control.cancel === 'function') {
      try { control.cancel() } catch (e) { /* 忽略 */ }
    }
    controls.delete(id)
    patchTask(id, { status: 'canceled', speed: 0, finishedAt: Date.now(), error: '' })
  }

  /** 暂停：仅对已注册可暂停控制的任务生效 */
  const pauseTask = async (id) => {
    const task = findTask(id)
    if (!task || task.status !== 'running') return
    const control = controls.get(id)
    if (!control || typeof control.pause !== 'function') {
      return
    }
    try {
      await control.pause()
      patchTask(id, { status: 'paused', speed: 0 })
    } catch (e) {
      /* 暂停失败保持原状态 */
    }
  }

  /** 继续：从断点处接着传 */
  const resumeTask = async (id) => {
    const task = findTask(id)
    if (!task || task.status !== 'paused') return
    const control = controls.get(id)
    if (!control || typeof control.resume !== 'function') return
    try {
      patchTask(id, { status: 'running', error: '' })
      samples.set(id, [])
      await control.resume()
    } catch (e) {
      failTask(id, e?.message || '继续传输失败')
    }
  }

  /** 失败后重试：由调用方（Disk 页）注册的重试回调执行 */
  const retryTask = async (id) => {
    const task = findTask(id)
    if (!task) return
    const control = controls.get(id)
    if (!control || typeof control.retry !== 'function') return
    patchTask(id, { status: 'running', loaded: 0, error: '', speed: 0, finishedAt: null })
    samples.set(id, [])
    try {
      await control.retry()
    } catch (e) {
      failTask(id, e?.message || '重试失败')
    }
  }

  const removeTask = (id) => {
    controls.delete(id)
    samples.delete(id)
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx >= 0) tasks.value.splice(idx, 1)
    persist()
  }

  const clearFinished = () => {
    tasks.value = tasks.value.filter(t => ACTIVE_STATUSES.includes(t.status))
    persist()
  }

  const registerControl = (id, control) => {
    controls.set(id, control)
  }

  const unregisterControl = (id) => {
    controls.delete(id)
  }

  return {
    tasks,
    panelVisible,
    activeCount,
    runningCount,
    finishedTasks,
    totalSpeed,
    addTask,
    patchTask,
    setPhase,
    reportProgress,
    finishTask,
    failTask,
    cancelTask,
    pauseTask,
    resumeTask,
    retryTask,
    removeTask,
    clearFinished,
    registerControl,
    unregisterControl
  }
})
