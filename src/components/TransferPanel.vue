<template>
  <div
    class="transfer-dock"
    :class="{ 'with-player': player.hasTrack, 'is-dragging': dragging, docked: !hasCustomPos }"
    :style="dockStyle"
  >
    <!-- 展开面板 -->
    <transition name="tp-slide">
      <div v-if="store.panelVisible" class="tp-panel" :class="{ 'flip-x': flippedX, 'flip-y': flippedY }">
        <header class="tp-head">
          <div class="tp-title">
            <span>传输列表</span>
            <span v-if="store.runningCount" class="tp-speed">{{ formatBytes(store.totalSpeed) }}/s</span>
          </div>
          <div class="tp-head-actions">
            <button v-if="store.finishedTasks.length" class="tp-text-btn" @click="store.clearFinished()">
              清除已完成
            </button>
            <button class="tp-icon-btn" title="收起" @click="store.panelVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </header>

        <div class="tp-body">
          <div v-for="task in store.tasks" :key="task.id" class="tp-item">
            <div class="tp-item-icon" :class="task.kind">
              <el-icon><Upload v-if="task.kind === 'upload'" /><Download v-else /></el-icon>
            </div>

            <div class="tp-item-main">
              <div class="tp-item-top">
                <span class="tp-item-name" :title="task.name">{{ task.name }}</span>
                <span class="tp-item-percent">{{ percent(task) }}%</span>
              </div>
              <div class="tp-bar">
                <div
                  class="tp-bar-inner"
                  :class="task.status"
                  :style="{ width: percent(task) + '%' }"
                ></div>
              </div>
              <div class="tp-item-sub">
                <span class="tp-item-status" :class="task.status">{{ statusText(task) }}</span>
                <span v-if="task.status === 'success' && task.instant" class="tp-tag">秒传</span>
                <span v-else-if="task.status === 'running' && task.phase" class="tp-tag muted">{{ task.phase }}</span>
              </div>
            </div>

            <div class="tp-item-actions">
              <button
                v-if="task.status === 'running' && task.pausable"
                class="tp-act"
                title="暂停"
                @click="store.pauseTask(task.id)"
              >
                <el-icon><VideoPause /></el-icon>
              </button>
              <button
                v-else-if="task.status === 'paused'"
                class="tp-act"
                title="继续"
                @click="store.resumeTask(task.id)"
              >
                <el-icon><VideoPlay /></el-icon>
              </button>
              <button
                v-else-if="task.status === 'error' && task.retryable"
                class="tp-act"
                title="重试"
                @click="store.retryTask(task.id)"
              >
                <el-icon><RefreshRight /></el-icon>
              </button>
              <button
                v-if="task.status === 'running' || task.status === 'paused' || task.status === 'waiting'"
                class="tp-act"
                title="取消"
                @click="store.cancelTask(task.id)"
              >
                <el-icon><CloseBold /></el-icon>
              </button>
              <button
                v-else-if="task.status !== 'running'"
                class="tp-act"
                title="从列表移除"
                @click="store.removeTask(task.id)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>

          <div v-if="!store.tasks.length" class="tp-empty">暂无传输任务</div>
        </div>
      </div>
    </transition>

    <!-- 悬浮入口（可拖动换位；单击切换面板） -->
    <button
      class="tp-fab"
      :class="{ busy: store.activeCount > 0, 'flip-y-anchor': flippedY }"
      :title="(store.activeCount ? `${store.activeCount} 个任务进行中` : '传输列表') + '（可拖动）'"
      @pointerdown="onFabPointerDown"
      @click="onFabClick"
    >
      <el-icon><Sort /></el-icon>
      <span v-if="store.activeCount" class="tp-badge">{{ store.activeCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Close, CloseBold, Delete, Download, RefreshRight, Sort, Upload, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { useTransferStore } from '@/stores/transfer'
import { usePlayerStore } from '@/stores/player'
import { formatBytes } from '@/utils/format'

const store = useTransferStore()
const player = usePlayerStore()

// ===== 悬浮图标拖动 =====
const POS_KEY = 'lightdisk.transfer.fab.pos'
const FAB_SIZE = 48
const MARGIN = 8

/** 读取已保存的位置（相对视口左上角的 left/top） */
const loadPos = () => {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (Number.isFinite(p?.left) && Number.isFinite(p?.top)) return { left: p.left, top: p.top }
  } catch (e) { /* 忽略 */ }
  return null
}

const customPos = ref(loadPos())
const dragging = ref(false)
const hasCustomPos = computed(() => !!customPos.value)

/** 依位置计算面板向上/向左展开方向，避免超出视口 */
const flippedX = computed(() => {
  if (!customPos.value) return false
  return customPos.value.left < 420
})
const flippedY = computed(() => {
  if (!customPos.value) return false
  return customPos.value.top < 300
})

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const dockStyle = computed(() => {
  if (!customPos.value) return {}
  return { left: `${customPos.value.left}px`, top: `${customPos.value.top}px`, right: 'auto', bottom: 'auto' }
})

let startX = 0
let startY = 0
let originLeft = 0
let originTop = 0
let moved = false
let pointerId = null

const onFabPointerDown = (evt) => {
  // 右键 / 非主键忽略
  if (evt.button !== undefined && evt.button !== 0) return
  const el = evt.currentTarget
  const rect = el.getBoundingClientRect()
  dragging.value = true
  moved = false
  pointerId = evt.pointerId
  startX = evt.clientX
  startY = evt.clientY
  originLeft = rect.left
  originTop = rect.top
  try { el.setPointerCapture(pointerId) } catch (e) { /* 忽略 */ }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

const onPointerMove = (evt) => {
  if (!dragging.value) return
  const dx = evt.clientX - startX
  const dy = evt.clientY - startY
  if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return
  moved = true
  const maxLeft = window.innerWidth - FAB_SIZE - MARGIN
  const maxTop = window.innerHeight - FAB_SIZE - MARGIN
  customPos.value = {
    left: clamp(originLeft + dx, MARGIN, Math.max(MARGIN, maxLeft)),
    top: clamp(originTop + dy, MARGIN, Math.max(MARGIN, maxTop))
  }
}

const onPointerUp = () => {
  if (!dragging.value) return
  dragging.value = false
  if (pointerId !== null) {
    try { document.querySelector('.tp-fab')?.releasePointerCapture(pointerId) } catch (e) { /* 忽略 */ }
    pointerId = null
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (moved && customPos.value) {
    try { localStorage.setItem(POS_KEY, JSON.stringify(customPos.value)) } catch (e) { /* 忽略 */ }
  }
}

/** 拖动结束后紧接着的 click 不当作「切换面板」，避免误触 */
const onFabClick = () => {
  if (moved) {
    moved = false
    return
  }
  store.panelVisible = !store.panelVisible
}

// 窗口缩放时把浮动图标拉回可视区域内
const onResize = () => {
  if (!customPos.value) return
  const maxLeft = window.innerWidth - FAB_SIZE - MARGIN
  const maxTop = window.innerHeight - FAB_SIZE - MARGIN
  customPos.value = {
    left: clamp(customPos.value.left, MARGIN, Math.max(MARGIN, maxLeft)),
    top: clamp(customPos.value.top, MARGIN, Math.max(MARGIN, maxTop))
  }
}
window.addEventListener('resize', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('resize', onResize)
})

const percent = (task) => {
  if (task.status === 'success') return 100
  if (!task.size) return 0
  return Math.min(100, Math.round((task.loaded / task.size) * 100))
}

const STATUS_LABEL = {
  waiting: '等待中',
  paused: '已暂停',
  canceled: '已取消'
}

const statusText = (task) => {
  if (task.status === 'running') {
    const done = formatBytes(task.loaded)
    const total = task.size ? formatBytes(task.size) : '未知大小'
    const speed = task.speed ? ` · ${formatBytes(task.speed)}/s` : ''
    return `${done} / ${total}${speed}`
  }
  if (task.status === 'success') {
    return task.size ? formatBytes(task.size) : '已完成'
  }
  if (task.status === 'error') {
    return task.error || '传输失败'
  }
  return STATUS_LABEL[task.status] || ''
}
</script>

<style scoped>
.transfer-dock {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 2200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

/* 未拖动过：沿用右下角默认定位；拖动后由内联 left/top 接管 */
.transfer-dock:not(.docked) {
  right: auto;
  bottom: auto;
}

/* 音频播放条占据底部时上移，避免遮挡 */
.transfer-dock.docked.with-player {
  bottom: 92px;
}

.transfer-dock.is-dragging {
  z-index: 2600;
}

.tp-fab {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  color: var(--text-secondary);
  box-shadow: var(--shadow-soft);
  cursor: grab;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: transform 0.16s ease, color 0.16s ease;
}

.transfer-dock.is-dragging .tp-fab {
  cursor: grabbing;
  transform: scale(1.06);
}

.tp-fab:hover {
  transform: translateY(-2px);
  color: var(--accent);
}

.tp-fab.busy {
  color: var(--accent);
}

.tp-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  line-height: 19px;
  text-align: center;
  font-weight: 600;
}

.tp-panel {
  width: 400px;
  max-height: 460px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* 图标拖到左侧时面板靠左对齐，避免超出右边界 */
.transfer-dock:not(.docked) .tp-panel.flip-x {
  align-self: flex-start;
}

/* 图标拖到上方时面板向下展开（放在 FAB 下方），避免超出顶部 */
.transfer-dock:not(.docked) .tp-panel.flip-y {
  order: 2;
}

.transfer-dock:not(.docked) .tp-fab.flip-y-anchor {
  order: 1;
}

.tp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.tp-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.tp-speed {
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
}

.tp-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tp-text-btn,
.tp-icon-btn,
.tp-act {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}

.tp-text-btn {
  font-size: 12px;
  padding: 3px 8px;
}

.tp-icon-btn {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.tp-text-btn:hover,
.tp-icon-btn:hover,
.tp-act:hover {
  background: var(--surface-strong);
  color: var(--accent);
}

.tp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.tp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
}

.tp-item:hover {
  background: var(--surface-muted);
}

.tp-item-icon {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  background: var(--accent-soft);
  color: var(--accent);
}

.tp-item-icon.download {
  background: rgba(64, 158, 255, 0.14);
  color: #409eff;
}

.tp-item-main {
  flex: 1;
  min-width: 0;
}

.tp-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tp-item-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-item-percent {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.tp-bar {
  margin: 5px 0 4px;
  height: 5px;
  border-radius: 3px;
  background: var(--surface-strong);
  overflow: hidden;
}

.tp-bar-inner {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.2s linear;
}

.tp-bar-inner.error {
  background: #f56c6c;
}

.tp-bar-inner.canceled {
  background: var(--text-muted);
}

.tp-bar-inner.paused {
  background: #e6a23c;
}

.tp-item-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.tp-item-status.error {
  color: #f56c6c;
}

.tp-item-status.success {
  color: var(--accent);
}

.tp-tag {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10.5px;
}

.tp-tag.muted {
  background: var(--surface-strong);
  color: var(--text-secondary);
}

.tp-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.tp-act {
  width: 26px;
  height: 26px;
  font-size: 14px;
}

.tp-empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.tp-slide-enter-active,
.tp-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tp-slide-enter-from,
.tp-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
