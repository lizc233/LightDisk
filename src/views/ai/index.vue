<template>
  <div class="ai-page">
    <section class="hero-card">
      <div>
        <p class="eyebrow">LightDisk Intelligent Workspace</p>
        <h1>LightDisk AI 助手</h1>
        <p class="hero-desc">
          面向文件检索与知识问答场景，支持 Query 改写、多路召回、结果重排、来源回显和上下文辅助分析。
        </p>
      </div>
      <div class="hero-actions">
        <el-tag type="success" effect="plain">文件智能检索</el-tag>
        <el-tag effect="plain">问答可追溯</el-tag>
        <el-tag type="warning" effect="plain">多策略协同</el-tag>
      </div>
    </section>

    <div class="ai-layout">
      <section class="chat-card">
        <div class="chat-head">
          <div>
            <h2>对话窗口</h2>
            <p>支持文件定位、回收站提醒、分享检索和 RAG/Agent 面试问答。</p>
          </div>
          <el-button text @click="resetConversation">清空对话</el-button>
        </div>

        <div ref="chatWindow" class="chat-window">
          <div
            v-for="(msg, index) in messageList"
            :key="index"
            class="message-row"
            :class="msg.role === 'user' ? 'is-user' : 'is-ai'"
          >
            <el-avatar
              :size="38"
              :icon="msg.role === 'user' ? User : MagicStick"
              :src="msg.role === 'user' ? userStore.userInfo?.avatar : ''"
              class="avatar"
            />
            <div class="bubble">
              <div class="bubble-role">{{ msg.role === 'user' ? '你' : 'LightDisk AI' }}</div>
              <div class="bubble-content" v-html="msg.content"></div>
            </div>
          </div>

          <div v-if="isThinking" class="message-row is-ai">
            <el-avatar :size="38" :icon="MagicStick" class="avatar" />
            <div class="bubble thinking-bubble">
              <div class="bubble-role">LightDisk AI</div>
              <div class="thinking-status">{{ thinkingStatus }}</div>
              <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="composer">
          <div class="quick-prompts">
            <el-button
              v-for="prompt in quickPrompts"
              :key="prompt"
              size="small"
              round
              @click="insertPrompt(prompt)"
            >
              {{ prompt }}
            </el-button>
          </div>

          <div class="composer-box">
            <el-input
              v-model="inputText"
              type="textarea"
              resize="none"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 4 }"
              placeholder="例如：帮我找实训报告、回收站里哪些快过期、为什么 RAG 要做 Query 改写"
              @keydown.enter.prevent="sendMessage"
            />
            <el-button type="primary" class="send-btn" :disabled="!inputText.trim() || isThinking" @click="sendMessage">
              发送
            </el-button>
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <section class="panel-card">
          <div class="panel-title-row">
            <h3>执行轨迹</h3>
            <span class="trace-summary">{{ traceSummary || '等待一次提问' }}</span>
          </div>
          <div class="stage-list">
            <div v-for="stage in traceStages" :key="stage.key" class="stage-item">
              <div class="stage-label">{{ stage.label }}</div>
              <div class="stage-detail">{{ stage.detail }}</div>
            </div>
          </div>
        </section>

        <section class="panel-card">
          <h3>来源回显</h3>
          <div v-if="currentSources.length" class="source-list">
            <div v-for="source in currentSources" :key="`${source.sourceType}-${source.sourceId}`" class="source-item">
              <div class="source-title">{{ source.title }}</div>
              <div class="source-path">{{ source.path }}</div>
              <div class="source-summary">{{ source.summary }}</div>
            </div>
          </div>
          <div v-else class="empty-tip">当前回答没有数据库来源，通常是知识卡或降级回答。</div>
        </section>

        <section class="panel-card">
          <h3>能力标签</h3>
          <div class="capability-list">
            <div v-for="card in capabilityCards" :key="card.title" class="capability-item">
              <div class="capability-title">{{ card.title }}</div>
              <div class="capability-summary">{{ card.summary }}</div>
              <div class="capability-detail">{{ card.detail }}</div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, User } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const chatWindow = ref(null)
const inputText = ref('')
const isThinking = ref(false)
const thinkingStatus = ref('AI thinking...')
const traceSummary = ref('')
const traceStages = ref([])
const currentSources = ref([])
const capabilityCards = ref([])
const quickPrompts = ref([
  '帮我找实训报告在哪里',
  '回收站里有哪些快过期文件',
  '我分享过哪些文件',
  '为什么 RAG 要做 Query 改写'
])

const messageList = ref([])
let thinkingTimer = null
let thinkingIndex = 0

const thinkingSteps = [
  'AI thinking...',
  'query rewriting...',
  'searching multi-index...',
  'reranking candidates...',
  'answering with sources...'
]

const welcomeMessage = () => ({
  role: 'ai',
  content: `你好，${userStore.userInfo?.username || '同学'}。<br>这里可以直接处理文件定位、分享检索、回收站提醒和知识问答。<br><br>你可以直接问：<br>1. 帮我找某个文档在哪里<br>2. 回收站里哪些文件快过期<br>3. 我分享过哪些文件<br>4. 为什么 RAG 要做 Query 改写`
})

const resetConversation = () => {
  stopThinkingAnimation()
  isThinking.value = false
  thinkingStatus.value = 'AI thinking...'
  traceSummary.value = ''
  traceStages.value = []
  currentSources.value = []
  capabilityCards.value = []
  messageList.value = [welcomeMessage()]
}

const insertPrompt = (prompt) => {
  inputText.value = prompt
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatWindow.value) {
    chatWindow.value.scrollTop = chatWindow.value.scrollHeight
  }
}

const startThinkingAnimation = () => {
  stopThinkingAnimation()
  thinkingIndex = 0
  thinkingStatus.value = thinkingSteps[thinkingIndex]
  thinkingTimer = setInterval(() => {
    thinkingIndex = (thinkingIndex + 1) % thinkingSteps.length
    thinkingStatus.value = thinkingSteps[thinkingIndex]
  }, 550)
}

const stopThinkingAnimation = () => {
  if (thinkingTimer) {
    clearInterval(thinkingTimer)
    thinkingTimer = null
  }
}

const sendMessage = async () => {
  const query = inputText.value.trim()
  if (!query || isThinking.value) {
    return
  }

  messageList.value.push({
    role: 'user',
    content: query
  })
  inputText.value = ''
  isThinking.value = true
  startThinkingAnimation()
  await scrollToBottom()

  try {
    const res = await request.post('/ai/chat', { query, topK: 5 })
    const data = res.data || {}

    messageList.value.push({
      role: 'ai',
      content: data.answer || '当前没有返回内容。'
    })
    traceSummary.value = data.traceSummary || ''
    traceStages.value = data.stages || []
    currentSources.value = data.sources || []
    capabilityCards.value = data.capabilityCards || []
    if (Array.isArray(data.followUpQuestions) && data.followUpQuestions.length) {
      quickPrompts.value = data.followUpQuestions
    }
  } catch (error) {
    ElMessage.error('AI 助手请求失败')
  } finally {
    stopThinkingAnimation()
    isThinking.value = false
    thinkingStatus.value = 'AI thinking...'
    await scrollToBottom()
  }
}

onMounted(() => {
  resetConversation()
})

onBeforeUnmount(() => {
  stopThinkingAnimation()
})
</script>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
  height: calc(100vh - 154px);
  min-height: 0;
  overflow: hidden;
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.18), transparent 32%),
    linear-gradient(135deg, var(--surface-strong), var(--surface-solid) 52%, var(--surface-muted));
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.7rem);
}

.hero-desc {
  max-width: 760px;
  margin: 8px 0 0;
  line-height: 1.6;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.8fr);
  gap: 20px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-card,
.panel-card {
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(14px);
}

.chat-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.chat-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
}

.chat-head h2,
.panel-card h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.chat-head p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.chat-window {
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  background:
    linear-gradient(180deg, var(--surface-muted), var(--surface-solid));
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  max-width: 88%;
}

.message-row.is-user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #fff;
}

.message-row.is-user .avatar {
  background: linear-gradient(135deg, #2563eb, #38bdf8);
}

.bubble {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.message-row.is-user .bubble {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #eff6ff;
}

.bubble-role {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.message-row.is-user .bubble-role {
  color: rgba(219, 234, 254, 0.86);
}

.bubble-content {
  line-height: 1.8;
  color: var(--text-primary);
  word-break: break-word;
}

.message-row.is-user .bubble-content {
  color: #fff;
}

.thinking-bubble {
  min-width: 320px;
}

.thinking-status {
  font-size: 14px;
  color: var(--text-primary);
}

.thinking-dots {
  display: inline-flex;
  gap: 6px;
  margin-top: 12px;
}

.thinking-dots span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #22c55e;
  animation: blink 1.2s infinite ease-in-out;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.composer {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-solid);
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.composer-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: end;
}

.send-btn {
  min-width: 92px;
  height: 42px;
  border-radius: 14px;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.panel-card {
  padding: 22px;
}

.panel-title-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trace-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.stage-list,
.source-list,
.capability-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.stage-item,
.source-item,
.capability-item {
  padding: 14px 15px;
  border-radius: 16px;
  background: linear-gradient(180deg, var(--surface-muted), var(--surface-solid));
  border: 1px solid var(--border-color);
}

.stage-label,
.source-title,
.capability-title {
  font-weight: 700;
  color: var(--text-primary);
}

.stage-detail,
.source-path,
.source-summary,
.capability-summary,
.capability-detail,
.empty-tip {
  margin-top: 6px;
  line-height: 1.65;
  color: var(--text-secondary);
}

.source-path {
  color: var(--accent);
  word-break: break-all;
}

@keyframes blink {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.45;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 1080px) {
  .ai-page {
    height: auto;
    overflow: visible;
  }

  .ai-layout {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .side-panel {
    overflow: visible;
    padding-right: 0;
  }
}

@media (max-width: 760px) {
  .hero-card {
    flex-direction: column;
    padding: 18px;
  }

  .chat-card {
    min-height: 620px;
  }

  .composer-box {
    grid-template-columns: 1fr;
  }

  .send-btn {
    width: 100%;
  }

  .message-row {
    max-width: 100%;
  }
}
</style>
