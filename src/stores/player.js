import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { buildAudioCoverUrl } from '@/api/audio'

const STORAGE_KEY = 'lightdisk.player.state'

const readToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

/**
 * 播放流地址必须用「当下」的 token 现算，绝不能直接复用持久化里存的 url。
 *
 * 原因：后端 token 有效期 2 小时，且重新登录会整体换新（单会话）。持久化播放
 * 列表里若带着旧 token 的 url，下次打开页面恢复列表后，<audio>/<img> 不走
 * axios 拦截器，旧 url 全部 401 → 每首歌都触发 onError →「音频加载失败，
 * 已跳到下一首」级联刷屏。恢复列表时统一按当前 token 重建地址即可根治。
 */
export const buildTrackUrl = (id) =>
  id ? `/api/file/preview/${id}?token=${encodeURIComponent(readToken())}` : ''

/** 音频扩展名（与后端 category=audio 的过滤保持一致） */
export const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'wma']

/** 支持的倍速档位 */
export const PLAY_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

/** 循环模式：order-顺序 single-单曲 random-随机 */
export const LOOP_MODES = [
  { value: 'order', label: '顺序播放' },
  { value: 'single', label: '单曲循环' },
  { value: 'random', label: '随机播放' }
]

const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}
  } catch (e) {
    return {}
  }
}

/**
 * 全局音频播放器状态。
 *
 * 与 DOM 解耦：store 只描述「该播什么、播到哪、是否在播」，
 * 真正的 <audio> 元素由 AudioPlayerBar.vue 持有，通过 watch 双向同步。
 * 这样播放条可以挂在 BasicLayout 上跨路由常驻，切页不断播。
 */
export const usePlayerStore = defineStore('player', () => {
  const saved = readSaved()

  /** 播放列表：[{ key, id, name, url, thumbUrl, size }]（url/coverUrl 恢复时按当前 token 重建） */
  const reviveTrack = (t) => (t && t.id != null
    ? { ...t, url: buildTrackUrl(t.id), coverUrl: buildAudioCoverUrl(t.id) }
    : t)
  const playList = ref(Array.isArray(saved.playList) ? saved.playList.map(reviveTrack) : [])
  const currentIndex = ref(Number.isInteger(saved.currentIndex) ? saved.currentIndex : -1)
  const playing = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(typeof saved.volume === 'number' ? saved.volume : 0.8)
  const rate = ref(typeof saved.rate === 'number' ? saved.rate : 1)
  const loopMode = ref(saved.loopMode || 'order')
  /** 列表抽屉是否展开 */
  const panelVisible = ref(false)
  /** 每次自增用于通知 <audio> 重新加载当前曲目（单曲循环 / 重播） */
  const reloadToken = ref(0)

  const currentTrack = computed(() =>
    currentIndex.value >= 0 ? (playList.value[currentIndex.value] || null) : null)

  const hasTrack = computed(() => !!currentTrack.value)

  /**
   * 记住「切换循环模式前的完整播放列表」，用于从单曲循环切回顺序/随机时恢复整份队列。
   * 单曲循环会把列表收敛成本歌一首，这个备份保证可逆。
   */
  const fullListBeforeSingle = ref(null)

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      // url/coverUrl 内嵌 token，有效期只有 2 小时，不入库；恢复时按当前 token 现算
      playList: playList.value.map(({ url, coverUrl, ...rest }) => rest),
      currentIndex: currentIndex.value,
      volume: volume.value,
      rate: rate.value,
      loopMode: loopMode.value
    }))
  }

  watch([playList, currentIndex, volume, rate, loopMode], persist, { deep: true })

  /** 用「当前列表 + 起始位置」开播（例如在音频分类里点第一首） */
  const playFromList = (list, index = 0) => {
    if (!Array.isArray(list) || !list.length) return
    if (loopMode.value === 'single') {
      // 单曲循环语义：整列表只作为「候选池」备份，实际只播起始那一首
      const start = Math.max(0, Math.min(index, list.length - 1))
      fullListBeforeSingle.value = list.slice()
      playList.value = [list[start]]
      currentIndex.value = 0
    } else {
      playList.value = list.slice()
      currentIndex.value = Math.max(0, Math.min(index, list.length - 1))
    }
    currentTime.value = 0
    duration.value = 0
    playing.value = true
    reloadToken.value += 1
  }

  /**
   * 播放单曲：已在列表中则定位到它，否则追加进列表。
   * 若点击的正是当前曲且正在播放，则切换为暂停。
   * 传入 list 时用该列表整体替换播放列表（例如在某个文件夹里点某一首）。
   */
  const playTrack = (track, list) => {
    if (!track) return
    const useExternalList = Array.isArray(list) && list.length > 0
    if (useExternalList) {
      // 单曲循环语义下：无论从哪个列表点歌，都只把这首留下来播
      if (loopMode.value === 'single') {
        fullListBeforeSingle.value = list.slice()
        playList.value = [track]
        currentIndex.value = 0
        currentTime.value = 0
        duration.value = 0
        playing.value = true
        reloadToken.value += 1
        return
      }
      playList.value = list.slice()
    }
    const idx = playList.value.findIndex(t => t.key === track.key)
    if (idx >= 0) {
      if (idx === currentIndex.value && playing.value && !useExternalList) {
        playing.value = false
        return
      }
      currentIndex.value = idx
    } else {
      playList.value = [...playList.value, track]
      currentIndex.value = playList.value.length - 1
    }
    currentTime.value = 0
    duration.value = 0
    playing.value = true
    reloadToken.value += 1
  }

  const toggle = () => {
    if (!hasTrack.value) return
    playing.value = !playing.value
  }

  /**
   * 追加单曲到列表末尾而不打断当前播放（已在列表中的曲子不重复添加）。
   * 若当前没有任何曲目，则直接开始播放它。
   */
  const enqueue = (track) => {
    if (!track) return
    const exists = playList.value.some(t => t.key === track.key)
    if (!exists) playList.value = [...playList.value, track]
    if (currentIndex.value < 0) {
      currentIndex.value = playList.value.findIndex(t => t.key === track.key)
      currentTime.value = 0
      duration.value = 0
      playing.value = true
      reloadToken.value += 1
    }
  }

  /** 下一首；auto=true 表示由播放结束自动触发（影响单曲循环语义） */
  const next = (auto = false) => {
    if (!playList.value.length) return
    if (auto && loopMode.value === 'single') {
      currentTime.value = 0
      playing.value = true
      reloadToken.value += 1
      return
    }
    if (loopMode.value === 'random' && playList.value.length > 1) {
      let idx = currentIndex.value
      let guard = 0
      while (idx === currentIndex.value && guard < 20) {
        idx = Math.floor(Math.random() * playList.value.length)
        guard += 1
      }
      currentIndex.value = idx
    } else {
      const nextIdx = currentIndex.value + 1
      currentIndex.value = nextIdx >= playList.value.length ? 0 : nextIdx
    }
    currentTime.value = 0
    playing.value = true
    reloadToken.value += 1
  }

  const prev = () => {
    if (!playList.value.length) return
    if (currentTime.value > 5) {
      // 与主流播放器一致：播放超过 5 秒时「上一首」先回到开头
      currentTime.value = 0
      reloadToken.value += 1
      return
    }
    const nextIdx = currentIndex.value - 1
    currentIndex.value = nextIdx < 0 ? playList.value.length - 1 : nextIdx
    currentTime.value = 0
    playing.value = true
    reloadToken.value += 1
  }

  const seekTo = (seconds) => {
    const value = Number(seconds)
    if (!Number.isFinite(value) || value < 0) return
    currentTime.value = value
  }

  const setVolume = (value) => {
    volume.value = Math.max(0, Math.min(1, Number(value) || 0))
  }

  const setRate = (value) => {
    rate.value = PLAY_RATES.includes(Number(value)) ? Number(value) : 1
  }

  /**
   * 切换循环模式。
   *
   * 关键修复（大列表下「单曲循环」实际跳到别的歌）：
   * next(true) 依赖 currentIndex 定位，而列表项以 key 去重 —— 同一个音频在
   * 不同排序/分组下 key 可能重复，导致下标错位、单曲循环定位到别的曲目。
   * 这里采纳「语义化列表」方案：
   *   - 切到 single：备份完整列表，然后只保留当前曲目（列表长度 1，next 必然回到本歌）
   *   - 切回 order/random：用备份恢复完整列表，并把 currentIndex 重新定位到当前曲目
   */
  const setLoopMode = (mode) => {
    const next = LOOP_MODES.some(m => m.value === mode) ? mode : 'order'
    const prevMode = loopMode.value
    if (next === prevMode) return

    if (next === 'single') {
      const track = currentTrack.value
      if (track && playList.value.length > 1) {
        fullListBeforeSingle.value = playList.value.slice()
        playList.value = [track]
        currentIndex.value = 0
      }
    } else if (prevMode === 'single' && fullListBeforeSingle.value && fullListBeforeSingle.value.length) {
      const track = currentTrack.value
      const restored = fullListBeforeSingle.value.slice()
      const idx = track ? restored.findIndex(t => t.key === track.key) : -1
      // 若本歌已不在备份列表中（例如列表被清空过），把本歌补回去
      if (idx < 0 && track) restored.push(track)
      playList.value = restored
      currentIndex.value = idx >= 0 ? idx : restored.length - 1
      fullListBeforeSingle.value = null
    }
    loopMode.value = next
  }

  const removeAt = (index) => {
    if (index < 0 || index >= playList.value.length) return
    const wasCurrent = index === currentIndex.value
    playList.value = playList.value.filter((_, i) => i !== index)
    if (!playList.value.length) {
      currentIndex.value = -1
      playing.value = false
      currentTime.value = 0
      duration.value = 0
      return
    }
    if (wasCurrent) {
      currentIndex.value = Math.min(index, playList.value.length - 1)
      currentTime.value = 0
      reloadToken.value += 1
    } else if (index < currentIndex.value) {
      currentIndex.value -= 1
    }
  }

  const clearList = () => {
    playList.value = []
    currentIndex.value = -1
    playing.value = false
    currentTime.value = 0
    duration.value = 0
  }

  const stop = () => {
    playing.value = false
  }

  return {
    playList,
    currentIndex,
    playing,
    currentTime,
    duration,
    volume,
    rate,
    loopMode,
    panelVisible,
    reloadToken,
    currentTrack,
    hasTrack,
    playFromList,
    playTrack,
    enqueue,
    toggle,
    next,
    prev,
    seekTo,
    setVolume,
    setRate,
    setLoopMode,
    removeAt,
    clearList,
    stop
  }
})
