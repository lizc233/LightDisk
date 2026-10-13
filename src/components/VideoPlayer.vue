<template>
  <teleport to="body">
    <transition name="vp-fade">
      <div
        v-if="visible && current"
        ref="rootEl"
        class="vp-mask"
        :class="{ 'vp-hide-cursor': !controlsVisible && playing }"
        @mousemove="scheduleHide"
        @click.self="onBackdropClick"
      >
        <div class="vp-stage">
          <video
            ref="videoEl"
            class="vp-video"
            preload="metadata"
            playsinline
            :src="current.url"
            @click="togglePlay"
            @dblclick="toggleFullscreen"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @progress="onProgress"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
            @waiting="buffering = true"
            @playing="buffering = false"
            @canplay="buffering = false"
          ></video>

          <!-- 加载中 -->
          <div v-if="buffering" class="vp-spinner">
            <span class="vp-spinner-ring"></span>
          </div>

          <!-- 中央大播放按钮：暂停时显示 -->
          <button v-if="!playing && !buffering" class="vp-big-play" @click="togglePlay">
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
              <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>
            </svg>
          </button>

          <!-- 续播提示 -->
          <transition name="vp-fade">
            <div v-if="posHintText" class="vp-pos-hint">{{ posHintText }}</div>
          </transition>

          <!-- 顶部信息条 -->
          <div class="vp-topbar" :class="{ 'vp-bar-hidden': !controlsVisible }">
            <div class="vp-title" :title="current.name">{{ current.name }}</div>
            <button class="vp-icon-btn" title="关闭（Esc）" @click="close">
              <el-icon><Close /></el-icon>
            </button>
          </div>

          <!-- 底部控制条 -->
          <div class="vp-controls" :class="{ 'vp-bar-hidden': !controlsVisible }">
            <div
              ref="progressEl"
              class="vp-progress"
              @pointerdown.prevent="onProgressDown"
            >
              <div class="vp-track">
                <div class="vp-buffer" :style="{ width: bufferPercent + '%' }"></div>
                <div class="vp-fill" :style="{ width: progressPercent + '%' }"></div>
                <div class="vp-knob" :style="{ left: progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="vp-btn-row">
              <button class="vp-icon-btn" :title="playing ? '暂停（空格）' : '播放（空格）'" @click="togglePlay">
                <el-icon v-if="playing"><VideoPause /></el-icon>
                <el-icon v-else><VideoPlay /></el-icon>
              </button>

              <button
                v-if="playlist.length > 1"
                class="vp-icon-btn"
                title="上一个"
                @click="switchTo(activeIndex - 1)"
              >
                <el-icon><DArrowLeft /></el-icon>
              </button>
              <button
                v-if="playlist.length > 1"
                class="vp-icon-btn"
                title="下一个"
                @click="switchTo(activeIndex + 1)"
              >
                <el-icon><DArrowRight /></el-icon>
              </button>

              <span class="vp-time">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</span>

              <div class="vp-spacer"></div>

              <div class="vp-volume">
                <button class="vp-icon-btn" :title="volume > 0 ? '静音（M）' : '取消静音（M）'" @click="toggleMute">
                  <el-icon v-if="volume > 0"><Bell /></el-icon>
                  <el-icon v-else><MuteNotification /></el-icon>
                </button>
                <input
                  class="vp-volume-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="volume"
                  @input="setVolume($event.target.value)"
                />
              </div>

              <el-dropdown trigger="click" @command="setRate">
                <button class="vp-chip">{{ rateLabel }}</button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="r in PLAY_RATES" :key="r" :command="r">
                      {{ r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') }}x
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <button
                v-if="pipSupported"
                class="vp-icon-btn"
                title="画中画"
                @click="togglePip"
              >
                <el-icon><CopyDocument /></el-icon>
              </button>

              <button class="vp-icon-btn" :title="isFullscreen ? '退出全屏（F）' : '全屏（F）'" @click="toggleFullscreen">
                <el-icon v-if="isFullscreen"><CloseBold /></el-icon>
                <el-icon v-else><FullScreen /></el-icon>
              </button>
            </div>
          </div>

          <div class="vp-hint-keys">
            空格 播放/暂停 · ← → 快退快进 · ↑ ↓ 音量 · M 静音 · F 全屏 · Esc 关闭
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  Bell, Close, CloseBold, CopyDocument, DArrowLeft, DArrowRight,
  FullScreen, MuteNotification, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatDuration } from '@/utils/format'
import { PLAY_RATES } from '@/stores/player'

const props = defineProps({
  /** 当前要播放的文件：{ key, id, name, size, url } */
  file: { type: Object, default: null },
  /** 可切换的同类型播放列表（视频分类下的全部视频） */
  playlist: { type: Array, default: () => [] }
})

const visible = defineModel({ type: Boolean, default: false })

const POSITION_PREFIX = 'lightdisk.video.pos.'

const rootEl = ref(null)
const videoEl = ref(null)
const progressEl = ref(null)

const current = ref(null)
const playing = ref(false)
const buffering = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(Number(localStorage.getItem('lightdisk.video.volume') || 0.8))
const rate = ref(1)
const isFullscreen = ref(false)
const controlsVisible = ref(true)
const posHintText = ref('')
const dragging = ref(false)

let hideTimer = null
let pendingRestore = false
let unmutedVolume = volume.value || 0.8

const pipSupported = computed(() =>
  typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled)

const progressPercent = computed(() =>
  duration.value ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)

const bufferPercent = computed(() =>
  duration.value ? Math.min(100, (buffered.value / duration.value) * 100) : 0)

const rateLabel = computed(() => {
  const text = Number(rate.value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${text}x`
})

const activeIndex = computed(() => {
  if (!current.value) return -1
  return props.playlist.findIndex(item => item.key === current.value.key)
})

// 打开 / 切换文件
watch(() => props.file, (val) => {
  if (!val) return
  current.value = { ...val }
  pendingRestore = true
  currentTime.value = 0
  duration.value = 0
  buffered.value = 0
  if (visible.value) {
    nextTick(() => loadAndPlay())
  }
}, { immediate: true })

watch(visible, (val) => {
  if (val) {
    nextTick(() => {
      loadAndPlay()
      attachKeys()
      scheduleHide()
    })
  } else {
    savePosition()
    const el = videoEl.value
    if (el) el.pause()
    playing.value = false
    detachKeys()
    exitFullscreenIfNeeded()
  }
})

const loadAndPlay = () => {
  const el = videoEl.value
  if (!el) return
  el.volume = volume.value
  el.playbackRate = rate.value
  if ('preservesPitch' in el) el.preservesPitch = true
  el.load()
  const promise = el.play()
  if (promise && typeof promise.catch === 'function') {
    // 浏览器自动播放策略可能拦截，此时保留暂停态由用户点击
    promise.catch(() => { playing.value = false })
  }
}

const savePosition = () => {
  if (!current.value) return
  if (currentTime.value > 3 && duration.value && currentTime.value < duration.value - 5) {
    localStorage.setItem(POSITION_PREFIX + current.value.id, String(Math.floor(currentTime.value)))
  } else if (duration.value && currentTime.value >= duration.value - 5) {
    // 已看完，清除进度，下次从头播放
    localStorage.removeItem(POSITION_PREFIX + current.value.id)
  }
}

const restorePosition = () => {
  const el = videoEl.value
  if (!el || !current.value) return
  const saved = Number(localStorage.getItem(POSITION_PREFIX + current.value.id) || 0)
  if (!Number.isFinite(saved) || saved <= 3) return
  if (duration.value && saved >= duration.value - 5) return
  try {
    el.currentTime = saved
    currentTime.value = saved
    posHintText.value = `已为你续播至 ${formatDuration(saved)}`
    setTimeout(() => { posHintText.value = '' }, 3600)
  } catch (e) {
    /* 元数据异常时忽略 */
  }
}

const togglePlay = () => {
  const el = videoEl.value
  if (!el) return
  if (el.paused) {
    const promise = el.play()
    if (promise && typeof promise.catch === 'function') promise.catch(() => {})
  } else {
    el.pause()
  }
  scheduleHide()
}

const onPlay = () => { playing.value = true; scheduleHide() }
const onPause = () => { playing.value = false; controlsVisible.value = true }

const onTimeUpdate = () => {
  const el = videoEl.value
  if (!el) return
  if (!dragging.value) currentTime.value = el.currentTime
  if (buffered.value < currentTime.value) onProgress()
}

const onProgress = () => {
  const el = videoEl.value
  if (!el || !el.buffered || !el.buffered.length) return
  try {
    buffered.value = el.buffered.end(el.buffered.length - 1)
  } catch (e) { /* 忽略 */ }
}

const onLoadedMetadata = () => {
  const el = videoEl.value
  if (!el) return
  duration.value = Number.isFinite(el.duration) ? el.duration : 0
  if (pendingRestore) {
    pendingRestore = false
    restorePosition()
  }
}

const onEnded = () => {
  playing.value = false
  savePosition()
  if (props.playlist.length > 1 && activeIndex.value >= 0) {
    switchTo(activeIndex.value + 1)
  }
}

const switchTo = (index) => {
  const list = props.playlist
  if (!list.length) return
  savePosition()
  const nextIdx = ((index % list.length) + list.length) % list.length
  current.value = { ...list[nextIdx] }
  pendingRestore = true
  currentTime.value = 0
  duration.value = 0
  buffered.value = 0
  buffering.value = true
  nextTick(() => loadAndPlay())
}

const seekBy = (delta) => {
  const el = videoEl.value
  if (!el || !duration.value) return
  const target = Math.max(0, Math.min(duration.value, el.currentTime + delta))
  el.currentTime = target
  currentTime.value = target
  scheduleHide()
}

const setVolume = (value) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  volume.value = v
  const el = videoEl.value
  if (el) el.volume = v
  if (v > 0) unmutedVolume = v
  localStorage.setItem('lightdisk.video.volume', String(v))
  scheduleHide()
}

const toggleMute = () => {
  if (volume.value > 0) {
    unmutedVolume = volume.value
    setVolume(0)
  } else {
    setVolume(unmutedVolume || 0.8)
  }
}

const setRate = (value) => {
  const v = PLAY_RATES.includes(Number(value)) ? Number(value) : 1
  rate.value = v
  const el = videoEl.value
  if (el) {
    el.playbackRate = v
    if ('preservesPitch' in el) el.preservesPitch = true
  }
  scheduleHide()
}

const togglePip = async () => {
  const el = videoEl.value
  if (!el) return
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await el.requestPictureInPicture()
    }
  } catch (e) {
    ElMessage.warning('当前浏览器不支持画中画')
  }
}

const toggleFullscreen = () => {
  const el = rootEl.value
  if (!el) return
  if (!document.fullscreenElement) {
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
    if (request) request.call(el)
  } else {
    exitFullscreenIfNeeded()
  }
}

const exitFullscreenIfNeeded = () => {
  if (document.fullscreenElement) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen
    if (exit) exit.call(document)
  }
}

const onFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const scheduleHide = () => {
  controlsVisible.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (playing.value && !dragging.value) controlsVisible.value = false
  }, 3000)
}

const onBackdropClick = () => {
  // 点击空白区域不关闭，避免误触丢失观看进度
  scheduleHide()
}

const close = () => {
  visible.value = false
}

const percentFromEvent = (event) => {
  const el = progressEl.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  if (!rect.width) return 0
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
}

const applySeek = (ratio) => {
  const el = videoEl.value
  if (!el || !duration.value) return
  const target = ratio * duration.value
  currentTime.value = target
  try {
    el.currentTime = target
  } catch (e) { /* 忽略 */ }
}

const onProgressDown = (event) => {
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
  clearTimeout(hideTimer)
  scheduleHide()
  window.removeEventListener('pointermove', onProgressMove)
  window.removeEventListener('pointerup', onProgressUp)
}

const onKeydown = (event) => {
  if (!visible.value) return
  const target = event.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  switch (event.key) {
    case ' ':
      event.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      event.preventDefault()
      seekBy(-5)
      break
    case 'ArrowRight':
      event.preventDefault()
      seekBy(5)
      break
    case 'ArrowUp':
      event.preventDefault()
      setVolume(volume.value + 0.05)
      break
    case 'ArrowDown':
      event.preventDefault()
      setVolume(volume.value - 0.05)
      break
    case 'm':
    case 'M':
      toggleMute()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
    case 'Escape':
      if (!document.fullscreenElement) close()
      break
    default:
      break
  }
}

const attachKeys = () => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
}

const detachKeys = () => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  clearTimeout(hideTimer)
}

onBeforeUnmount(() => {
  detachKeys()
  window.removeEventListener('pointermove', onProgressMove)
  window.removeEventListener('pointerup', onProgressUp)
  savePosition()
})
</script>

<style scoped>
.vp-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 10, 14, 0.94);
}

.vp-hide-cursor {
  cursor: none;
}

.vp-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vp-video {
  width: 100%;
  height: 100%;
  max-height: 100%;
  background: #000;
  object-fit: contain;
  outline: none;
}

.vp-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px 34px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.62), transparent);
  transition: opacity 0.25s ease;
}

.vp-title {
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vp-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 30px 22px 18px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  transition: opacity 0.25s ease;
}

.vp-bar-hidden {
  opacity: 0;
  pointer-events: none;
}

.vp-progress {
  padding: 8px 0;
  cursor: pointer;
  touch-action: none;
}

.vp-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.28);
}

.vp-buffer {
  position: absolute;
  inset: 0 auto 0 0;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.45);
}

.vp-fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 4px;
  border-radius: 2px;
  background: var(--accent);
}

.vp-knob {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: #fff;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.vp-progress:hover .vp-knob,
.vp-controls:active .vp-knob {
  opacity: 1;
}

.vp-btn-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.vp-spacer {
  flex: 1;
}

.vp-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
  font-size: 17px;
}

.vp-icon-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.vp-time {
  margin-left: 6px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.vp-volume {
  display: flex;
  align-items: center;
  gap: 4px;
}

.vp-volume-range {
  width: 78px;
  accent-color: var(--accent);
}

.vp-chip {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  cursor: pointer;
}

.vp-chip:hover {
  border-color: #fff;
  color: #fff;
}

.vp-big-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(20, 22, 28, 0.62);
  color: #fff;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.vp-big-play:hover {
  transform: translate(-50%, -50%) scale(1.06);
  background: rgba(20, 22, 28, 0.78);
}

.vp-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.vp-spinner-ring {
  display: block;
  width: 42px;
  height: 42px;
  border: 3px solid rgba(255, 255, 255, 0.28);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: vp-spin 0.9s linear infinite;
}

@keyframes vp-spin {
  to { transform: rotate(360deg); }
}

.vp-pos-hint {
  position: absolute;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(20, 22, 28, 0.75);
  color: #fff;
  font-size: 13px;
}

.vp-hint-keys {
  position: absolute;
  right: 22px;
  bottom: 6px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}

.vp-fade-enter-active,
.vp-fade-leave-active {
  transition: opacity 0.22s ease;
}

.vp-fade-enter-from,
.vp-fade-leave-to {
  opacity: 0;
}
</style>
