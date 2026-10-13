<template>
  <div v-if="player.hasTrack" class="audio-bar">
    <!-- 播放列表抽屉（向上展开） -->
    <transition name="ap-slide">
      <div v-if="player.panelVisible" class="ap-panel">
        <div class="ap-panel-head">
          <span>播放列表（{{ player.playList.length }}）</span>
          <button class="ap-text-btn" @click="player.clearList()">清空</button>
        </div>
        <div class="ap-panel-list">
          <div
            v-for="(item, index) in player.playList"
            :key="item.key"
            class="ap-panel-item"
            :class="{ active: index === player.currentIndex }"
            @click="playIndex(index)"
          >
            <span class="ap-panel-index">{{ index === player.currentIndex && player.playing ? '▶' : index + 1 }}</span>
            <span class="ap-panel-cover">
              <img
                v-if="item.coverUrl && !failedPanelCovers[item.key]"
                :src="panelCoverSrc(item)"
                alt=""
                @error="failedPanelCovers[item.key] = true"
              />
              <el-icon v-else><Headset /></el-icon>
            </span>
            <span class="ap-panel-name" :title="item.name">{{ item.name }}</span>
            <span class="ap-panel-size">{{ formatBytes(item.size) }}</span>
            <button class="ap-panel-remove" title="移出列表" @click.stop="player.removeAt(index)">
              <el-icon><Close /></el-icon>
            </button>
          </div>
          <div v-if="!player.playList.length" class="ap-panel-empty">列表为空</div>
        </div>
      </div>
    </transition>

    <audio
      ref="audioEl"
      :src="player.currentTrack?.url || ''"
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @playing="onPlaying"
      @waiting="onWaiting"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
    ></audio>

    <!-- 左：曲目信息 -->
    <div class="ap-info">
      <div class="ap-cover">
        <img
          v-if="hasCover && !coverFailed"
          :src="coverSrc"
          class="ap-cover-img"
          alt=""
          @error="coverFailed = true"
        />
        <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M7 17.5a2.5 2.5 0 1 0 0-.01M7 15V4l10-2v10.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="17" cy="15.4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
        </svg>
      </div>
      <div class="ap-meta">
        <span class="ap-name" :title="player.currentTrack?.name">{{ player.currentTrack?.name }}</span>
        <span class="ap-sub">{{ formatBytes(player.currentTrack?.size) }} · {{ rateLabel }}</span>
      </div>
    </div>

    <!-- 频谱可视化：Web Audio API 实时柱状图（不可用时自动隐藏） -->
    <canvas
      v-show="spectrumOn"
      ref="spectrumEl"
      class="ap-spectrum"
      width="180"
      height="44"
      title="实时频谱"
    ></canvas>

    <!-- 中：控制 + 进度 -->
    <div class="ap-center">
      <div class="ap-controls">
        <button class="ap-btn" title="上一首" @click="player.prev()">
          <el-icon><DArrowLeft /></el-icon>
        </button>
        <button class="ap-btn ap-btn-main" :title="player.playing ? '暂停' : '播放'" @click="player.toggle()">
          <el-icon v-if="player.playing"><VideoPause /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </button>
        <button class="ap-btn" title="下一首" @click="player.next(false)">
          <el-icon><DArrowRight /></el-icon>
        </button>
      </div>
      <div class="ap-timeline">
        <span class="ap-time">{{ formatDuration(player.currentTime) }}</span>
        <div
          ref="progressEl"
          class="ap-progress"
          @pointerdown.prevent="onProgressDown"
        >
          <div class="ap-track">
            <div class="ap-buffer" :style="{ width: bufferPercent + '%' }"></div>
            <div class="ap-fill" :style="{ width: progressPercent + '%' }"></div>
            <div class="ap-knob" :style="{ left: progressPercent + '%' }"></div>
          </div>
        </div>
        <span class="ap-time">{{ formatDuration(player.duration) }}</span>
      </div>
    </div>

    <!-- 右：倍速 / 循环 / 音量 / 列表 -->
    <div class="ap-right">
      <el-dropdown trigger="click" @command="player.setRate">
        <button class="ap-chip">{{ rateLabel }}</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="r in PLAY_RATES" :key="r" :command="r">
              {{ r.toFixed(2).replace(/0$/, '').replace(/\.$/, '') }}x
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" @command="player.setLoopMode">
        <button class="ap-chip" :title="loopLabel">{{ loopIcon }}</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="m in LOOP_MODES" :key="m.value" :command="m.value">
              {{ m.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <div class="ap-volume">
        <el-icon class="ap-volume-icon"><Bell /></el-icon>
        <input
          class="ap-volume-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="player.volume"
          @input="player.setVolume($event.target.value)"
        />
      </div>

      <button
        v-if="spectrumSupported"
        class="ap-btn"
        :class="{ on: spectrumOn }"
        title="频谱可视化"
        @click="toggleSpectrum"
      >
        <el-icon><Histogram /></el-icon>
      </button>

      <button
        class="ap-btn"
        :class="{ on: player.panelVisible }"
        title="播放列表"
        @click="player.panelVisible = !player.panelVisible"
      >
        <el-icon><List /></el-icon>
      </button>

      <button class="ap-btn" title="关闭播放器" @click="closePlayer">
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Bell, Close, DArrowLeft, DArrowRight, Headset, Histogram, List, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { usePlayerStore, LOOP_MODES, PLAY_RATES } from '@/stores/player'
import { formatBytes, formatDuration } from '@/utils/format'
import { QoeReporter } from '@/utils/qoe'

const player = usePlayerStore()

/** 当前曲目的流地址（判断 <audio> 是否已切到新源，避免在旧源上 play） */
const currentUrl = computed(() => player.currentTrack?.url || '')

const audioEl = ref(null)
const progressEl = ref(null)
const dragging = ref(false)
const buffered = ref(0)

// ===== 封面（ID3 APIC 内嵌图，后端按 MD5 缓存）=====
const coverFailed = ref(false)
const failedPanelCovers = reactive({})
const coverSrc = computed(() => player.currentTrack?.coverUrl || '')
const hasCover = computed(() => !!coverSrc.value)
const panelCoverSrc = (item) => item.coverUrl || ''

// 切歌时重置封面失败态，让新曲目重新尝试加载
watch(() => player.currentTrack?.key, () => {
  coverFailed.value = false
  startSession()
})

// ===== 播放质量埋点（与视频共用同一套 QoeReporter）=====
let qoe = null
const startSession = () => {
  // 结束上一会话并结算
  if (qoe) qoe.report()
  const track = player.currentTrack
  qoe = track ? new QoeReporter({ fileId: track.id, playType: 'audio' }) : null
  if (qoe) {
    qoe.markLoadStart()
    qoe.setQuality('audio')
  }
}
const finishSession = () => {
  if (qoe) {
    qoe.markPaused()
    qoe.report()
    qoe = null
  }
}

// ===== Web Audio 频谱可视化 =====
const spectrumEl = ref(null)
// 只要浏览器有 AudioContext 就展示开关；真正建图失败时再降级隐藏
const spectrumSupported = ref(!!(window.AudioContext || window.webkitAudioContext))
const spectrumOn = ref((() => {
  try {
    return localStorage.getItem('lightdisk.audio.spectrum') === '1'
  } catch (e) {
    return false
  }
})())
let audioCtx = null
let analyser = null
let sourceNode = null
let freqData = null
let rafId = 0

const toggleSpectrum = () => {
  spectrumOn.value = !spectrumOn.value
  try {
    localStorage.setItem('lightdisk.audio.spectrum', spectrumOn.value ? '1' : '0')
  } catch (e) { /* 忽略 */ }
  if (spectrumOn.value) {
    ensureAudioGraph()
    if (player.playing) startSpectrumLoop()
  } else {
    stopSpectrumLoop()
    clearSpectrum()
  }
}

/**
 * 建立 Web Audio 图：<audio> → AnalyserNode → destination。
 * createMediaElementSource 对同一元素只能调用一次，故用 sourceNode 做幂等。
 */
const ensureAudioGraph = () => {
  if (sourceNode) return
  const el = audioEl.value
  if (!el) return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audioCtx = new Ctx()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.8
    sourceNode = audioCtx.createMediaElementSource(el)
    sourceNode.connect(analyser)
    analyser.connect(audioCtx.destination)
    freqData = new Uint8Array(analyser.frequencyBinCount)
    spectrumSupported.value = true
  } catch (e) {
    // 跨域音频 / 重复 createMediaElementSource 等异常：彻底降级为无频谱
    spectrumSupported.value = false
    spectrumOn.value = false
    audioCtx = null
    analyser = null
    sourceNode = null
  }
}

const drawSpectrum = () => {
  const canvas = spectrumEl.value
  if (!canvas || !analyser || !freqData) return
  analyser.getByteFrequencyData(freqData)
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  const bars = Math.min(40, freqData.length)
  const barWidth = width / bars
  const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#4f7cff'
  ctx.fillStyle = accent
  for (let i = 0; i < bars; i += 1) {
    const value = freqData[i] / 255
    const barHeight = Math.max(2, value * height)
    const x = i * barWidth
    ctx.globalAlpha = 0.35 + value * 0.65
    ctx.fillRect(x + 1, height - barHeight, Math.max(1, barWidth - 2), barHeight)
  }
  ctx.globalAlpha = 1
}

const startSpectrumLoop = () => {
  if (!spectrumOn.value) return
  cancelAnimationFrame(rafId)
  const loop = () => {
    drawSpectrum()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

const stopSpectrumLoop = () => {
  cancelAnimationFrame(rafId)
  rafId = 0
}

const clearSpectrum = () => {
  const canvas = spectrumEl.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

const progressPercent = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, (player.currentTime / player.duration) * 100)
})

const bufferPercent = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, (buffered.value / player.duration) * 100)
})

const rateLabel = computed(() => {
  const r = Number(player.rate || 1)
  const text = r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${text}x`
})

const loopLabel = computed(() => (LOOP_MODES.find(m => m.value === player.loopMode) || {}).label || '顺序播放')

const loopIcon = computed(() => {
  if (player.loopMode === 'single') return '单曲'
  if (player.loopMode === 'random') return '随机'
  return '顺序'
})

/**
 * 统一应用倍速到 <audio>。
 *
 * 关键点（修复「进度条走快了但听感仍是 1 倍速」）：
 *  1. 同时写 playbackRate 与 defaultPlaybackRate —— 后者决定换源/重载后的初始速率，
 *     只写 playbackRate 时新曲目加载完会回到 1.0（表现为「只有进度条快」）。
 *  2. preservesPitch 必须显式设为 true，否则 Chromium 默认会变调；
 *     部分内核需用带前缀的属性名。
 */
const applyRate = () => {
  const el = audioEl.value
  if (!el) return
  const val = Number(player.rate) || 1
  el.defaultPlaybackRate = val
  el.playbackRate = val
  if ('preservesPitch' in el) el.preservesPitch = true
  else if ('mozPreservesPitch' in el) el.mozPreservesPitch = true
  else if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true
}

// 曲目切换：:src 绑定会自动触发浏览器重新加载，这里只需同步播放状态
// （此前手动 load() 会 abort 掉播放 promise，把 AbortError 误判成自动播放拦截）
watch(() => player.currentTrack?.url, () => {
  nextTick(() => {
    buffered.value = 0
    applyRate()
    syncPlayback()
  })
})

// 播放/暂停状态同步
watch(() => player.playing, () => syncPlayback())

// reloadToken：单曲循环 / 重播 / 上一首回到开头。
// 关键：只在「同一首曲子」内生效；换曲时 URL 绑定已负责重载，
// 这里再 play 一次会与 :src 更新竞态（大列表下表现为点了单曲不播）。
watch(() => player.reloadToken, () => {
  const el = audioEl.value
  if (!el) return
  const srcMatches = el.currentSrc && currentUrl.value && el.currentSrc.indexOf(currentUrl.value) !== -1
  if (!srcMatches) {
    // src 尚未切换到新曲目，交给 url watcher 处理，避免在旧源上 play 导致 AbortError
    nextTick(() => { applyRate(); syncPlayback() })
    return
  }
  try {
    el.currentTime = 0
  } catch (e) { /* 元数据未就绪时忽略 */ }
  applyRate()
  syncPlayback()
})

watch(() => player.volume, (val) => {
  const el = audioEl.value
  if (el) el.volume = val
})

// 倍速：preservesPitch 保持音调，避免变成「花栗鼠音」
watch(() => player.rate, () => applyRate(), { immediate: true })

// 外部（进度条）改写播放位置时同步到元素
watch(() => player.currentTime, (val) => {
  const el = audioEl.value
  if (!el || dragging.value) return
  if (Math.abs(el.currentTime - val) > 0.8) {
    try {
      el.currentTime = val
    } catch (e) { /* 忽略越界 */ }
  }
})

const syncPlayback = () => {
  const el = audioEl.value
  if (!el) return
  if (player.playing) {
    const promise = el.play()
    if (promise && typeof promise.catch === 'function') {
      promise.catch((err) => {
        // 换源/快速切换导致的 AbortError 不算播放失败，静默忽略；
        // 只有自动播放被策略拦截（NotAllowedError）或真正无源时才回退暂停态
        if (err && err.name === 'AbortError') return
        player.stop()
      })
    }
  } else {
    el.pause()
  }
}

const onTimeUpdate = () => {
  const el = audioEl.value
  if (!el) return
  if (!dragging.value) player.currentTime = el.currentTime
  if (el.buffered && el.buffered.length) {
    buffered.value = el.buffered.end(el.buffered.length - 1)
  }
}

const onLoadedMetadata = () => {
  const el = audioEl.value
  if (!el) return
  player.duration = Number.isFinite(el.duration) ? el.duration : 0
  el.volume = player.volume
  // 新曲目元数据就绪后必须重新写一次倍速：
  // 换源会重置元素的 playbackRate/defaultPlaybackRate，只靠 store 的 watch 不够
  applyRate()
  // 元数据就绪即认为首帧可用，记一次首帧耗时
  if (qoe) qoe.markFirstFrame()
}

// ===== 媒体事件（QoE 采集 + 频谱启停）=====
const onPlaying = () => {
  // 兜底：部分内核在 play 时会重置 playbackRate，这里再对齐一次
  applyRate()
  if (qoe) {
    qoe.markFirstFrame()
    qoe.markPlaying()
    qoe.markStallEnd()
  }
  if (spectrumOn.value) {
    ensureAudioGraph()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    startSpectrumLoop()
  }
}

const onWaiting = () => {
  if (qoe) qoe.markStallStart()
  if (qoe) qoe.markPaused()
}

const onPause = () => {
  if (qoe) qoe.markPaused()
  stopSpectrumLoop()
  clearSpectrum()
}

const onEnded = () => {
  finishSession()
  player.next(true)
}

const onError = () => {
  if (!player.hasTrack) return
  if (qoe) qoe.report()
  qoe = null
  ElMessage.warning('音频加载失败，已跳到下一首')
  player.next(true)
}

const playIndex = (index) => {
  player.currentIndex = index
  player.currentTime = 0
  player.duration = 0
  player.playing = true
  player.reloadToken += 1
}

const closePlayer = () => {
  finishSession()
  stopSpectrumLoop()
  player.stop()
  player.clearList()
  player.panelVisible = false
}

const percentFromEvent = (event) => {
  const el = progressEl.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  if (!rect.width) return 0
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
}

const applySeek = (ratio) => {
  if (!player.duration) return
  const target = ratio * player.duration
  player.currentTime = target
  const el = audioEl.value
  if (el) {
    try {
      el.currentTime = target
    } catch (e) { /* 忽略 */ }
  }
}

const onProgressDown = (event) => {
  if (!player.duration) return
  dragging.value = true
  applySeek(percentFromEvent(event))
  window.addEventListener('pointermove', onProgressMove)
  window.addEventListener('pointerup', onProgressUp)
}

const onProgressMove = (event) => {
  if (!dragging.value) return
  applySeek(percentFromEvent(event))
}

const onProgressUp = () => {
  dragging.value = false
  window.removeEventListener('pointermove', onProgressMove)
  window.removeEventListener('pointerup', onProgressUp)
}

/** 页面卸载：sendBeacon 同步兜底上报 QoE，避免刷新/关闭丢数据 */
const onBeforeUnload = () => {
  if (qoe) {
    qoe.markPaused()
    qoe.reportOnUnload()
    qoe = null
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  // 恢复上次会话（Pinia+localStorage 已恢复曲目）时，若在播放态则建立新埋点会话
  if (player.hasTrack) startSession()
  if (spectrumOn.value) nextTick(() => ensureAudioGraph())
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onProgressMove)
  window.removeEventListener('pointerup', onProgressUp)
  window.removeEventListener('beforeunload', onBeforeUnload)
  stopSpectrumLoop()
  finishSession()
  if (audioCtx) {
    try {
      audioCtx.close()
    } catch (e) { /* 忽略 */ }
    audioCtx = null
  }
})
</script>

<style scoped>
.audio-bar {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 20px;
  height: 74px;
  padding: 0 20px;
  background: var(--surface-solid);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.06);
}

.ap-info {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 240px;
  min-width: 0;
}

.ap-cover {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  overflow: hidden;
}

.ap-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ap-spectrum {
  flex: 0 0 auto;
  width: 180px;
  height: 44px;
  border-radius: 10px;
  background: var(--accent-soft);
}

.ap-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.ap-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.ap-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ap-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.ap-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.ap-btn.on {
  color: var(--accent);
}

.ap-btn-main {
  width: 38px;
  height: 38px;
  background: var(--accent);
  color: #fff;
  font-size: 18px;
}

.ap-btn-main:hover {
  background: var(--accent);
  color: #fff;
  filter: brightness(1.06);
}

.ap-timeline {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 620px;
}

.ap-time {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 42px;
  text-align: center;
}

.ap-progress {
  flex: 1;
  padding: 8px 0;
  cursor: pointer;
  touch-action: none;
}

.ap-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
}

.ap-buffer {
  position: absolute;
  inset: 0 auto 0 0;
  height: 4px;
  border-radius: 2px;
  background: var(--text-muted);
  opacity: 0.3;
}

.ap-fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 4px;
  border-radius: 2px;
  background: var(--accent);
}

.ap-knob {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  margin-left: -5.5px;
  border-radius: 50%;
  background: var(--accent);
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.ap-progress:hover .ap-knob,
.audio-bar:active .ap-knob {
  opacity: 1;
}

.ap-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ap-chip {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ap-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ap-volume {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.ap-volume-icon {
  font-size: 15px;
}

.ap-volume-range {
  width: 84px;
  accent-color: var(--accent);
}

.ap-panel {
  position: absolute;
  right: 16px;
  bottom: 78px;
  width: 380px;
  max-height: 340px;
  display: flex;
  flex-direction: column;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-soft);
  overflow: hidden;
  z-index: 20;
}

.ap-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.ap-text-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.ap-text-btn:hover {
  color: var(--accent);
}

.ap-panel-list {
  overflow-y: auto;
  padding: 6px;
}

.ap-panel-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.ap-panel-item:hover {
  background: var(--accent-soft);
}

.ap-panel-item.active {
  color: var(--accent);
  font-weight: 600;
}

.ap-panel-index {
  width: 18px;
  flex: 0 0 18px;
  text-align: center;
  font-size: 12px;
}

.ap-panel-cover {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  overflow: hidden;
  font-size: 14px;
}

.ap-panel-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ap-panel-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-panel-size {
  font-size: 12px;
  color: var(--text-muted);
}

.ap-panel-remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.ap-panel-remove:hover {
  color: #f56c6c;
}

.ap-panel-empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.ap-slide-enter-active,
.ap-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.ap-slide-enter-from,
.ap-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
