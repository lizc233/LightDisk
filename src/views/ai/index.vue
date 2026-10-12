<template>
  <div class="ai-page">
    <div class="ai-layout">
      <section class="chat-card">
        <div class="chat-head">
          <div class="chat-head-main">
            <p class="chat-eyebrow">LIGHTDISK AI</p>
            <div class="chat-title-row">
              <h2 class="chat-title">AI 助手</h2>
              <el-tag :type="aiStatus.online ? 'success' : 'info'" effect="plain" size="small" round>
                {{ aiStatus.online ? `在线 · ${aiStatus.model}` : '离线规则引擎' }}
              </el-tag>
              <el-tag effect="plain" size="small" round>{{ aiStatus.userLevelName || '普通用户' }}</el-tag>
            </div>
            <p class="chat-sub">文件定位 · 内容总结 · 文件改写 · 知识问答，回答经复核 Agent 校验。</p>
          </div>
          <el-button text size="small" @click="resetConversation">清空对话</el-button>
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

          <!-- 已点选的云盘文件（作为回答上下文） -->
          <div v-if="pickedFile" class="picked-file-chip">
            <el-icon><Document /></el-icon>
            <span class="chip-name">{{ pickedFile.name }}</span>
            <el-icon class="chip-close" @click="clearPickedFile"><CircleCloseFilled /></el-icon>
          </div>

          <div class="composer-box">
            <el-popover v-model:visible="pickerVisible" placement="top-start" :width="380" trigger="click">
              <template #reference>
                <button class="attach-btn" title="选择云盘文件作为分析对象">
                  <el-icon><Plus /></el-icon>
                </button>
              </template>
              <div class="file-picker">
                <el-input
                  v-model="pickerKeyword"
                  size="small"
                  placeholder="搜索我的文件..."
                  :prefix-icon="Search"
                  clearable
                />
                <div v-loading="pickerLoading" class="picker-list">
                  <button
                    v-for="file in pickerFiles"
                    :key="file.fileId"
                    class="picker-item"
                    @click="pickFile(file)"
                  >
                    <el-icon><Document /></el-icon>
                    <span class="picker-name">{{ file.name }}</span>
                    <span class="picker-meta">{{ file.sizeText }}</span>
                  </button>
                  <div v-if="!pickerLoading && !pickerFiles.length" class="picker-empty">
                    没有匹配的文件
                  </div>
                </div>
              </div>
            </el-popover>
            <el-input
              v-model="inputText"
              type="textarea"
              resize="none"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 4 }"
              :placeholder="pickedFile ? `和 AI 聊聊「${pickedFile.name}」，如：总结这个文件 / 把开头改成...` : '例如：帮我找实训报告、回收站里哪些快过期、为什么 RAG 要做 Query 改写'"
              @keydown.enter.prevent="sendMessage"
            />
            <el-button type="primary" class="send-btn" :disabled="!canSend" @click="sendMessage">
              发送
            </el-button>
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <section class="panel-card pet-card">
          <CloudPet />
        </section>

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

          <div v-if="critic" class="critic-box" :class="critic.passed ? 'ok' : 'warn'">
            <div class="critic-title">
              复核 Agent：{{ critic.passed ? '通过' : '发现问题' }}
              <span class="critic-mode">{{ critic.mode === 'llm' ? `模型复核（${critic.reviewer}）` : '规则复核' }}</span>
            </div>
            <ul v-if="critic.issues && critic.issues.length" class="critic-issues">
              <li v-for="(issue, i) in critic.issues" :key="i">{{ issue }}</li>
            </ul>
            <div v-if="critic.repaired" class="critic-repaired">已触发修正重写，回答以工具结果为准</div>
          </div>

          <div class="ability-tip">
            可问范围：文件位置 {{ aiStatus.abilities?.askFileLocation ? '✓' : '✗' }} ·
            总结文件 {{ aiStatus.abilities?.summarizeFile ? '✓' : '✗' }} ·
            AI 改文件 {{ aiStatus.abilities?.editFile ? '✓' : '✗' }}
            <span v-if="!aiStatus.abilities?.summarizeFile">（升级初级及以上可总结文件）</span>
          </div>
        </section>

        <section v-if="currentSources.length" class="panel-card">
          <h3>来源回显</h3>
          <div class="source-list">
            <div v-for="source in currentSources" :key="`${source.sourceType}-${source.sourceId}`" class="source-item">
              <div class="source-title">{{ source.title }}</div>
              <div class="source-path">{{ source.path }}</div>
              <div class="source-summary">{{ source.summary }}</div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCloseFilled, Document, MagicStick, Plus, Search, User } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'
import CloudPet from '@/components/CloudPet.vue'

const userStore = useUserStore()
const chatWindow = ref(null)
const inputText = ref('')
const isThinking = ref(false)
const thinkingStatus = ref('AI thinking...')
const traceSummary = ref('')
const traceStages = ref([])
const currentSources = ref([])
const capabilityCards = ref([])
const critic = ref(null)
const aiStatus = ref({ online: false, model: null, userLevel: 0, userLevelName: '普通用户', abilities: {} })
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

// ==================== 云盘文件选择器 ====================
const pickerVisible = ref(false)
const pickerKeyword = ref('')
const pickerLoading = ref(false)
const pickerFiles = ref([])
const pickedFile = ref(null)
let pickerTimer = null

const searchMyFiles = async () => {
  pickerLoading.value = true
  try {
    const res = await request.post('/file/list', {
      folderId: 0,
      pageNum: 1,
      pageSize: 20,
      category: 'all',
      isRecent: true
    })
    const records = res.data?.records || []
    const keyword = pickerKeyword.value.trim().toLowerCase()
    const rows = records
      .filter(item => item.type !== 'folder')
      .map(item => ({
        fileId: item.id,
        name: item.name,
        sizeText: item.size != null ? formatSizeShort(item.size) : ''
      }))
    pickerFiles.value = keyword
      ? rows.filter(f => f.name.toLowerCase().includes(keyword))
      : rows
  } catch (e) {
    pickerFiles.value = []
  } finally {
    pickerLoading.value = false
  }
}

const formatSizeShort = (bytes) => {
  const size = Number(bytes || 0)
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(2)} GB`
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${size} B`
}

watch(pickerKeyword, () => {
  clearTimeout(pickerTimer)
  pickerTimer = setTimeout(searchMyFiles, 250)
})

watch(pickerVisible, (visible) => {
  if (visible) {
    searchMyFiles()
  }
})

const pickFile = (file) => {
  pickedFile.value = file
  pickerVisible.value = false
  pickerKeyword.value = ''
}

const clearPickedFile = () => {
  pickedFile.value = null
}

const canSend = computed(() => (inputText.value.trim() || pickedFile.value) && !isThinking.value)

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
  if ((!query && !pickedFile.value) || isThinking.value) {
    return
  }

  // 只点了文件没打字：给一句默认指令，后端会以该文件为分析对象
  const finalQuery = query || '帮我总结一下这个文件的内容'
  const displayQuery = query || `分析文件「${pickedFile.value.name}」`

  messageList.value.push({
    role: 'user',
    content: pickedFile.value
      ? `<span class="msg-file-tag">📎 ${pickedFile.value.name}</span>${query}`
      : displayQuery
  })
  inputText.value = ''
  isThinking.value = true
  startThinkingAnimation()
  await scrollToBottom()

  try {
    const res = await request.post('/ai/chat', {
      query: finalQuery,
      topK: 5,
      fileId: pickedFile.value ? pickedFile.value.fileId : null
    })
    const data = res.data || {}

    messageList.value.push({
      role: 'ai',
      content: data.answer || '当前没有返回内容。'
    })
    traceSummary.value = data.traceSummary || ''
    traceStages.value = data.stages || []
    currentSources.value = data.sources || []
    capabilityCards.value = data.capabilityCards || []
    critic.value = data.critic || null
    if (Array.isArray(data.followUpQuestions) && data.followUpQuestions.length) {
      quickPrompts.value = data.followUpQuestions
    }
  } catch (error) {
    ElMessage.error('AI 助手请求失败')
  } finally {
    stopThinkingAnimation()
    isThinking.value = false
    thinkingStatus.value = 'AI thinking...'
    pickedFile.value = null
    await scrollToBottom()
  }
}

onMounted(() => {
  resetConversation()
  loadAiStatus()
})

const loadAiStatus = async () => {
  try {
    const res = await request.get('/ai/status')
    if (res && res.data) {
      aiStatus.value = res.data
    }
  } catch (e) {
    /* 状态不可用时保持离线提示 */
  }
}

onBeforeUnmount(() => {
  stopThinkingAnimation()
})
</script>

<style scoped>
.critic-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.critic-box.ok {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  color: #529b2e;
}
.critic-box.warn {
  background: #fdf6ec;
  border: 1px solid #faecd8;
  color: #b88230;
}
.critic-title {
  font-weight: 700;
}
.critic-mode {
  margin-left: 6px;
  font-weight: 400;
  opacity: 0.8;
}
.critic-issues {
  margin: 6px 0 0;
  padding-left: 16px;
}
.critic-repaired {
  margin-top: 4px;
  font-weight: 600;
}
.ability-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}
.ai-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 154px);
  min-height: 0;
  overflow: hidden;
}

.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-card,
.panel-card {
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-soft);
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
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.chat-head-main {
  min-width: 0;
}

.chat-eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.chat-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chat-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  line-height: 1.25;
}

.chat-sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.panel-card h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.pet-card {
  padding: 8px;
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

/* 左侧「+」附件按钮 */
.attach-btn {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.18s ease;
}

.attach-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

/* 已点选的文件 chip */
.picked-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  width: fit-content;
}

.chip-name {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-close {
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.chip-close:hover {
  opacity: 1;
}

/* 用户消息里的文件标记 */
.msg-file-tag {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 12px;
}

/* 文件选择弹层 */
.file-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 60px;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.picker-item:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.picker-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-meta {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.picker-empty {
  padding: 18px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
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
.source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.stage-item,
.source-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, var(--surface-muted), var(--surface-solid));
  border: 1px solid var(--border-color);
}

.stage-label,
.source-title {
  font-weight: 700;
  color: var(--text-primary);
}

.stage-detail,
.source-path,
.source-summary,
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
  .chat-card {
    min-height: 620px;
  }

  .composer-box {
    grid-template-columns: auto 1fr;
  }

  .send-btn {
    display: none;
  }

  .message-row {
    max-width: 100%;
  }
}
</style>
