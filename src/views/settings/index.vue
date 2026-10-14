<template>
  <div class="settings-container">
    <section class="settings-hero">
      <div>
        <p class="eyebrow">Settings Center</p>
        <h1>设置中心</h1>
        <p class="hero-desc">这里集中管理分享默认策略、回收站提醒和文件打开偏好。主题与上传偏好仍然即时生效。</p>
      </div>
      <div class="hero-tags">
        <el-tag size="large" effect="dark" :type="preferencesStore.isDark ? 'success' : 'info'">
          {{ preferencesStore.isDark ? '当前为暗黑主题' : '当前为明亮主题' }}
        </el-tag>
        <el-tag
          v-if="settings.recycleReminderEnabled && settings.recycleReminderCount > 0"
          size="large"
          type="warning"
          effect="plain"
        >
          回收站提醒 {{ settings.recycleReminderCount }}
        </el-tag>
      </div>
    </section>

    <div class="settings-grid">
      <section class="settings-card">
        <h3>界面风格</h3>
        <p class="card-desc">暗黑模式采用接近 ChatGPT 的深灰色层级，适合夜间或长时间使用。</p>

        <div class="theme-picker">
          <button
            class="theme-option"
            :class="{ active: preferencesStore.theme === 'light' }"
            @click="preferencesStore.setTheme('light')"
          >
            <span class="theme-preview theme-light"></span>
            <strong>明亮</strong>
            <small>白底浅灰层级</small>
          </button>

          <button
            class="theme-option"
            :class="{ active: preferencesStore.theme === 'dark' }"
            @click="preferencesStore.setTheme('dark')"
          >
            <span class="theme-preview theme-dark"></span>
            <strong>暗黑</strong>
            <small>深灰底 + 低眩光卡片</small>
          </button>
        </div>
      </section>

      <section class="settings-card">
        <h3>上传偏好</h3>
        <p class="card-desc">开启后，大于 5 MB 的文件会自动走分片上传，配合后端 Redis 记录分片索引实现断点续传与秒传。</p>

        <div class="setting-line">
          <div>
            <strong>分片上传</strong>
            <p>大文件自动分片，支持断点续传与秒传去重。</p>
          </div>
          <el-switch
            :model-value="preferencesStore.enableChunkUpload"
            @update:model-value="preferencesStore.setEnableChunkUpload"
          />
        </div>
      </section>

      <section class="settings-card">
        <h3>分享默认策略</h3>
        <p class="card-desc">创建分享时默认带出你这里设置的有效期。</p>

        <el-radio-group v-model="settings.defaultShareExpireDays">
          <el-radio-button :label="7">7 天</el-radio-button>
          <el-radio-button :label="15">15 天</el-radio-button>
          <el-radio-button :label="30">30 天</el-radio-button>
        </el-radio-group>
      </section>

      <section class="settings-card">
        <h3>回收站提醒</h3>
        <p class="card-desc">当前版本先做提醒标记，提醒出现在左侧回收站菜单和设置页顶部。</p>

        <div class="setting-line">
          <div>
            <strong>到期提醒</strong>
            <p>到期前 {{ settings.recycleReminderDays }} 天显示标记。</p>
          </div>
          <el-switch v-model="settings.recycleReminderEnabled" />
        </div>

        <div class="setting-line">
          <div>
            <strong>提醒窗口</strong>
            <p>当前先提供 1 / 3 / 5 / 7 天。</p>
          </div>
          <el-select v-model="settings.recycleReminderDays" style="width: 120px">
            <el-option :value="1" label="1 天" />
            <el-option :value="3" label="3 天" />
            <el-option :value="5" label="5 天" />
            <el-option :value="7" label="7 天" />
          </el-select>
        </div>
      </section>

      <section class="settings-card">
        <h3>私信接收设置</h3>
        <p class="card-desc">控制谁能给你发送站内私信。管理员发布的通知不受此限制。</p>

        <el-radio-group v-model="settings.messagePolicy" class="policy-group">
          <el-radio :label="0">所有人可发</el-radio>
          <el-radio :label="1">仅联系人可发</el-radio>
          <el-radio :label="2">不接收私信</el-radio>
        </el-radio-group>
      </section>

      <section class="settings-card full">
        <h3>文件打开偏好</h3>
        <p class="card-desc">点击文件行时会按这里的规则决定是预览还是直接下载；开启「下载前询问」后，任何下载都会先弹出确认窗口，不会静默下载。</p>

        <div class="open-grid">
          <div class="open-item">
            <strong>图片</strong>
            <el-segmented v-model="settings.imageOpenAction" :options="openActionOptions" />
          </div>
          <div class="open-item">
            <strong>视频</strong>
            <el-segmented v-model="settings.videoOpenAction" :options="openActionOptions" />
          </div>
          <div class="open-item">
            <strong>文档</strong>
            <el-segmented v-model="settings.docOpenAction" :options="openActionOptions" />
          </div>
          <div class="open-item">
            <strong>其他文件</strong>
            <el-segmented v-model="settings.otherOpenAction" :options="openActionOptions" />
          </div>
        </div>

        <div class="setting-line download-ask-line">
          <div>
            <strong>下载前询问</strong>
            <p>开启后，点击文件或点「下载」都会先弹确认窗口；关闭则直接下载。</p>
          </div>
          <el-switch v-model="confirmBeforeDownload" />
        </div>
      </section>

    </div>

    <div class="footer-actions">
      <el-button @click="loadSettings">重置为后端当前值</el-button>
      <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { usePreferencesStore } from '@/stores/preferences'
import { useUserStore } from '@/stores/user'

const preferencesStore = usePreferencesStore()
const userStore = useUserStore()

const saving = ref(false)

// 纯前端偏好（存 localStorage），切换即时生效，不需要点保存
const confirmBeforeDownload = computed({
  get: () => preferencesStore.confirmBeforeDownload,
  set: (value) => preferencesStore.setConfirmBeforeDownload(value)
})
const settings = reactive({
  defaultShareExpireDays: 15,
  recycleReminderEnabled: true,
  recycleReminderDays: 3,
  recycleReminderCount: 0,
  imageOpenAction: 'preview',
  videoOpenAction: 'preview',
  docOpenAction: 'download',
  otherOpenAction: 'download',
  messagePolicy: 0
})

const openActionOptions = [
  { label: '预览', value: 'preview' },
  { label: '下载', value: 'download' }
]

const applySettings = (data = {}) => {
  settings.defaultShareExpireDays = Number(data.defaultShareExpireDays || 15)
  settings.recycleReminderEnabled = Number(data.recycleReminderEnabled || 0) === 1
  settings.recycleReminderDays = Number(data.recycleReminderDays || 3)
  settings.recycleReminderCount = Number(data.recycleReminderCount || 0)
  settings.imageOpenAction = data.imageOpenAction || 'preview'
  settings.videoOpenAction = data.videoOpenAction || 'preview'
  settings.docOpenAction = data.docOpenAction || 'download'
  settings.otherOpenAction = data.otherOpenAction || 'download'
  settings.messagePolicy = Number(data.messagePolicy || 0)
}

const syncUserStore = (data = {}) => {
  userStore.setUserInfo({
    ...userStore.userInfo,
    defaultShareExpireDays: Number(data.defaultShareExpireDays || settings.defaultShareExpireDays),
    recycleReminderEnabled: Number(data.recycleReminderEnabled || 0),
    recycleReminderDays: Number(data.recycleReminderDays || settings.recycleReminderDays),
    recycleReminderCount: Number(data.recycleReminderCount || settings.recycleReminderCount),
    hasRecycleReminder: Number(data.recycleReminderCount || settings.recycleReminderCount) > 0,
    imageOpenAction: data.imageOpenAction || settings.imageOpenAction,
    videoOpenAction: data.videoOpenAction || settings.videoOpenAction,
    docOpenAction: data.docOpenAction || settings.docOpenAction,
    otherOpenAction: data.otherOpenAction || settings.otherOpenAction,
    messagePolicy: Number(data.messagePolicy ?? settings.messagePolicy)
  })
}

const loadSettings = async () => {
  const [settingsRes, infoRes] = await Promise.all([
    request.get('/user/settings'),
    request.get('/file/user/info')
  ])
  applySettings({
    ...settingsRes.data,
    recycleReminderCount: infoRes.data?.recycleReminderCount || 0
  })
  syncUserStore({
    ...settingsRes.data,
    recycleReminderCount: infoRes.data?.recycleReminderCount || 0
  })
}

const saveSettings = async () => {
  saving.value = true
  try {
    await request.post('/user/settings', {
      defaultShareExpireDays: settings.defaultShareExpireDays,
      recycleReminderEnabled: settings.recycleReminderEnabled ? 1 : 0,
      recycleReminderDays: settings.recycleReminderDays,
      imageOpenAction: settings.imageOpenAction,
      videoOpenAction: settings.videoOpenAction,
      docOpenAction: settings.docOpenAction,
      otherOpenAction: settings.otherOpenAction,
      messagePolicy: settings.messagePolicy
    })
    await loadSettings()
    ElMessage.success('设置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-container {
  max-width: 1120px;
  margin: 0 auto;
}

.settings-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  margin-bottom: 24px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background:
    radial-gradient(circle at top left, rgba(16, 163, 127, 0.16), transparent 26%),
    linear-gradient(135deg, var(--surface-solid), var(--surface-muted));
  box-shadow: var(--shadow-soft);
}

.eyebrow {
  margin-bottom: 8px;
  color: var(--accent);
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.settings-hero h1 {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-size: 34px;
}

.hero-desc {
  max-width: 620px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.hero-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.settings-card {
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  box-shadow: var(--shadow-soft);
}

.settings-card.full {
  grid-column: 1 / -1;
}

.policy-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.settings-card h3 {
  margin: 0 0 12px;
  color: var(--text-primary);
}

.card-desc {
  margin-bottom: 18px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.theme-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.theme-option {
  text-align: left;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-primary);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.theme-option.active {
  border-color: var(--accent);
  box-shadow: 0 10px 24px rgba(16, 163, 127, 0.18);
  transform: translateY(-2px);
}

.theme-option strong,
.theme-option small {
  display: block;
}

.theme-option small {
  margin-top: 6px;
  color: var(--text-secondary);
}

.theme-preview {
  display: block;
  width: 100%;
  height: 84px;
  margin-bottom: 14px;
  border-radius: 14px;
}

.theme-light {
  background: linear-gradient(135deg, #ffffff, #eef2ff);
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.theme-dark {
  background: linear-gradient(135deg, #171717, #2a2a2a);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.setting-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
}

.setting-line strong {
  color: var(--text-primary);
}

.setting-line p {
  margin-top: 6px;
  color: var(--text-secondary);
}

.open-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.open-item {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.open-item strong {
  display: block;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.download-ask-line {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 960px) {
  .settings-grid,
  .theme-picker,
  .open-grid {
    grid-template-columns: 1fr;
  }

  .settings-hero {
    flex-direction: column;
  }
}
</style>
