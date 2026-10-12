<template>
  <div class="profile-container fade-up">
    <section class="profile-card header-section">
      <div class="avatar-wrapper">
        <el-avatar
          :size="96"
          :src="userStore.userInfo?.avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'"
        />
        <div class="upload-overlay">
          <el-icon><Camera /></el-icon>
        </div>
      </div>

      <div class="user-info">
        <div class="name-row">
          <h1 class="username">{{ profile.username || userStore.userInfo?.username }}</h1>
          <el-tag :type="profile.role > 0 ? 'warning' : 'info'" effect="dark" round size="small">
            {{ profile.levelName || '普通用户' }}
          </el-tag>
        </div>
        <p class="user-meta">
          账号 ID: {{ profile.id || userStore.userInfo?.id }}
          <span v-if="profile.createdAt">· 注册于 {{ formatDate(profile.createdAt, 'date') }}</span>
        </p>
      </div>
    </section>

    <div class="main-grid">
      <section class="profile-card storage-section">
        <h3 class="card-title">存储空间分析</h3>
        <div class="storage-content">
          <div class="chart-box">
            <el-progress
              type="dashboard"
              :percentage="storagePercentage"
              :stroke-width="12"
              :color="storageColor"
            >
              <template #default="{ percentage }">
                <span class="percentage-value">{{ percentage.toFixed(0) }}%</span>
                <span class="percentage-label">已使用</span>
              </template>
            </el-progress>
          </div>

          <div class="storage-details">
            <div class="detail-item">
              <span class="dot used"></span>
              <span class="label">已用空间</span>
              <span class="value">{{ formattedUsed }}</span>
            </div>
            <div class="detail-item">
              <span class="dot total"></span>
              <span class="label">总空间</span>
              <span class="value">{{ formattedTotal }}</span>
            </div>
            <div class="detail-item">
              <span class="dot free"></span>
              <span class="label">剩余空间</span>
              <span class="value">{{ formattedFree }}</span>
            </div>
            <el-button type="primary" class="upgrade-btn" round @click="upgradeDialogVisible = true">
              <el-icon><Top /></el-icon>
              提升等级 / 扩容
            </el-button>
          </div>
        </div>

        <!-- 分类占用：按文件类型展示真实字节数 -->
        <div v-if="storageStats" class="category-usage">
          <div v-for="cat in categoryUsage" :key="cat.key" class="cat-row">
            <span class="cat-label">{{ cat.label }}</span>
            <div class="cat-bar">
              <div class="cat-bar-fill" :style="{ width: cat.percent + '%', background: cat.color }"></div>
            </div>
            <span class="cat-value">{{ cat.text }}</span>
          </div>
        </div>

        <!-- 概览数字：文件/文件夹/分享/近 7 天上传 -->
        <div v-if="storageStats" class="stats-grid">
          <div class="stat-cell">
            <span class="stat-num">{{ storageStats.fileCount || 0 }}</span>
            <span class="stat-label">文件</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{{ storageStats.folderCount || 0 }}</span>
            <span class="stat-label">文件夹</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{{ storageStats.shareCount || 0 }}</span>
            <span class="stat-label">有效分享</span>
          </div>
          <div class="stat-cell">
            <span class="stat-num">{{ storageStats.recentUploads || 0 }}</span>
            <span class="stat-label">近 7 天上传</span>
          </div>
        </div>

        <div v-if="storageStats && storageStats.biggestFileName" class="biggest-file">
          <el-icon><Document /></el-icon>
          <span class="bf-label">最大文件</span>
          <span class="bf-name" :title="storageStats.biggestFileName">{{ storageStats.biggestFileName }}</span>
          <span class="bf-size">{{ formatBytes(storageStats.biggestFileSize) }}</span>
          <span v-if="storageStats.lastUploadTime" class="bf-time">
            最近上传：{{ formatDate(storageStats.lastUploadTime) }}
          </span>
        </div>
      </section>

      <div class="settings-grid">
        <div class="profile-card setting-item">
          <h3 class="card-title"><el-icon><Lock /></el-icon> 账号安全</h3>
          <div class="setting-row">
            <div class="info">
              <div class="label">邮箱绑定</div>
              <div class="val">{{ profile.email || '未绑定' }}</div>
            </div>
            <el-button link type="primary" @click="emailDialogVisible = true">
              {{ profile.email ? '换绑邮箱' : '立即绑定' }}
            </el-button>
          </div>
          <div class="setting-row">
            <div class="info">
              <div class="label">登录密码</div>
              <div class="val">建议定期修改密码，保护账号安全</div>
            </div>
            <el-button link type="primary" @click="passwordDialogVisible = true">修改密码</el-button>
          </div>
        </div>

        <div class="profile-card setting-item vip-card">
          <h3 class="card-title"><el-icon><Medal /></el-icon> 会员特权</h3>
          <p class="vip-deadline">有效期至：{{ profile.vipExpireTime ? formatDate(profile.vipExpireTime) : '未开通' }}</p>
          <ul class="privilege-list">
            <li><el-icon><CircleCheckFilled /></el-icon> 当前等级：{{ profile.levelName || '普通用户' }}</li>
            <li><el-icon><CircleCheckFilled /></el-icon> 存储上限：{{ formattedTotal }}</li>
            <li><el-icon><CircleCheckFilled /></el-icon> 并发上传数：{{ profile.maxBatchUpload || 1 }}</li>
            <li>
              <el-icon><CircleCheckFilled /></el-icon>
              下载限速：{{ profile.downloadSpeedLimit === 0 ? '不限速' : `${profile.downloadSpeedLimit} KB/s` }}
            </li>
            <li v-if="!profile.isTopLevel">
              <el-icon><CircleCheckFilled /></el-icon>
              下一等级：{{ profile.nextLevelName }} / {{ formatBytes(profile.nextTotalSpace) }}
            </li>
          </ul>
        </div>

        <div class="profile-card setting-item">
          <h3 class="card-title"><el-icon><Operation /></el-icon> 偏好设置</h3>
          <div class="setting-row">
            <div class="info">
              <div class="label">界面风格</div>
              <div class="val">{{ isDarkMode ? '暗黑模式' : '明亮模式' }}</div>
            </div>
            <el-switch v-model="isDarkMode" active-text="暗黑" inactive-text="明亮" />
          </div>
          <div class="setting-row">
            <div class="info">
              <div class="label">分片上传</div>
              <div class="val">{{ enableChunk ? '已开启' : '已关闭' }}</div>
            </div>
            <el-switch v-model="enableChunk" />
          </div>
          <div class="setting-row no-border">
            <div class="info">
              <div class="label">更多设置</div>
              <div class="val">进入设置中心管理全局偏好与建议项</div>
            </div>
            <el-button link type="primary" @click="router.push('/app/settings')">打开设置</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="emailDialogVisible" title="邮箱绑定" width="420px" center>
      <el-form :model="emailForm" label-position="top">
        <el-form-item label="邮箱地址">
          <el-input v-model="emailForm.email" placeholder="请输入真实邮箱" />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input v-model="emailForm.code" placeholder="请输入 6 位验证码" />
            <el-button :disabled="emailCountdown > 0" @click="handleSendBindCode">
              {{ emailCountdown > 0 ? `${emailCountdown}s 后重试` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="emailDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindingEmail" @click="handleBindEmail">确认绑定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="安全中心 - 修改密码" width="420px" center>
      <el-form :model="pwdForm" label-position="top">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer-row">
          <el-button link type="primary" @click="forgotDialogVisible = true">忘记旧密码？</el-button>
          <div>
            <el-button @click="passwordDialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="updatingPassword" @click="handleUpdatePassword">确认修改</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="forgotDialogVisible" title="邮箱验证后重置密码" width="440px" center>
      <el-alert
        v-if="!profile.email"
        title="请先绑定邮箱，才能通过邮箱验证码找回密码"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-form v-else :model="forgotForm" label-position="top" class="forgot-form">
        <el-form-item label="绑定邮箱">
          <el-input :model-value="profile.email" disabled />
        </el-form-item>
        <el-form-item label="邮箱验证码">
          <div class="code-row">
            <el-input v-model="forgotForm.code" placeholder="请输入 6 位验证码" />
            <el-button :disabled="forgotCountdown > 0" @click="handleSendResetCode">
              {{ forgotCountdown > 0 ? `${forgotCountdown}s 后重试` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="forgotForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forgotDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!profile.email"
          :loading="resettingPassword"
          @click="handleResetPassword"
        >
          重置密码
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="upgradeDialogVisible" title="会员升级 / 扩容" width="460px" center>
      <div class="upgrade-sheet">
        <div class="price-panel">
          <div class="price-mark">限时特惠</div>
          <div class="price-value">只需支付 {{ profile.upgradePrice || 99 }} 元</div>
          <p class="price-desc">
            {{ profile.isTopLevel ? '续费当前等级 365 天' : `立即升级到 ${profile.nextLevelName}` }}
          </p>
        </div>

        <div class="sheet-line">
          <span>当前等级</span>
          <strong>{{ profile.levelName || '普通用户' }}</strong>
        </div>
        <div class="sheet-line">
          <span>当前空间</span>
          <strong>{{ formattedTotal }}</strong>
        </div>
        <div class="sheet-line">
          <span>升级结果</span>
          <strong>
            {{ profile.isTopLevel ? `${profile.levelName} 续期 365 天` : `${profile.nextLevelName} / ${formatBytes(profile.nextTotalSpace)}` }}
          </strong>
        </div>
      </div>
      <template #footer>
        <el-button @click="upgradeDialogVisible = false">稍后再说</el-button>
        <el-button type="primary" :loading="upgradingVip" @click="handleUpgradeVip">立即支付</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Camera, CircleCheckFilled, Document, Lock, Medal, Operation, Top } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'
import { usePreferencesStore } from '@/stores/preferences'

const router = useRouter()
const userStore = useUserStore()
const preferencesStore = usePreferencesStore()

const profile = ref({
  id: null,
  username: '',
  email: '',
  role: 0,
  isAdmin: 0,
  levelName: '普通用户',
  usedSpace: 0,
  totalSpace: 10 * 1024 ** 3,
  availableSpace: 10 * 1024 ** 3,
  vipExpireTime: null,
  createdAt: null,
  defaultShareExpireDays: 15,
  recycleReminderEnabled: 1,
  recycleReminderDays: 3,
  recycleReminderCount: 0,
  hasRecycleReminder: false,
  imageOpenAction: 'preview',
  videoOpenAction: 'preview',
  docOpenAction: 'download',
  otherOpenAction: 'download',
  maxBatchUpload: 1,
  downloadSpeedLimit: 0,
  upgradePrice: 99,
  isTopLevel: false,
  nextLevelName: '初级用户',
  nextTotalSpace: 50 * 1024 ** 3
})

const isDarkMode = computed({
  get: () => preferencesStore.isDark,
  set: value => preferencesStore.setTheme(value ? 'dark' : 'light')
})

const enableChunk = computed({
  get: () => preferencesStore.enableChunkUpload,
  set: value => preferencesStore.setEnableChunkUpload(value)
})

const emailDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const forgotDialogVisible = ref(false)
const upgradeDialogVisible = ref(false)

const bindingEmail = ref(false)
const updatingPassword = ref(false)
const resettingPassword = ref(false)
const upgradingVip = ref(false)

const emailCountdown = ref(0)
const forgotCountdown = ref(0)
let emailTimer = null
let forgotTimer = null

const emailForm = reactive({
  email: '',
  code: ''
})

const pwdForm = reactive({
  oldPassword: '',
  newPassword: ''
})

const forgotForm = reactive({
  code: '',
  newPassword: ''
})

const storagePercentage = computed(() => {
  if (!profile.value.totalSpace) return 0
  return Math.min((profile.value.usedSpace / profile.value.totalSpace) * 100, 100)
})

const storageColor = computed(() => {
  if (storagePercentage.value > 90) return '#f56c6c'
  if (storagePercentage.value > 70) return '#e6a23c'
  return '#10a37f'
})

const formattedUsed = computed(() => formatBytes(profile.value.usedSpace))
const formattedTotal = computed(() => formatBytes(profile.value.totalSpace))
const formattedFree = computed(() => formatBytes(profile.value.availableSpace))

// ==================== 存储分析统计 ====================
const storageStats = ref(null)

const categoryUsage = computed(() => {
  const bytes = storageStats.value?.categoryBytes || {}
  const used = profile.value.usedSpace || 1
  const items = [
    { key: 'image', label: '图片', value: bytes.image || 0, color: 'var(--accent)' },
    { key: 'doc', label: '文档', value: bytes.doc || 0, color: '#3b82f6' },
    { key: 'video', label: '视频', value: bytes.video || 0, color: '#f59e0b' },
    { key: 'other', label: '其他', value: bytes.other || 0, color: '#94a3b8' }
  ]
  return items.map(item => ({
    ...item,
    text: item.value >= 1 ? `${formatBytes(item.value)}` : '0 B',
    percent: Math.max((item.value / used) * 100, item.value > 0 ? 3 : 0)
  }))
})

const loadStorageStats = async () => {
  try {
    const res = await request.get('/file/storage/stats')
    storageStats.value = res.data || null
  } catch (e) {
    /* 统计失败不影响主信息展示 */
  }
}

const syncStoreUserInfo = () => {
  userStore.setUserInfo({
    ...userStore.userInfo,
    id: profile.value.id,
    username: profile.value.username,
    email: profile.value.email,
    role: profile.value.role,
    isAdmin: profile.value.isAdmin,
    levelName: profile.value.levelName,
    usedSpace: profile.value.usedSpace,
    totalSpace: profile.value.totalSpace,
    vipExpireTime: profile.value.vipExpireTime,
    defaultShareExpireDays: profile.value.defaultShareExpireDays,
    recycleReminderEnabled: profile.value.recycleReminderEnabled,
    recycleReminderDays: profile.value.recycleReminderDays,
    recycleReminderCount: profile.value.recycleReminderCount,
    hasRecycleReminder: profile.value.hasRecycleReminder,
    imageOpenAction: profile.value.imageOpenAction,
    videoOpenAction: profile.value.videoOpenAction,
    docOpenAction: profile.value.docOpenAction,
    otherOpenAction: profile.value.otherOpenAction
  })
}

const loadProfile = async () => {
  const res = await request.get('/file/user/info')
  profile.value = {
    ...profile.value,
    ...res.data
  }
  emailForm.email = profile.value.email || ''
  syncStoreUserInfo()
}

const startCountdown = (target, key) => {
  target.value = 60
  if (key === 'email') {
    clearInterval(emailTimer)
    emailTimer = setInterval(() => {
      if (emailCountdown.value <= 1) {
        clearInterval(emailTimer)
        emailCountdown.value = 0
        return
      }
      emailCountdown.value -= 1
    }, 1000)
    return
  }

  clearInterval(forgotTimer)
  forgotTimer = setInterval(() => {
    if (forgotCountdown.value <= 1) {
      clearInterval(forgotTimer)
      forgotCountdown.value = 0
      return
    }
    forgotCountdown.value -= 1
  }, 1000)
}

const handleSendBindCode = async () => {
  if (!emailForm.email) {
    ElMessage.warning('请先输入邮箱')
    return
  }
  try {
    const res = await request.post('/user/email/send-code', { email: emailForm.email })
    ElMessage.success(res.data || '验证码已发送')
    startCountdown(emailCountdown, 'email')
  } catch (error) {}
}

const handleBindEmail = async () => {
  if (!emailForm.email || !emailForm.code) {
    ElMessage.warning('请填写邮箱和验证码')
    return
  }
  bindingEmail.value = true
  try {
    await request.post('/user/email/bind', {
      email: emailForm.email,
      code: emailForm.code
    })
    ElMessage.success('邮箱绑定成功')
    emailDialogVisible.value = false
    emailForm.code = ''
    await loadProfile()
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '邮箱绑定失败')
  } finally {
    bindingEmail.value = false
  }
}

const handleUpdatePassword = async () => {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    ElMessage.warning('请填写旧密码和新密码')
    return
  }
  updatingPassword.value = true
  try {
    await request.post('/user/password/update', {
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    })
    ElMessage.success('密码修改成功，请重新登录')
    passwordDialogVisible.value = false
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    userStore.logout()
    window.location.href = '/login'
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '密码修改失败')
  } finally {
    updatingPassword.value = false
  }
}

const handleSendResetCode = async () => {
  if (!profile.value.email) {
    ElMessage.warning('请先绑定邮箱')
    return
  }
  try {
    const res = await request.post('/password/reset/send-code', {
      email: profile.value.email
    })
    ElMessage.success(res.data || '验证码已发送')
    startCountdown(forgotCountdown, 'forgot')
  } catch (error) {}
}

const handleResetPassword = async () => {
  if (!forgotForm.code || !forgotForm.newPassword) {
    ElMessage.warning('请填写验证码和新密码')
    return
  }
  resettingPassword.value = true
  try {
    await request.post('/password/reset', {
      email: profile.value.email,
      code: forgotForm.code,
      newPassword: forgotForm.newPassword
    })
    ElMessage.success('密码重置成功，请重新登录')
    forgotDialogVisible.value = false
    passwordDialogVisible.value = false
    forgotForm.code = ''
    forgotForm.newPassword = ''
    userStore.logout()
    window.location.href = '/login'
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '重置失败')
  } finally {
    resettingPassword.value = false
  }
}

const handleUpgradeVip = async () => {
  upgradingVip.value = true
  try {
    const res = await request.post('/user/vip/upgrade')
    profile.value = {
      ...profile.value,
      ...res.data
    }
    syncStoreUserInfo()
    upgradeDialogVisible.value = false
    ElMessage.success('支付成功，会员权益已生效')
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '升级失败')
  } finally {
    upgradingVip.value = false
  }
}

const formatBytes = (value) => {
  const size = Number(value || 0)
  const gb = size / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(gb >= 100 ? 0 : 2)} GB`
  const mb = size / 1024 ** 2
  return `${mb.toFixed(2)} MB`
}

const parseDateValue = (value) => {
  if (!value) return null
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, Number(month) - 1, day, hour, minute, second)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value, mode = 'datetime') => {
  const date = parseDateValue(value)
  if (!date) return typeof value === 'string' ? value : '未开通'
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  if (mode === 'date') return `${yyyy}-${mm}-${dd}`
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

onMounted(() => {
  loadProfile()
  loadStorageStats()
})

onBeforeUnmount(() => {
  clearInterval(emailTimer)
  clearInterval(forgotTimer)
})
</script>

<style scoped>
.profile-container {
  max-width: 1120px;
  margin: 0 auto;
}

.profile-card {
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-soft);
  margin-bottom: 24px;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 28px;
  background:
    radial-gradient(circle at top left, rgba(16, 163, 127, 0.14), transparent 28%),
    linear-gradient(135deg, var(--surface-solid), var(--surface-muted));
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.upload-overlay {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  border: 3px solid var(--surface-solid);
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.username {
  margin: 0;
  font-size: 30px;
  color: var(--text-primary);
}

.user-meta {
  margin: 0;
  color: var(--text-secondary);
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 24px;
}

.storage-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.percentage-value {
  display: block;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

.percentage-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.storage-details {
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dot.used {
  background: var(--accent);
}

.dot.total {
  background: #3b82f6;
}

.dot.free {
  background: #94d82d;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-item .value {
  margin-left: auto;
  font-weight: 600;
}

.upgrade-btn {
  margin-top: 10px;
}

/* ===== 分类占用条 ===== */
.category-usage {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cat-row {
  display: grid;
  grid-template-columns: 44px 1fr 76px;
  align-items: center;
  gap: 10px;
}

.cat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.cat-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.cat-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.cat-value {
  font-size: 12px;
  color: var(--text-primary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ===== 概览数字格 ===== */
.stats-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px;
  border-radius: 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
}

/* ===== 最大文件 / 最近上传 ===== */
.biggest-file {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.biggest-file .el-icon {
  color: var(--text-muted);
}

.bf-label {
  flex-shrink: 0;
}

.bf-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 500;
}

.bf-size {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.bf-time {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--text-muted);
}

.settings-grid {
  display: grid;
  gap: 24px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-row.no-border,
.setting-row:last-child {
  border-bottom: none;
}

.info .label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.info .val {
  color: var(--text-primary);
}

.vip-card {
  background: linear-gradient(135deg, #1f1f1f, #262626 68%, #3e3320);
  border-color: rgba(245, 192, 93, 0.2);
}

.vip-card .card-title,
.vip-card .vip-deadline,
.vip-card .privilege-list {
  color: #f6e3af;
}

.vip-deadline {
  margin-bottom: 16px;
  font-size: 13px;
}

.privilege-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
}

.privilege-list .el-icon {
  margin-right: 8px;
  color: #f5c05d;
}

.code-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.code-row :deep(.el-input) {
  flex: 1;
}

.dialog-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.forgot-form {
  margin-top: 16px;
}

.upgrade-sheet {
  border-radius: 20px;
  padding: 22px;
  background: linear-gradient(160deg, #fff9ec, #fff4d8);
  border: 1px solid #f5dfaa;
}

.price-panel {
  margin-bottom: 18px;
  padding: 18px;
  border-radius: 16px;
  background: #1f2937;
  color: #fff;
}

.price-mark {
  display: inline-block;
  margin-bottom: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
}

.price-value {
  font-size: 28px;
  font-weight: 700;
  color: #ffcf66;
}

.price-desc {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.82);
}

.sheet-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px dashed rgba(17, 24, 39, 0.16);
}

.sheet-line:last-child {
  border-bottom: none;
}

.fade-up {
  animation: fadeUp 0.45s ease;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .storage-content {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bf-time {
    display: none;
  }

  .dialog-footer-row,
  .code-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
