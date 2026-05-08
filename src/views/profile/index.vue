<template>
  <div class="profile-container fade-up">
    <section class="profile-card header-section">
      <div class="avatar-wrapper">
        <el-avatar
            :size="100"
            :src="userStore.userInfo?.avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'"
        />
        <div class="upload-overlay"><el-icon><Camera /></el-icon></div>
      </div>
      <div class="user-info">
        <div class="name-row">
          <h1 class="username">{{ userStore.userInfo?.username }}</h1>
          <el-tag :type="isVip ? 'warning' : 'info'" effect="dark" round size="small">
            {{ isVip ? '永久 VIP' : '普通用户' }}
          </el-tag>
        </div>
        <p class="user-meta">账号 ID: {{ userStore.userInfo?.id }} · 注册于 2026-04-17</p>
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
              <span class="label">已用空间：</span>
              <span class="value">{{ formattedUsed }}</span>
            </div>
            <div class="detail-item">
              <span class="dot total"></span>
              <span class="label">总空间：</span>
              <span class="value">{{ formattedTotal }}</span>
            </div>
            <el-button type="primary" class="upgrade-btn" round>
              <el-icon><Top /></el-icon> 提升等级 / 扩容
            </el-button>
          </div>
        </div>
      </section>

      <div class="settings-grid">
        <div class="profile-card setting-item">
          <h3 class="card-title"><el-icon><Lock /></el-icon> 账号安全</h3>
          <div class="setting-row">
            <div class="info">
              <div class="label">邮箱绑定</div>
              <div class="val">{{ userStore.userInfo?.email || '未绑定' }}</div>
            </div>
            <el-button link type="primary">修改</el-button>
          </div>
          <div class="setting-row">
            <div class="info">
              <div class="label">登录密码</div>
              <div class="val">定期修改密码保护账号</div>
            </div>
            <el-button link type="primary" @click="passwordDialogVisible = true">修改密码</el-button>
          </div>
        </div>

        <div class="profile-card setting-item vip-card">
          <h3 class="card-title"><el-icon><Medal /></el-icon> 会员特权</h3>
          <p class="vip-deadline">有效期至：{{ vipExpireTime }}</p>
          <ul class="privilege-list">
            <li><el-icon><CircleCheckFilled /></el-icon> 单文件上传上限 2GB</li>
            <li><el-icon><CircleCheckFilled /></el-icon> 极速下载专属通道</li>
            <li><el-icon><CircleCheckFilled /></el-icon> 分享链接自定义提取码</li>
          </ul>
        </div>

        <div class="profile-card setting-item">
          <h3 class="card-title"><el-icon><Operation /></el-icon> 偏好设置</h3>
          <div class="setting-row">
            <span>界面风格</span>
            <el-switch v-model="isDarkMode" active-text="暗黑" inactive-text="明亮" />
          </div>
          <div class="setting-row">
            <span>分片上传</span>
            <el-switch v-model="enableChunk" />
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="passwordDialogVisible" title="安全中心 - 修改密码" width="400px" center round>
      <el-form :model="pwdForm" label-position="top">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdatePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { Camera, Top, Lock, Medal, Operation, CircleCheckFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const userStore = useUserStore()

// 状态控制
const isVip = ref(false)
const vipExpireTime = ref('2099-12-31') // 示例
const isDarkMode = ref(false)
const enableChunk = ref(true)
const passwordDialogVisible = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '' })

// 容量数据 (同步 BasicLayout 逻辑)
const storageInfo = ref({ usedSpace: 0, totalSpace: 10737418240 })
const storagePercentage = computed(() => (storageInfo.value.usedSpace / storageInfo.value.totalSpace) * 100 || 0)
const formattedUsed = computed(() => (storageInfo.value.usedSpace / (1024 ** 3)).toFixed(2) + ' GB')
const formattedTotal = computed(() => (storageInfo.value.totalSpace / (1024 ** 3)).toFixed(0) + ' GB')
const storageColor = computed(() => {
  if (storagePercentage.value > 90) return '#F56C6C'
  if (storagePercentage.value > 70) return '#E6A23C'
  return '#007AFF'
})

// 获取容量
const loadStorage = async () => {
  try {
    const res = await request.get('/file/user/info')
    storageInfo.value = res.data
  } catch (e) {}
}

// 修改密码处理
const handleUpdatePassword = () => {
  ElMessage.success({
    message: '密码修改成功，请重新登录',
    customClass: 'glass-message'
  })
  passwordDialogVisible.value = false
  // 这里可以调用接口...
}

onMounted(() => {
  loadStorage()
})
</script>

<style scoped>
.profile-container {
  max-width: 1100px;
  margin: 0 auto;
}

/* 通用卡片样式 */
.profile-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  margin-bottom: 24px;
  transition: transform 0.3s ease;
}

/* 名片区 */
.header-section {
  display: flex;
  align-items: center;
  gap: 32px;
  background: linear-gradient(to right, #ffffff, #f9fafb);
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}
.upload-overlay {
  position: absolute;
  bottom: 0; right: 0;
  background: #007AFF;
  color: white;
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 3px solid white;
}

.username {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.user-meta {
  color: #86868b;
  font-size: 14px;
  margin: 0;
}

/* 布局网格 */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 24px;
}

/* 存储卡片 */
.storage-content {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 20px 0;
}
.percentage-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #1d1d1f;
}
.percentage-label {
  font-size: 12px;
  color: #86868b;
}

.storage-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-item {
  display: flex;
  align-items: center;
  font-size: 14px;
}
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}
.dot.used { background: #007AFF; }
.dot.total { background: #e5e5e7; }
.upgrade-btn { margin-top: 12px; }

/* 设置项 */
.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1d1d1f;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f7;
}
.setting-row:last-child { border-bottom: none; }
.setting-row .label { font-size: 12px; color: #86868b; margin-bottom: 4px; }
.setting-row .val { font-size: 14px; color: #1d1d1f; }

/* VIP 卡片特供 */
.vip-card {
  background: linear-gradient(135deg, #1d1d1f 0%, #434343 100%);
  color: white;
}
.vip-card .card-title, .vip-card .vip-deadline { color: #f5c05d; }
.vip-deadline { font-size: 12px; margin-bottom: 16px; opacity: 0.8; }
.privilege-list {
  list-style: none; padding: 0; margin: 0;
  font-size: 13px; display: flex; flex-direction: column; gap: 10px;
}
.privilege-list .el-icon { margin-right: 8px; color: #f5c05d; }

/* 入场动画 */
.fade-up {
  animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>