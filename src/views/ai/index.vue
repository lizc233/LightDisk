<template>
  <div class="ai-container fade-up">
    <div class="chat-section">
      <div class="chat-header">
        <h2><el-icon><MagicStick /></el-icon> LightDisk AI</h2>
        <span class="subtitle">您的私有云端智能助理</span>
      </div>

      <div class="chat-window" ref="chatWindow">
        <div
            v-for="(msg, index) in messageList"
            :key="index"
            class="message-wrapper"
            :class="msg.role === 'user' ? 'is-user' : 'is-ai'"
        >
          <el-avatar
              :size="36"
              :src="msg.role === 'user' ? userStore.userInfo?.avatar : '/images/ai-avatar.png'"
              class="msg-avatar"
              :icon="msg.role !== 'user' ? MagicStick : User"
          />
          <div class="message-bubble">
            <div v-if="msg.attachedFile" class="attached-file-chip">
              <el-icon><Document /></el-icon> {{ msg.attachedFile }}
            </div>
            <div class="message-content" v-html="msg.content"></div>
          </div>
        </div>

        <div v-if="isThinking" class="message-wrapper is-ai">
          <el-avatar :size="36" :icon="MagicStick" class="msg-avatar" />
          <div class="message-bubble typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="quick-actions">
          <el-button size="small" round @click="insertPrompt('总结我的最近上传')">文档总结</el-button>
          <el-button size="small" round @click="insertPrompt('帮我翻译这个文件')">内容翻译</el-button>
          <el-button size="small" round @click="insertPrompt('提取关键数据')">数据提取</el-button>
        </div>

        <div class="input-box">
          <el-button circle class="attach-btn" title="选择网盘文件让 AI 阅读">
            <el-icon><Paperclip /></el-icon>
          </el-button>
          <el-input
              v-model="inputText"
              type="textarea"
              :rows="1"
              :autosize="{ minRows: 1, maxRows: 4 }"
              placeholder="问问 AI，或者让它阅读你的网盘文件..."
              resize="none"
              @keydown.enter.prevent="sendMessage"
          />
          <el-button type="primary" circle class="send-btn" @click="sendMessage" :disabled="!inputText.trim()">
            <el-icon><Position /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div class="context-section">
      <div class="context-card">
        <h3 class="card-title">AI 上下文</h3>
        <p class="desc">您可以点击左侧的回形针，选择网盘中的文件让 AI 读取。</p>

        <div class="empty-state">
          <el-icon :size="40" color="#c0c4cc"><Box /></el-icon>
          <p>当前未关联文件</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import { MagicStick, User, Paperclip, Position, Document, Box } from '@element-plus/icons-vue'

const userStore = useUserStore()
const inputText = ref('')
const isThinking = ref(false)
const chatWindow = ref(null)

// 初始欢迎语
const messageList = ref([
  {
    role: 'ai',
    content: `你好，${userStore.userInfo?.username || '主人'}！我是 LightDisk AI 助手。我可以帮你：<br>1. 总结长篇文档、提炼核心观点<br>2. 翻译外文资料<br>3. 在你海量的网盘文件中快速检索信息<br><br>你想让我做什么？`
  }
])

// 滚动到最新消息
const scrollToBottom = async () => {
  await nextTick()
  if (chatWindow.value) {
    chatWindow.value.scrollTop = chatWindow.value.scrollHeight
  }
}

// 快捷输入
const insertPrompt = (text) => {
  inputText.value = text
}

// 发送消息
const sendMessage = async () => {
  if (!inputText.value.trim() || isThinking.value) return

  // 1. 用户消息上屏
  messageList.value.push({
    role: 'user',
    content: inputText.value
  })
  const currentQuery = inputText.value
  inputText.value = ''
  scrollToBottom()

  // 2. 开启思考状态
  isThinking.value = true
  scrollToBottom()

  // 3. 模拟请求后端大模型 API (这里等你的后端 Spring Boot 接口写好后替换为 request.post)
  setTimeout(() => {
    isThinking.value = false
    messageList.value.push({
      role: 'ai',
      content: `这是一个模拟的 AI 回复。等后端大模型接入后，这里将显示对问题 <b>"${currentQuery}"</b> 的真实分析结果。`
    })
    scrollToBottom()
  }, 1500)
}
</script>

<style scoped>
.ai-container {
  display: flex;
  height: calc(100vh - 160px);
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 左侧聊天区主视觉 */
.chat-section {
  flex: 1;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f2f5;
}
.chat-header h2 {
  margin: 0; font-size: 18px; display: flex; align-items: center; gap: 8px; color: #1d1d1f;
}
.subtitle { font-size: 13px; color: #86868b; }

.chat-window {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: #fafbfc;
}

/* 消息气泡样式 */
.message-wrapper { display: flex; gap: 16px; max-width: 85%; }
.message-wrapper.is-user { align-self: flex-end; flex-direction: row-reverse; }

.msg-avatar { background: #007AFF; color: white; flex-shrink: 0; }
.is-ai .msg-avatar { background: linear-gradient(135deg, #10a37f, #0d8a6a); }

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #1d1d1f;
}
.is-user .message-bubble {
  background: #007AFF;
  color: white;
  border-top-right-radius: 2px;
}
.is-ai .message-bubble {
  background: white;
  border: 1px solid #e5e5e7;
  border-top-left-radius: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.attached-file-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.2); padding: 4px 10px;
  border-radius: 4px; font-size: 12px; margin-bottom: 8px;
  border: 1px solid rgba(255,255,255,0.3);
}
.is-ai .attached-file-chip { background: #f0f2f5; border-color: #e5e5e7; }

/* 底部输入框区域 */
.chat-input-area {
  padding: 16px 24px 24px;
  background: white;
  border-top: 1px solid #f0f2f5;
}
.quick-actions {
  display: flex; gap: 10px; margin-bottom: 12px;
}
.quick-actions .el-button { color: #6e6e73; background: #f5f5f7; border: none; }

.input-box {
  display: flex; align-items: flex-end; gap: 12px;
  background: #f5f5f7; padding: 8px 12px; border-radius: 24px;
  border: 1px solid transparent; transition: 0.3s;
}
.input-box:focus-within { border-color: #007AFF; background: white; box-shadow: 0 0 0 3px rgba(0,122,255,0.1); }

.attach-btn { border: none; background: transparent; font-size: 18px; color: #86868b; margin-bottom: 4px;}
.attach-btn:hover { color: #007AFF; }
.send-btn { margin-bottom: 4px; }
:deep(.el-textarea__inner) {
  background: transparent; border: none; box-shadow: none !important; padding: 8px 0; color: #1d1d1f;
}

/* 侧边上下文提示 */
.context-section {
  width: 280px;
}
.context-card {
  background: white; padding: 20px; border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); height: 100%;
}
.card-title { font-size: 15px; margin: 0 0 8px; color: #1d1d1f; }
.desc { font-size: 13px; color: #86868b; line-height: 1.5; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 200px; color: #86868b; font-size: 13px; gap: 12px; margin-top: 40px;
}

/* 动画打字机 */
.typing-indicator span {
  display: inline-block; width: 6px; height: 6px; background-color: #c0c4cc; border-radius: 50%; margin: 0 2px;
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>