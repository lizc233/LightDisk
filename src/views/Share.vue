<template>
  <div class="public-share-container">
    <div class="glass-card" v-loading="loading">
      <div v-if="errorMsg" class="status-box error">
        <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
        <h2>分享链接不可用</h2>
        <p>{{ errorMsg }}</p>
      </div>

      <div v-else-if="shareInfo" class="content-box">
        <div class="user-avatar">
          <el-avatar :size="68" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
        </div>
        <h2 class="share-title">LightDisk 文件分享</h2>
        <p class="share-subtitle">请输入提取码后下载文件，或登录后保存到“我的网盘”</p>
        <div class="login-state" :class="{ offline: !isLoggedIn }">
          {{ isLoggedIn ? `当前已登录：${userStore.userInfo?.username || '未知用户'}` : '当前未登录' }}
        </div>

        <div class="file-preview">
          <el-icon class="file-icon" :size="32"><Document /></el-icon>
          <div class="file-meta">
            <span class="file-name">{{ shareInfo.fileName }}</span>
            <span class="file-expire" v-if="shareInfo.expireTime">失效时间：{{ shareInfo.expireTime }}</span>
          </div>
        </div>

        <div class="extract-area">
          <el-input
            v-model="extractCode"
            placeholder="请输入 4 位提取码"
            maxlength="4"
            class="extract-input"
            @keyup.enter="handleDownload"
          />
        </div>

        <div class="action-row">
          <el-button type="primary" class="action-btn" :loading="downloading" @click="handleDownload">
            直接下载
          </el-button>
          <el-button class="action-btn" :loading="saving" @click="handleSaveToMyDisk">
            保存到我的网盘
          </el-button>
        </div>
        <div v-if="isLoggedIn" class="switch-account-row">
          <el-button text @click="handleSwitchAccount">切换账号保存</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="loginDialogVisible" title="登录后保存到我的网盘" width="420px" destroy-on-close>
      <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password @keyup.enter="handleDialogLogin" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="loginDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loggingIn" @click="handleDialogLogin">登录并保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCloseFilled, Document } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const shareCode = ref(route.params.shareCode || '')
const loading = ref(true)
const downloading = ref(false)
const saving = ref(false)
const loggingIn = ref(false)
const loginDialogVisible = ref(false)

const shareInfo = ref(null)
const errorMsg = ref('')
const extractCode = ref('')
const pendingSaveAfterLogin = ref(false)

const loginFormRef = ref(null)
const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const isLoggedIn = computed(() => Boolean(userStore.token && userStore.userInfo?.id))

const ensureExtractCode = () => {
  if (extractCode.value.trim().length !== 4) {
    ElMessage.warning('请输入完整的4位提取码')
    return false
  }
  return true
}

const fetchShareInfo = async () => {
  if (!shareCode.value) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }

  try {
    const res = await request.get(`/share/public/${shareCode.value}`)
    shareInfo.value = res.data
  } catch (error) {
    errorMsg.value = error.response?.data?.msg || error.message || '分享链接不存在或已失效'
  } finally {
    loading.value = false
  }
}

const handleDownload = async () => {
  if (!ensureExtractCode()) {
    return
  }
  downloading.value = true
  try {
    const url = `/api/share/public/${shareCode.value}/download?extractCode=${encodeURIComponent(extractCode.value.trim())}`
    window.open(url, '_self')
  } finally {
    downloading.value = false
  }
}

const saveToMyDisk = async () => {
  saving.value = true
  try {
    await request.post(
      `/share/public/${shareCode.value}/save`,
      {
        extractCode: extractCode.value.trim()
      },
      {
        skipAuthRedirect: true
      }
    )
    ElMessage.success('文件已保存到我的网盘')
    router.push('/app/disk')
  } catch (error) {
    const status = error.response?.status
    const message = error.response?.data?.msg || error.message || '保存失败'
    if (status === 401 || message.includes('请先登录') || message.includes('登录已失效')) {
      pendingSaveAfterLogin.value = true
      loginDialogVisible.value = true
      ElMessage.warning('请先登录后再保存到我的网盘')
      return
    }
    if (message.includes('该文件已在你的网盘中')) {
      ElMessage.warning('这是你自己的分享文件，已在当前登录账号的网盘中')
      return
    }
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}

const handleSaveToMyDisk = async () => {
  if (!ensureExtractCode()) {
    return
  }

  if (!userStore.token || !userStore.userInfo?.id) {
    pendingSaveAfterLogin.value = true
    if (!loginDialogVisible.value) {
      loginDialogVisible.value = true
    }
    return
  }

  await saveToMyDisk()
}

const handleSwitchAccount = () => {
  userStore.logout()
  pendingSaveAfterLogin.value = true
  loginForm.username = ''
  loginForm.password = ''
  loginDialogVisible.value = true
}

const handleDialogLogin = async () => {
  await loginFormRef.value.validate()
  loggingIn.value = true
  try {
    const res = await request.post('/login', {
      username: loginForm.username,
      password: loginForm.password
    })

    const {
      token,
      id,
      username,
      email,
      role,
      isAdmin,
      levelName,
      usedSpace,
      totalSpace,
      vipExpireTime
    } = res.data

    userStore.setToken(token)
    userStore.setUserInfo({
      id,
      username,
      email,
      role,
      isAdmin,
      levelName,
      usedSpace,
      totalSpace,
      vipExpireTime
    })

    loginDialogVisible.value = false
    ElMessage.success('登录成功')

    if (pendingSaveAfterLogin.value) {
      pendingSaveAfterLogin.value = false
      await saveToMyDisk()
      return
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '登录失败')
  } finally {
    loggingIn.value = false
  }
}

onMounted(() => {
  fetchShareInfo()
})
</script>

<style scoped>
.public-share-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  background: linear-gradient(135deg, #f4f7fb 0%, #e8edf6 100%);
}

.glass-card {
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  padding: 40px 32px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.12);
  text-align: center;
}

.status-box.error h2 {
  margin-top: 16px;
  color: #1f2937;
}

.status-box.error p {
  margin-top: 8px;
  color: #6b7280;
  line-height: 1.7;
}

.content-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-title {
  margin: 18px 0 8px;
  font-size: 24px;
  color: #111827;
}

.share-subtitle {
  margin: 0 0 24px;
  color: #6b7280;
  line-height: 1.7;
}

.login-state {
  margin: 0 0 18px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 13px;
  font-weight: 600;
}

.login-state.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.file-preview {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 22px;
  text-align: left;
}

.file-icon {
  color: #2563eb;
  flex-shrink: 0;
}

.file-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.file-name {
  color: #111827;
  font-weight: 600;
  word-break: break-all;
}

.file-expire {
  color: #6b7280;
  font-size: 13px;
}

.extract-area {
  width: 100%;
}

.extract-input {
  --el-input-border-radius: 14px;
}

.extract-input :deep(input) {
  height: 48px;
  text-align: center;
  letter-spacing: 4px;
  font-size: 16px;
  font-weight: 600;
}

.action-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.action-btn {
  height: 46px;
  border-radius: 14px;
}

.switch-account-row {
  margin-top: 8px;
}

@media (max-width: 640px) {
  .glass-card {
    padding: 28px 20px;
  }

  .action-row {
    grid-template-columns: 1fr;
  }
}
</style>
