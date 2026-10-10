<template>
  <div class="login-viewport">
    <div class="visual-panel">
      <div class="dark-base"></div>

      <div class="ripple ripple-1"></div>
      <div class="ripple ripple-2"></div>
      <div class="ripple ripple-3"></div>

      <transition-group name="abstract-fade" tag="div" class="image-slider">
        <div
          v-for="(img, index) in bgImages"
          :key="img.id"
          v-show="currentIndex === index"
          class="abstract-image-wrapper"
        >
          <div
            class="bg-image"
            :style="{ backgroundImage: img.url ? `url(${img.url})` : '' }"
            :class="{ 'is-active': currentIndex === index }"
          >
            <span v-if="!img.url" class="placeholder-text">抽象配图占位 - {{ img.id }}</span>
          </div>
        </div>
      </transition-group>

      <div class="brand-logo" @click="router.push('/')">LightDisk</div>
    </div>

    <div class="form-panel">
      <div class="login-card fade-up">
        <div class="card-header">
          <h2>登录到 <span class="highlight">LightDisk</span></h2>
          <p>请输入您的账号信息以继续</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" />
          </el-form-item>

          <el-form-item label="密码" prop="password" class="password-item">
            <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
          </el-form-item>

          <div class="form-options">
            <div class="options-left">
              <el-checkbox v-model="rememberMe">记住我</el-checkbox>
              <el-checkbox v-model="isAdminLogin" class="admin-checkbox">我是管理员</el-checkbox>
            </div>
            <span class="forgot-pass" @click="forgotDialogVisible = true">忘记密码？</span>
          </div>

          <el-button type="primary" class="btn-login" @click="handleLogin" :loading="loading">
            登录
          </el-button>
        </el-form>

        <div class="divider-wrapper">
          <div class="divider">
            <span>或</span>
          </div>
        </div>

        <div class="secondary-actions">
          <button class="btn-google" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 账号登录
          </button>
          <div class="auth-footer">
            <span class="tip-text">还没有账号？</span>
            <el-link type="primary" underline="never" @click="router.push('/register')">立即注册</el-link>
          </div>
        </div>

        <footer class="login-footer">
          <a href="#">隐私政策</a>
          <span>·</span>
          <a href="#">服务条款</a>
          <span>·</span>
          <span>© 2024 LightDisk</span>
        </footer>
      </div>
    </div>

    <el-dialog v-model="forgotDialogVisible" title="忘记密码" width="420px" center>
      <el-form :model="forgotForm" label-position="top">
        <el-form-item label="绑定邮箱">
          <el-input v-model="forgotForm.email" placeholder="请输入已绑定邮箱" />
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
          <el-input v-model="forgotForm.newPassword" type="password" placeholder="请输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forgotDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resettingPassword" @click="handleResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

const router = useRouter()
const userStore = useUserStore()

const bgImages = ref([
  { id: 1, url: '/images/pic4.png' },
  { id: 2, url: '/images/pic5.png' },
  { id: 3, url: '/images/pic6.png' }
])
const currentIndex = ref(0)
let sliderTimer = null

const loading = ref(false)
const formRef = ref(null)
const rememberMe = ref(false)
const isAdminLogin = ref(false)
const forgotDialogVisible = ref(false)
const resettingPassword = ref(false)
const forgotCountdown = ref(0)
let forgotTimer = null

const form = reactive({
  username: '',
  password: ''
})

const forgotForm = reactive({
  email: '',
  code: '',
  newPassword: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const startForgotCountdown = () => {
  forgotCountdown.value = 60
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

  const handleLogin = async () => {
    try {
      await formRef.value.validate()
      loading.value = true

    const res = await request.post('/login', {
      username: form.username,
      password: form.password,
      adminLogin: isAdminLogin.value
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

    ElMessage.success(`欢迎回来，${username}`)
    router.push('/app/disk')
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleSendResetCode = async () => {
  if (!forgotForm.email) {
    ElMessage.warning('请输入已绑定邮箱')
    return
  }
  try {
    const res = await request.post('/password/reset/send-code', {
      email: forgotForm.email
    })
    ElMessage.success(res.data || '验证码已发送')
    startForgotCountdown()
  } catch (error) {}
}

const handleResetPassword = async () => {
  if (!forgotForm.email || !forgotForm.code || !forgotForm.newPassword) {
    ElMessage.warning('请完整填写邮箱、验证码和新密码')
    return
  }
  resettingPassword.value = true
  try {
    await request.post('/password/reset', {
      email: forgotForm.email,
      code: forgotForm.code,
      newPassword: forgotForm.newPassword
    })
    ElMessage.success('密码重置成功，请重新登录')
    forgotDialogVisible.value = false
    forgotForm.code = ''
    forgotForm.newPassword = ''
  } catch (error) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '重置失败')
  } finally {
    resettingPassword.value = false
  }
}

onMounted(() => {
  sliderTimer = setInterval(() => {
    if (bgImages.value.length > 0) {
      currentIndex.value = (currentIndex.value + 1) % bgImages.value.length
    }
  }, 6000)
})

onBeforeUnmount(() => {
  clearInterval(sliderTimer)
  clearInterval(forgotTimer)
})
</script>

<style scoped>
.auth-footer {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
}

.tip-text {
  color: #637282;
}

.login-viewport {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: row;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  background-color: #ffffff;
}

.visual-panel {
  flex: 6;
  position: relative;
  background-color: #0a0a0a;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark-base {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0f1115 0%, #050505 100%);
  z-index: 0;
}

.ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  z-index: 1;
}

.ripple-1 {
  width: 80vh;
  height: 80vh;
  animation: morph-rotate 25s linear infinite;
  background: rgba(255, 255, 255, 0.02);
}

.ripple-2 {
  width: 60vh;
  height: 60vh;
  animation: morph-rotate 20s linear infinite reverse;
  border: 1px solid rgba(0, 97, 255, 0.1);
}

.ripple-3 {
  width: 100vh;
  height: 100vh;
  animation: morph-rotate 35s linear infinite;
}

@keyframes morph-rotate {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
    border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  }
  34% {
    border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%;
  }
  67% {
    border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%;
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
    border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  }
}

.image-slider {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
}

.abstract-image-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -webkit-mask-image: -webkit-linear-gradient(-15deg, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 80%);
  mask-image: linear-gradient(105deg, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 80%);
}

.bg-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-color: #1a1c23;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(1);
  transition: transform 6s ease-out;
}

.bg-image.is-active {
  transform: scale(1.08);
}

.placeholder-text {
  color: rgba(255, 255, 255, 0.2);
  font-size: 1.5rem;
  letter-spacing: 2px;
}

.brand-logo {
  position: absolute;
  top: 24px;
  left: 24px;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  z-index: 10;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.abstract-fade-enter-active,
.abstract-fade-leave-active {
  transition: opacity 1.5s ease-in-out;
}

.abstract-fade-enter-from,
.abstract-fade-leave-to {
  opacity: 0;
}

.form-panel {
  flex: 4;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
  overflow-y: auto;
  z-index: 10;
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 40px 0;
}

.card-header {
  margin-bottom: 24px;
}

.card-header h2 {
  font-size: 32px;
  font-weight: 700;
  color: #1D1D1F;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.card-header .highlight {
  color: #007AFF;
}

.card-header p {
  color: #6E6E73;
  font-size: 14px;
  margin: 0;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}

.password-item {
  margin-bottom: 16px;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
  color: #424245;
  padding-bottom: 8px;
  line-height: 1;
}

:deep(.el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label::before) {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #007AFF;
  margin-right: 6px;
  vertical-align: middle;
}

:deep(.el-input__wrapper) {
  height: 44px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #E5E5E7 inset;
  background-color: #ffffff;
  padding: 0 14px;
  transition: all 0.2s ease;
}

:deep(.el-input__inner) {
  color: #1D1D1F;
  font-size: 14px;
}

:deep(.el-input__inner::placeholder) {
  color: #86868B;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #007AFF inset, 0 0 0 3px rgba(0, 122, 255, 0.2) !important;
}

:deep(.el-input__password) {
  color: #86868B;
  transition: color 0.2s;
}

:deep(.el-input__password:hover) {
  color: #424245;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.options-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-checkbox :deep(.el-checkbox__label) {
  color: #007AFF;
  font-weight: 500;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #007AFF;
  border-color: #007AFF;
}

:deep(.el-checkbox__inner) {
  background-color: #ffffff;
  border-color: #c7c7cc;
}

:deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
  border-color: #007AFF;
}

:deep(.el-checkbox__label) {
  color: #424245;
  font-size: 14px;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #1D1D1F;
}

.forgot-pass {
  color: #007AFF;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.forgot-pass:hover {
  color: #0051A8;
}

.btn-login {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  background-color: #007AFF;
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
  transition: all 0.2s ease;
}

.btn-login:hover {
  background-color: #0051A8;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.divider-wrapper {
  margin: 24px 0;
  display: flex;
  justify-content: center;
}

.divider {
  width: 70%;
  display: flex;
  align-items: center;
  color: #6E6E73;
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background-color: #E5E5E7;
}

.divider span {
  padding: 0 8px;
}

.btn-google {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  border: 1px solid #E5E5E7;
  background-color: #ffffff;
  color: #1D1D1F;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-google:hover {
  background-color: #F5F5F7;
}

.login-footer {
  margin-top: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #86868B;
  font-size: 12px;
}

.login-footer a {
  color: #86868B;
  text-decoration: none;
  transition: color 0.2s;
}

.login-footer a:hover {
  color: #6E6E73;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.code-row :deep(.el-input) {
  flex: 1;
}

.fade-up {
  animation: fadeUpIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes fadeUpIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .login-viewport {
    flex-direction: column-reverse;
  }

  .visual-panel {
    flex: none;
    width: 100%;
    height: 30vh;
  }

  .form-panel {
    flex: 1;
    width: 100%;
    padding: 20px;
    align-items: flex-start;
  }

  .code-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
