<template>
  <div
    ref="petZone"
    class="cloud-pet"
    :class="{ 'is-hover': hovering, 'is-happy': happy }"
    role="img"
    aria-label="云盘轻宠：一朵会陪聊的云"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @click="onPet"
  >
    <!-- 台词气泡 -->
    <transition name="pet-bubble">
      <div v-if="bubbleText" class="pet-bubble">{{ bubbleText }}</div>
    </transition>

    <svg viewBox="0 0 120 100" class="pet-svg" aria-hidden="true">
      <defs>
        <linearGradient id="petBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d8f5ec" />
          <stop offset="100%" stop-color="#b2e8d9" />
        </linearGradient>
      </defs>

      <!-- 影子 -->
      <ellipse class="pet-shadow" cx="60" cy="90" rx="26" ry="5" fill="rgba(16, 118, 102, 0.16)" />

      <!-- 云朵身体 -->
      <g class="pet-body">
        <path
          d="M32 72 a16 16 0 0 1 -2 -31 a20 20 0 0 1 38 -8 a16 16 0 0 1 22 14 a13 13 0 0 1 -4 25 z"
          fill="url(#petBody)"
          stroke="#5ec6ae"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <!-- 腮红 -->
        <ellipse class="blush" cx="40" cy="62" rx="5" ry="3" fill="#ffb3ab" opacity="0.75" />
        <ellipse class="blush" cx="80" cy="62" rx="5" ry="3" fill="#ffb3ab" opacity="0.75" />

        <!-- 眼睛：开心时变 ^ ^，平时是会跟随鼠标的圆眼 -->
        <g v-if="happy" class="eye-happy">
          <path d="M46 54 q5 -6 10 0" stroke="#22574c" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M64 54 q5 -6 10 0" stroke="#22574c" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M55 66 q5 5 10 0" stroke="#22574c" stroke-width="2.4" fill="none" stroke-linecap="round" />
        </g>
        <g v-else class="eye-normal">
          <circle cx="51" cy="55" r="7.2" fill="#fff" stroke="#22574c" stroke-width="1.6" />
          <circle cx="69" cy="55" r="7.2" fill="#fff" stroke="#22574c" stroke-width="1.6" />
          <circle :cx="51 + pupil.x" :cy="55 + pupil.y" r="3.1" fill="#22574c" class="pupil" />
          <circle :cx="69 + pupil.x" :cy="55 + pupil.y" r="3.1" fill="#22574c" class="pupil" />
          <circle :cx="52 + pupil.x" :cy="53.6 + pupil.y" r="1" fill="#fff" />
          <circle :cx="70 + pupil.x" :cy="53.6 + pupil.y" r="1" fill="#fff" />
        </g>
      </g>

      <!-- hover / 点击时的星星碎片 -->
      <g v-if="happy || hovering" class="pet-sparks" aria-hidden="true">
        <path class="spark s1" d="M14 40 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" fill="#f7b955" />
        <path class="spark s2" d="M104 30 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 z" fill="#5ec6ae" />
        <path class="spark s3" d="M96 76 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z" fill="#f7b955" />
      </g>
    </svg>

    <div class="pet-name">
      云盘轻宠 · 轻朵
      <span class="pet-sub">{{ happy ? '呜哇，被戳中了！' : hovering ? '摸摸我，问我点什么' : '文件的事都归我管' }}</span>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const petZone = ref(null)
const hovering = ref(false)
const happy = ref(false)
const bubbleText = ref('')
const pupil = reactive({ x: 0, y: 0 })

let bubbleTimer = null
let happyTimer = null

const IDLE_TIPS = [
  '回收站里的文件 15 天就清了，重要文件记得恢复～',
  '提问前点左下角「+」钉住文件，我读得更准！',
  '我可以总结文档、定位文件、查你的分享～',
  '试试问我：回收站里哪些快过期？',
  '分享出去的链接随时可以取消哦',
  '累了就歇会儿，文件我看着呢 (¦3ꇤ[▓▓]'
]

const HOVER_TIPS = [
  '喵…不对，汪…也不对，反正我很乖',
  '把问题丢过来，我去翻文件',
  '今天也想被夸奖 (๑´ㅂ`๑)',
  '悄悄说：秒传的文件上传特别快'
]

const showBubble = (text, duration = 3600) => {
  bubbleText.value = text
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => {
    bubbleText.value = ''
  }, duration)
}

const onEnter = () => {
  hovering.value = true
  showBubble(HOVER_TIPS[Math.floor(Math.random() * HOVER_TIPS.length)], 2600)
}

const onLeave = () => {
  hovering.value = false
}

const onPet = () => {
  happy.value = true
  showBubble(IDLE_TIPS[Math.floor(Math.random() * IDLE_TIPS.length)], 3800)
  clearTimeout(happyTimer)
  happyTimer = setTimeout(() => {
    happy.value = false
  }, 1400)
}

// 眼珠轻微跟随鼠标（限制在 ±2.2 视野内，保持克制）
const onMouseMove = (event) => {
  const zone = petZone.value
  if (!zone) return
  const rect = zone.getBoundingClientRect()
  const dx = event.clientX - (rect.left + rect.width / 2)
  const dy = event.clientY - (rect.top + rect.height * 0.55)
  const dist = Math.max(1, Math.hypot(dx, dy))
  const clamp = Math.min(1, dist / 220)
  pupil.x = (dx / dist) * 2.2 * clamp
  pupil.y = (dy / dist) * 1.8 * clamp
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  // 待机时偶尔自己冒一句
  setInterval(() => {
    if (!hovering.value && !happy.value && Math.random() < 0.45) {
      showBubble(IDLE_TIPS[Math.floor(Math.random() * IDLE_TIPS.length)], 3200)
    }
  }, 14000)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  clearTimeout(bubbleTimer)
  clearTimeout(happyTimer)
})
</script>

<style scoped>
.cloud-pet {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 12px 10px;
  border-radius: 16px;
  background: linear-gradient(165deg, #f2fbf8, #e4f6f0);
  border: 1px dashed rgba(94, 198, 174, 0.65);
  cursor: default;
  user-select: none;
  overflow: visible;
}

.pet-svg {
  width: 118px;
  height: 98px;
}

.pet-body {
  transform-origin: 60px 72px;
  animation: pet-float 4.2s ease-in-out infinite;
}

.is-hover .pet-body {
  animation: pet-float 4.2s ease-in-out infinite, pet-wiggle 0.7s ease-in-out infinite;
}

.is-happy .pet-body {
  animation: pet-bounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 2;
}

.pet-shadow {
  animation: pet-shadow 4.2s ease-in-out infinite;
  transform-origin: 60px 90px;
}

/* 眨眼：用 scaleY 压扁瞳孔 */
.pupil {
  animation: pet-blink 4.6s infinite;
  transform-origin: center;
  transform-box: fill-box;
}

.spark {
  opacity: 0;
  transform-origin: center;
  transform-box: fill-box;
}

.is-happy .spark,
.is-hover .spark {
  animation: pet-spark 1.1s ease-in-out infinite;
}

.is-happy .spark.s2,
.is-hover .spark.s2 { animation-delay: 0.18s; }
.is-happy .spark.s3,
.is-hover .spark.s3 { animation-delay: 0.36s; }

.pet-name {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 12.5px;
  font-weight: 700;
  color: #1d6a5a;
  letter-spacing: 0.02em;
}

.pet-sub {
  font-size: 11px;
  font-weight: 400;
  color: #6b9d90;
}

/* 台词气泡 */
.pet-bubble {
  position: absolute;
  top: -6px;
  right: -8px;
  z-index: 3;
  max-width: 200px;
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
  background: #ffffff;
  border: 1px solid rgba(94, 198, 174, 0.55);
  box-shadow: 0 8px 22px rgba(16, 118, 102, 0.14);
  color: #1d6a5a;
  font-size: 12px;
  line-height: 1.55;
  pointer-events: none;
}

.pet-bubble-enter-active,
.pet-bubble-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pet-bubble-enter-from,
.pet-bubble-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

@keyframes pet-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4.5px); }
}

@keyframes pet-shadow {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  50% { transform: scaleX(0.9); opacity: 0.7; }
}

@keyframes pet-wiggle {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-6px) rotate(-2.5deg); }
  70% { transform: translateY(-2px) rotate(2deg); }
}

@keyframes pet-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  35% { transform: translateY(-11px) scale(1.05, 0.96); }
  60% { transform: translateY(0) scale(0.98, 1.03); }
}

@keyframes pet-blink {
  0%, 91%, 100% { transform: scaleY(1); }
  94%, 97% { transform: scaleY(0.08); }
}

@keyframes pet-spark {
  0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(24deg); }
}

@media (prefers-reduced-motion: reduce) {
  .pet-body,
  .pet-shadow,
  .pupil,
  .spark {
    animation: none !important;
  }
}
</style>
