<template>
  <teleport to="body">
    <transition name="gallery-fade">
      <div v-if="modelValue" class="gallery-mask" @click.self="close">
        <!-- 顶部信息与工具条 -->
        <div class="gallery-top">
          <div class="gallery-title">
            <span class="gallery-name" :title="current?.name">{{ current?.name || '' }}</span>
            <span class="gallery-counter">{{ images.length ? index + 1 : 0 }} / {{ images.length }}</span>
          </div>
          <div class="gallery-tools">
            <button class="tool-btn" title="缩小" :disabled="scale <= MIN_SCALE" @click="zoomBy(-0.25)">
              <el-icon><ZoomOut /></el-icon>
            </button>
            <span class="tool-scale">{{ Math.round(scale * 100) }}%</span>
            <button class="tool-btn" title="放大" :disabled="scale >= MAX_SCALE" @click="zoomBy(0.25)">
              <el-icon><ZoomIn /></el-icon>
            </button>
            <button class="tool-btn" title="重置" @click="resetTransform">
              <el-icon><RefreshRight /></el-icon>
            </button>
            <button class="tool-btn" title="向左旋转 90°" @click="rotate(-90)">
              <el-icon><RefreshLeft /></el-icon>
            </button>
            <button class="tool-btn" title="向右旋转 90°" @click="rotate(90)">
              <el-icon><Refresh /></el-icon>
            </button>
            <button
              class="tool-btn"
              :class="{ on: playing }"
              :title="playing ? '暂停幻灯片' : '播放幻灯片'"
              @click="togglePlay"
            >
              <el-icon><VideoPause v-if="playing" /><VideoPlay v-else /></el-icon>
            </button>
            <button class="tool-btn" title="退出（Esc）" @click="close">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>

        <!-- 主画布 -->
        <div
          class="gallery-stage"
          @wheel.prevent="onWheel"
          @mousedown="startDrag"
          @mousemove="onDrag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
        >
          <button v-if="images.length > 1" class="nav-btn prev" title="上一张（←）" @click.stop="prev">
            <el-icon><ArrowLeftBold /></el-icon>
          </button>

          <img
            v-if="current"
            class="gallery-image"
            :class="{ dragging: dragging }"
            :src="current.url"
            :alt="current.name"
            :style="imageStyle"
            draggable="false"
            @dblclick="resetTransform"
          />
          <div v-else class="gallery-empty">没有可预览的图片</div>

          <button v-if="images.length > 1" class="nav-btn next" title="下一张（→）" @click.stop="next">
            <el-icon><ArrowRightBold /></el-icon>
          </button>
        </div>

        <!-- 底部缩略图条 -->
        <div v-if="images.length > 1" class="gallery-strip" @click.stop>
          <div
            v-for="(item, i) in images"
            :key="item.key || item.id || i"
            class="strip-item"
            :class="{ active: i === index }"
            @click="go(i)"
          >
            <img :src="item.thumbUrl || item.url" :alt="item.name" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowLeftBold,
  ArrowRightBold,
  Close,
  Refresh,
  RefreshLeft,
  RefreshRight,
  VideoPause,
  VideoPlay,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  images: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 }
})
const emit = defineEmits(['update:modelValue'])

const MIN_SCALE = 0.5
const MAX_SCALE = 5
const SLIDE_INTERVAL = 3000

const index = ref(0)
const scale = ref(1)
const rotation = ref(0)
const offset = ref({ x: 0, y: 0 })
const playing = ref(false)
const dragging = ref(false)
const dragOrigin = ref({ x: 0, y: 0, ox: 0, oy: 0 })

let slideTimer = null

const current = computed(() => props.images[index.value] || null)

const imageStyle = computed(() => ({
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  transition: dragging.value ? 'none' : 'transform 0.22s ease'
}))

const close = () => emit('update:modelValue', false)

const go = (target) => {
  if (!props.images.length) return
  const total = props.images.length
  index.value = ((target % total) + total) % total
  resetTransform()
}

const prev = () => go(index.value - 1)
const next = () => go(index.value + 1)

const zoomBy = (delta) => {
  const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((scale.value + delta).toFixed(2))))
  scale.value = nextScale
  if (nextScale <= 1) offset.value = { x: 0, y: 0 }
}

const onWheel = (event) => {
  zoomBy(event.deltaY < 0 ? 0.15 : -0.15)
}

const rotate = (deg) => {
  rotation.value = (rotation.value + deg) % 360
}

const resetTransform = () => {
  scale.value = 1
  rotation.value = 0
  offset.value = { x: 0, y: 0 }
}

const startDrag = (event) => {
  if (scale.value <= 1 && rotation.value === 0) return
  dragging.value = true
  dragOrigin.value = { x: event.clientX, y: event.clientY, ox: offset.value.x, oy: offset.value.y }
}

const onDrag = (event) => {
  if (!dragging.value) return
  offset.value = {
    x: dragOrigin.value.ox + (event.clientX - dragOrigin.value.x),
    y: dragOrigin.value.oy + (event.clientY - dragOrigin.value.y)
  }
}

const endDrag = () => {
  dragging.value = false
}

const stopPlay = () => {
  playing.value = false
  if (slideTimer) {
    clearInterval(slideTimer)
    slideTimer = null
  }
}

const togglePlay = () => {
  if (playing.value) {
    stopPlay()
    return
  }
  playing.value = true
  slideTimer = setInterval(() => {
    if (props.images.length > 1) next()
  }, SLIDE_INTERVAL)
}

watch(() => props.modelValue, (visible) => {
  if (visible) {
    index.value = Math.min(Math.max(props.startIndex, 0), Math.max(props.images.length - 1, 0))
    resetTransform()
    window.addEventListener('keydown', onKeydown)
  } else {
    stopPlay()
    window.removeEventListener('keydown', onKeydown)
  }
})

const onKeydown = (event) => {
  if (!props.modelValue) return
  switch (event.key) {
    case 'Escape': close(); break
    case 'ArrowLeft': prev(); break
    case 'ArrowRight': next(); break
    case ' ':
      event.preventDefault()
      togglePlay()
      break
    default: break
  }
}

onBeforeUnmount(() => {
  stopPlay()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.gallery-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: rgba(8, 11, 16, 0.94);
  backdrop-filter: blur(6px);
}

.gallery-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  color: #e8eef7;
  flex-shrink: 0;
}

.gallery-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.gallery-name {
  font-size: 15px;
  font-weight: 600;
  max-width: 46vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-counter {
  font-size: 12.5px;
  color: rgba(232, 238, 247, 0.62);
  flex-shrink: 0;
}

.gallery-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.1);
  color: #e8eef7;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.22);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool-btn.on {
  background: #0061fe;
}

.tool-scale {
  min-width: 52px;
  text-align: center;
  font-size: 12.5px;
  color: rgba(232, 238, 247, 0.75);
}

.gallery-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
}

.gallery-stage:active {
  cursor: grabbing;
}

.gallery-image {
  max-width: 88vw;
  max-height: 74vh;
  user-select: none;
  transform-origin: center center;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
  border-radius: 6px;
}

.gallery-image.dragging {
  cursor: grabbing;
}

.gallery-empty {
  color: rgba(232, 238, 247, 0.6);
  font-size: 14px;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.26);
}

.nav-btn.prev {
  left: 26px;
}

.nav-btn.next {
  right: 26px;
}

.gallery-strip {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 12px 20px 18px;
  overflow-x: auto;
}

.strip-item {
  width: 62px;
  height: 62px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  opacity: 0.6;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.08);
}

.strip-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.strip-item:hover {
  opacity: 0.9;
}

.strip-item.active {
  opacity: 1;
  border-color: #0061fe;
}

.gallery-fade-enter-active,
.gallery-fade-leave-active {
  transition: opacity 0.2s ease;
}

.gallery-fade-enter-from,
.gallery-fade-leave-to {
  opacity: 0;
}
</style>
