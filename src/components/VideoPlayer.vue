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
            :src="videoSrc"
            @click="togglePlay"
            @dblclick="toggleFullscreen"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @progress="onProgress"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
            @waiting="onWaiting"
            @playing="onPlaying"
            @canplay="onCanPlay"
            @error="onVideoError"
          ></video>

          <!-- 加载中 -->
          <div v-if="buffering" class="vp-spinner">
            <span class="vp-spinner-ring"></span>
          </div>

          <!-- 转码中提示（未就绪时回退原文件播放，同时后台转码） -->
          <transition name="vp-fade">
            <div v-if="transcodeHint" class="vp-transcode-hint">
              <span class="vp-th-dot"></span>
              {{ transcodeHint }}
            </div>
          </transition>

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
              <!-- 左侧：上一个 / 下一个 + 时间 -->
              <div class="vp-left-group">
                <button
                  v-if="playlist.length > 1"
                  class="vp-icon-btn"
                  title="上一个"
                  @click="switchTo(activeIndex - 1)"
                >
                  <el-icon><DArrowLeft /></el-icon>
                </button>
                <span class="vp-time">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</span>
              </div>

              <!-- 中间：大号播放/暂停（居中并放大） -->
              <div class="vp-center-group">
                <button
                  class="vp-main-btn"
                  :title="playing ? '暂停（空格）' : '播放（空格）'"
                  @click="togglePlay"
                >
                  <el-icon v-if="playing"><VideoPause /></el-icon>
                  <el-icon v-else><VideoPlay /></el-icon>
                </button>
              </div>

              <!-- 右侧：下一个 + 音量 + 清晰度 + 倍速 + 画中画 + 全屏 -->
              <div class="vp-right-group">
                <button
                  v-if="playlist.length > 1"
                  class="vp-icon-btn"
                  title="下一个"
                  @click="switchTo(activeIndex + 1)"
                >
                  <el-icon><DArrowRight /></el-icon>
                </button>

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

                <el-dropdown
                  trigger="click"
                  popper-class="vp-popper"
                  @command="setQuality"
                  @visible-change="onDropdownVisible"
                >
                  <button class="vp-chip" :title="qualityOptions.length > 1 ? '清晰度' : '清晰度（多档位转码中）'">
                    {{ qualityLabel }}
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-if="qualityOptions.length > 1" command="auto">自动</el-dropdown-item>
                      <el-dropdown-item
                        v-for="q in qualityOptions"
                        :key="q.height"
                        :command="q.height"
                        :disabled="q.locked"
                      >
                        {{ q.label }}{{ q.locked ? '（会员专享）' : '' }}
                      </el-dropdown-item>
                      <el-dropdown-item v-if="qualityOptions.length <= 1" command="source" disabled>
                        原画（多清晰度转码中…）
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <el-dropdown
                  trigger="click"
                  popper-class="vp-popper"
                  @command="setRate"
                  @visible-change="onDropdownVisible"
                >
                  <button class="vp-chip">{{ rateLabel }}</button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="r in PLAY_RATES"
                        :key="r"
                        :command="r"
                        :disabled="r > maxRate + 1e-6"
                      >
                        {{ r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') }}x{{ r > maxRate + 1e-6 ? '（会员专享）' : '' }}
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Bell, Close, CloseBold, CopyDocument, DArrowLeft, DArrowRight,
  FullScreen, MuteNotification, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatDuration } from '@/utils/format'
import { PLAY_RATES } from '@/stores/player'
import { QoeReporter } from '@/utils/qoe'
import { fetchPlaybackInfo, submitTranscode, checkQuality, checkRate, acquireStream, releaseStream, buildHlsUrl } from '@/api/video'

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

// ===== HLS / 转码 / 权限 / QoE 状态 =====
const hlsInstance = ref(null)
const isHls = ref(false)
const transcodeHint = ref('')
const playbackInfo = ref(null)
const permission = ref({ maxVideoQuality: 360, maxPlaybackRate: 1, maxConcurrentStream: 1 })
const qualityMode = ref('auto')
const currentQualityHeight = ref(0)
let qoe = null
let acquireTimer = null
let transcodePollTimer = null

// 打开视频时若发现「还没有转码任务」，需要主动补提交一次。
// 后端 submit() 是幂等的（已有 QUEUED/RUNNING/DONE 任务会直接复用），
// 所以重复调用安全；这里用集合去重，避免同一个文件反复提交。
const autoSubmitted = new Set()
// 轮询上限：5s 一次 × 240 = 20 分钟，避免任务永远不落地时无限轮询
let transcodePollCount = 0
const TRANSCODE_POLL_MAX = 240

/**
 * 补提交转码。
 * 背景：任务不存在时后端返回 status=null，而 Number(null)===0 会被当成「排队中」，
 * 于是播放器显示「正在转码 0%」并永久轮询 —— 实际上根本没人去提交任务。
 */
const ensureTranscodeSubmitted = async (fileId) => {
  if (!fileId || autoSubmitted.has(fileId)) return
  autoSubmitted.add(fileId)
  try {
    await submitTranscode(fileId)
  } catch (e) {
    // 提交失败也允许后续再次尝试
    autoSubmitted.delete(fileId)
  }
}

/** video 标签的真实地址：HLS 就绪用 m3u8，否则回退原文件直连 */
const videoSrc = computed(() => {
  if (isHls.value && current.value) return buildHlsUrl(current.value.id)
  return current.value ? current.value.url : ''
})

/** 可用清晰度档位（带 VIP 锁定标记） */
const qualityOptions = computed(() => {
  const variants = playbackInfo.value?.variants || []
  const limit = Number(permission.value.maxVideoQuality || 360)
  return variants.map(v => {
    const height = Number(v.height || 0)
    return {
      height,
      label: `${height}p`,
      locked: height > limit
    }
  })
})

const qualityLabel = computed(() => {
  if (qualityOptions.value.length <= 1) {
    // 多档位转码尚未就绪：只有原画可看
    return '原画'
  }
  if (qualityMode.value === 'auto') {
    return currentQualityHeight.value ? `自动(${currentQualityHeight.value}p)` : '自动'
  }
  return `${qualityMode.value}p`
})

const maxRate = computed(() => Number(permission.value.maxPlaybackRate || 1))

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
  resetPlaybackSource()
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
    teardownPlayback()
  }
})

/** 切换文件时清掉上一个文件的 HLS / 转码轮询 / QoE 会话 */
const resetPlaybackSource = () => {
  teardownPlayback()
  isHls.value = false
  playbackInfo.value = null
  qualityMode.value = 'auto'
  currentQualityHeight.value = 0
  transcodeHint.value = ''
}

const teardownPlayback = () => {
  if (transcodePollTimer) {
    clearTimeout(transcodePollTimer)
    transcodePollTimer = null
  }
  if (acquireTimer) {
    clearTimeout(acquireTimer)
    acquireTimer = null
  }
  if (hlsInstance.value) {
    try { hlsInstance.value.destroy() } catch (e) { /* 忽略 */ }
    hlsInstance.value = null
  }
  if (qoe) {
    qoe.report()
    qoe = null
  }
  releaseCurrentStream()
}

/** 释放并发播放流 */
const releaseCurrentStream = () => {
  if (!qoe) return
  try {
    releaseStream(qoe.sessionId)
  } catch (e) { /* 忽略 */ }
}

/** 拉取转码状态与播放权限；未就绪时轮询等待 */
const preparePlayback = async () => {
  const fileId = current.value?.id
  if (!fileId) return
  try {
    const res = await fetchPlaybackInfo(fileId)
    const data = res?.data || {}
    playbackInfo.value = data
    if (data.permission) {
      permission.value = data.permission
    }
    if (data.hlsReady) {
      isHls.value = true
      transcodeHint.value = ''
      if (transcodePollTimer) {
        clearTimeout(transcodePollTimer)
        transcodePollTimer = null
      }
      startHls()
      return
    }
    // 未就绪：先直连原文件播，同时后台轮询转码进度
    isHls.value = false
    const rawStatus = data.status
    const status = rawStatus === null || rawStatus === undefined ? null : Number(rawStatus)
    transcodePollCount = 0
    if (status === 0 || status === 1) {
      transcodeHint.value = `正在转码 ${data.progress || 0}%，当前为原画质播放`
      scheduleTranscodePoll()
    } else if (status === 3) {
      // 失败：允许重新提交一次（后端幂等，FAILED 会重建任务）
      transcodeHint.value = '正在重新提交转码，当前为原画质播放'
      ensureTranscodeSubmitted(fileId)
      scheduleTranscodePoll()
    } else {
      // status 为 null = 从未提交过（老视频 / 上传时自动提交失败）→ 主动补提交
      transcodeHint.value = '正在启动转码，当前为原画质播放'
      ensureTranscodeSubmitted(fileId)
      scheduleTranscodePoll()
    }
  } catch (e) {
    /* 静默：接口异常时按直连原文件播放 */
    isHls.value = false
  }
}

const scheduleTranscodePoll = () => {
  if (transcodePollTimer) return
  transcodePollCount += 1
  if (transcodePollCount > TRANSCODE_POLL_MAX) {
    transcodeHint.value = '转码超时，当前为原画质播放'
    return
  }
  transcodePollTimer = setTimeout(async () => {
    transcodePollTimer = null
    if (!visible.value || !current.value) return
    try {
      const res = await fetchPlaybackInfo(current.value.id)
      const data = res?.data || {}
      playbackInfo.value = data
      if (data.permission) permission.value = data.permission
      if (data.hlsReady) {
        transcodeHint.value = '已切换至多清晰度播放'
        isHls.value = true
        startHls()
        setTimeout(() => { transcodeHint.value = '' }, 2600)
        return
      }
      const rawStatus = data.status
      const status = rawStatus === null || rawStatus === undefined ? null : Number(rawStatus)
      if (status === 0 || status === 1) {
        transcodeHint.value = `正在转码 ${data.progress || 0}%，当前为原画质播放`
        scheduleTranscodePoll()
      } else if (status === 3) {
        transcodeHint.value = '转码失败，当前为原画质播放'
      } else if (status === null) {
        // 仍无任务 → 再补提交一次（幂等），并受轮询上限保护
        if (transcodePollCount < TRANSCODE_POLL_MAX) {
          ensureTranscodeSubmitted(current.value.id)
          transcodeHint.value = '正在启动转码，当前为原画质播放'
          scheduleTranscodePoll()
        } else {
          transcodeHint.value = '转码启动超时，当前为原画质播放'
        }
      }
    } catch (e) {
      if (transcodePollCount < TRANSCODE_POLL_MAX) scheduleTranscodePoll()
    }
  }, 5000)
}

/** 建立 hls.js 实例（动态 import，未就绪/不支持时回退原生播放） */
const startHls = async () => {
  const el = videoEl.value
  if (!el || !current.value) return
  if (hlsInstance.value) {
    try { hlsInstance.value.destroy() } catch (e) { /* 忽略 */ }
    hlsInstance.value = null
  }
  const url = buildHlsUrl(current.value.id)

  // 原生支持 HLS（Safari / iOS）：直接用 src
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url
    el.load()
    el.play().catch(() => { playing.value = false })
    return
  }

  try {
    const mod = await import('hls.js')
    const Hls = mod.default || mod.Hls
    if (!Hls || !Hls.isSupported()) {
      isHls.value = false
      el.src = current.value.url
      el.load()
      el.play().catch(() => { playing.value = false })
      return
    }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 })
    hlsInstance.value = hls
    hls.attachMedia(el)
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(url)
    })
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      applyQualityPreference()
      // HLS 附着媒体后速率会被重置为 1.0，起播前必须重新应用用户选择的倍速
      applyRate()
      el.play().catch(() => { playing.value = false })
    })
    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
      const level = hls.levels[data.level]
      if (level) {
        currentQualityHeight.value = level.height || 0
        if (qoe) qoe.setQuality(qualityMode.value === 'auto' ? `${level.height}p` : `${qualityMode.value}p`)
      }
    })
    hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
      if (data?.details?.totalduration > 0 && data.details.fragments?.length) {
        const frag = data.details.fragments[0]
        if (frag?.duration > 0 && frag?.byteLength > 0) {
          if (qoe) qoe.sampleBitrate((frag.byteLength * 8) / frag.duration)
        }
      }
    })
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (data?.fatal) {
        ElMessage.warning('多清晰度播放异常，已切换原画质')
        isHls.value = false
        try { hls.destroy() } catch (e) { /* 忽略 */ }
        hlsInstance.value = null
        el.src = current.value.url
        el.load()
        el.play().catch(() => {})
      }
    })
  } catch (e) {
    isHls.value = false
    el.src = current.value.url
    el.load()
    el.play().catch(() => {})
  }
}

/**
 * 应用清晰度偏好：auto → 限制 maxLevel 到等级允许的最高档；
 * 指定档位 → 锁定该 level。超出权限直接提示（前端在这里先挡一层，后端仍会再校验）。
 */
const applyQualityPreference = () => {
  const hls = hlsInstance.value
  if (!hls) return
  const limit = Number(permission.value.maxVideoQuality || 360)
  if (qualityMode.value === 'auto') {
    let best = -1
    hls.levels.forEach((lv, idx) => {
      if ((lv.height || 0) <= limit) best = idx
    })
    hls.autoLevelCapping = best >= 0 ? best : 0
    hls.currentLevel = -1
  } else {
    const target = Number(qualityMode.value)
    let idx = -1
    hls.levels.forEach((lv, i) => {
      if (Number(lv.height) === target) idx = i
    })
    if (idx >= 0) hls.currentLevel = idx
  }
}

const setQuality = async (cmd) => {
  if (cmd === 'source') {
    ElMessage.info('多清晰度转码完成后即可切换')
    return
  }
  if (!isHls.value || !current.value) {
    ElMessage.info('多清晰度尚未就绪，当前为原画质')
    return
  }
  if (cmd === 'auto') {
    qualityMode.value = 'auto'
    applyQualityPreference()
    ElMessage.success('已切换为自动清晰度')
    return
  }
  const height = Number(cmd)
  try {
    await checkQuality(current.value.id, height)
  } catch (e) {
    ElMessage.warning(e?.message || '当前等级不支持该清晰度，请升级会员')
    return
  }
  qualityMode.value = height
  applyQualityPreference()
  ElMessage.success(`已切换为 ${height}p`)
}

/**
 * 统一应用倍速到 <video>。
 *
 * 关键点（修复「视频倍速调了没反应 / 进度条快了但画面仍是 1 倍」）：
 *  1. 同时写 playbackRate 与 defaultPlaybackRate —— 后者决定「换源 / load() / HLS
 *     重新附着媒体」后的初始速率。只写前者时，这些时机都会把速率重置回 1.0。
 *  2. preservesPitch 必须显式设为 true，避免变速变调；部分内核需带前缀属性名。
 *  3. HLS(MediaSource) 下同样有效：hls.js 只是换了个 source，<video> 仍由浏览器解码。
 */
const applyRate = () => {
  const el = videoEl.value
  if (!el) return
  const v = PLAY_RATES.includes(Number(rate.value)) ? Number(rate.value) : 1
  el.defaultPlaybackRate = v
  el.playbackRate = v
  if ('preservesPitch' in el) el.preservesPitch = true
  else if ('mozPreservesPitch' in el) el.mozPreservesPitch = true
  else if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true
}

const loadAndPlay = async () => {
  const el = videoEl.value
  if (!el) return
  el.volume = volume.value
  applyRate()

  // 每个文件新建一次 QoE 会话 + 并发流登记
  if (!qoe && current.value) {
    qoe = new QoeReporter({ fileId: current.value.id, playType: 'direct' })
    requestStreamSlot()
  }
  if (qoe) qoe.markLoadStart()

  await preparePlayback()

  if (!isHls.value) {
    el.load()
  }
  // load() / 换源会把速率重置为 1.0，这里在起播前再对齐一次
  applyRate()
  const promise = el.play()
  if (promise && typeof promise.catch === 'function') {
    // 浏览器自动播放策略可能拦截，此时保留暂停态由用户点击
    promise.catch(() => { playing.value = false })
  }
}

/** 登记并发播放流；超出上限时提示（不阻塞预览，仅提醒） */
const requestStreamSlot = async () => {
  if (!qoe) return
  try {
    const res = await acquireStream(qoe.sessionId)
    if (res?.data) permission.value = res.data
    if (qoe) qoe.playType = isHls.value ? 'hls' : 'direct'
    // HLS 就绪后可能才切换，延迟再同步一次
    acquireTimer = setTimeout(() => {
      if (qoe) qoe.playType = isHls.value ? 'hls' : 'direct'
    }, 4000)
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes('上限')) {
      ElMessage.warning(msg)
    }
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

const onPlay = () => {
  playing.value = true
  if (qoe) qoe.markPlaying()
  scheduleHide()
}

const onPause = () => {
  playing.value = false
  controlsVisible.value = true
  if (qoe) qoe.markPaused()
}

/** 缓冲/卡顿开始 */
const onWaiting = () => {
  buffering.value = true
  if (qoe) qoe.markStallStart()
}

/** 恢复播放 */
const onPlaying = () => {
  buffering.value = false
  if (qoe) {
    qoe.markStallEnd()
    qoe.markFirstFrame()
  }
}

const onCanPlay = () => {
  buffering.value = false
  applyRate()
  if (qoe) qoe.markFirstFrame()
}

const onVideoError = () => {
  // HLS 加载失败且当前是 HLS：回退原文件
  if (isHls.value && current.value) {
    isHls.value = false
    const el = videoEl.value
    if (el) {
      el.src = current.value.url
      el.load()
      el.play().catch(() => {})
    }
  }
}

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
  // 元数据就绪后（换源/HLS 附着后）速率可能被重置，这里兜底再对齐一次
  applyRate()
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
  resetPlaybackSource()
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

const setRate = async (value) => {
  const v = PLAY_RATES.includes(Number(value)) ? Number(value) : 1
  if (v > maxRate.value + 1e-6) {
    // 前端先挡一层，后端 /rate/check 仍会再校验（这里顺带给用户明确提示）
    try {
      if (current.value) await checkRate(current.value.id, v)
    } catch (e) {
      ElMessage.warning(e?.message || `当前等级最高支持 ${maxRate.value}x 倍速，请升级会员`)
      return
    }
  }
  rate.value = v
  // 走统一的 applyRate：同时写 defaultPlaybackRate，避免后续 load()/切源被重置回 1.0
  applyRate()
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

/**
 * 清晰度/倍速下拉展开期间保持控制条常显。
 * 菜单 teleport 到 body，控制条若按时隐藏，chip 消失但菜单还悬着，观感如同「无响应」。
 */
const onDropdownVisible = (show) => {
  if (show) {
    controlsVisible.value = true
    clearTimeout(hideTimer)
  } else {
    scheduleHide()
  }
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

// 关闭/刷新页面时用 sendBeacon 兜底上报 QoE，避免数据丢失
const onBeforeUnload = () => {
  if (qoe) qoe.reportOnUnload()
  if (qoe) {
    try { releaseStream(qoe.sessionId) } catch (e) { /* 忽略 */ }
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  detachKeys()
  window.removeEventListener('pointermove', onProgressMove)
  window.removeEventListener('pointerup', onProgressUp)
  window.removeEventListener('beforeunload', onBeforeUnload)
  savePosition()
  teardownPlayback()
})
</script>

<!-- 非 scoped：下拉菜单 teleport 到 body，必须在全局样式里压过 .vp-mask 的 z-index:3000，
     否则「清晰度 / 倍速」菜单被遮罩盖住，点击后看似无反应 -->
<style>
.vp-popper.el-popper {
  z-index: 3200 !important;
}
</style>

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

/* 三栏布局：左信息 / 中主按钮 / 右功能，主播放键始终水平居中 */
.vp-left-group {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vp-center-group {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
}

.vp-right-group {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

/* 居中的大号播放/暂停按钮 */
.vp-main-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
  font-size: 30px;
  transition: background-color 0.18s ease, transform 0.18s ease;
}

.vp-main-btn:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: scale(1.06);
}

.vp-main-btn:active {
  transform: scale(0.96);
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

/* 转码提示：右上角小徽标，不遮挡画面 */
.vp-transcode-hint {
  position: absolute;
  top: 66px;
  right: 22px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(20, 22, 28, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  pointer-events: none;
}

.vp-th-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f7b955;
  box-shadow: 0 0 0 0 rgba(247, 185, 85, 0.6);
  animation: vp-pulse 1.6s infinite;
}

@keyframes vp-pulse {
  0% { box-shadow: 0 0 0 0 rgba(247, 185, 85, 0.6); }
  70% { box-shadow: 0 0 0 7px rgba(247, 185, 85, 0); }
  100% { box-shadow: 0 0 0 0 rgba(247, 185, 85, 0); }
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
