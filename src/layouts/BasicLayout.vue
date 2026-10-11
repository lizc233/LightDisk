<template>
  <el-container class="layout-container">
    <el-aside width="240px" class="aside-panel">
      <div class="logo-section">
        <div class="logo-icon">L</div>
        <span class="logo-text">LightDisk</span>
      </div>

      <el-menu :default-active="activeMenu" class="side-menu" router>
        <el-menu-item index="/app/disk">
          <el-icon><Document /></el-icon>
          <span>全部文件</span>
        </el-menu-item>
        <el-menu-item index="/app/share">
          <el-icon><Share /></el-icon>
          <span>我的分享</span>
        </el-menu-item>
        <el-menu-item index="/app/recycle">
          <el-icon><Delete /></el-icon>
          <el-badge :value="recycleReminderCount" :hidden="recycleReminderCount <= 0" class="menu-badge">
            <span>回收站</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/app/ai">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI 助手</span>
        </el-menu-item>
        <el-menu-item index="/app/messages">
          <el-icon><Message /></el-icon>
          <el-badge :value="unreadCount" :hidden="unreadCount <= 0" :max="99" class="menu-badge">
            <span>私信中心</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item v-if="Number(userStore.userInfo?.isAdmin || 0) === 1" index="/app/admin">
          <el-icon><Setting /></el-icon>
          <span>后台管理</span>
        </el-menu-item>
      </el-menu>

      <div class="notice-card">
        <div class="notice-title">系统公告</div>
        <el-carousel height="88px" direction="vertical" :autoplay="true" indicator-position="none">
          <el-carousel-item v-for="item in notices" :key="item">
            <p class="notice-item">{{ item }}</p>
          </el-carousel-item>
        </el-carousel>
      </div>
    </el-aside>

    <el-container class="main-shell">
      <el-header class="header-panel">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <div class="storage-info">
            <span class="storage-label">存储空间</span>
            <el-progress
              :percentage="storagePercentage"
              :stroke-width="8"
              stroke-linecap="round"
              :show-text="false"
              class="storage-bar"
            />
            <span class="storage-text">{{ formattedUsed }} / {{ formattedTotal }}</span>
          </div>

          <el-tag effect="dark" :type="preferencesStore.isDark ? 'success' : 'info'" round>
            {{ preferencesStore.isDark ? '暗黑主题' : '明亮主题' }}
          </el-tag>

          <!-- 通知铃铛 -->
          <el-popover
            v-model:visible="showNotificationPanel"
            placement="bottom-end"
            :width="380"
            trigger="click"
            popper-class="notification-popper"
          >
            <template #reference>
              <div class="bell-trigger">
                <el-badge :value="unreadCount" :hidden="unreadCount <= 0" :max="99">
                  <el-icon :size="20"><Bell /></el-icon>
                </el-badge>
              </div>
            </template>
            <NotificationPanel
              :refresh-version="notificationRefreshKey"
              @unread-updated="handleUnreadUpdated"
              @write="openWriteDialog"
              @close="showNotificationPanel = false"
            />
          </el-popover>

          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-profile">
              <el-avatar
                :size="34"
                :src="userStore.userInfo?.avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'"
              />
              <div class="user-meta">
                <span class="username">{{ userStore.userInfo?.username || '未命名用户' }}</span>
                <small>{{ userStore.userInfo?.levelName || '普通用户' }}</small>
              </div>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="settings">设置</el-dropdown-item>
                <el-dropdown-item command="logout" divided style="color: #f56c6c;">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="page-main">
        <div class="content-card">
          <router-view v-slot="{ Component }">
            <transition name="fade-transform" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </el-main>
    </el-container>

    <!-- 写私信弹窗 -->
    <WriteMessageDialog v-model="writeDialogVisible" @sent="handleMessageSent" />
  </el-container>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, ChatDotRound, Delete, Document, Message, Setting, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'
import { usePreferencesStore } from '@/stores/preferences'
import { getRecentAnnouncements, getSidebarAnnouncements } from '@/api/notification'
import NotificationPanel from '@/components/NotificationPanel.vue'
import WriteMessageDialog from '@/components/WriteMessageDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const preferencesStore = usePreferencesStore()

const storageInfo = ref({
  usedSpace: Number(userStore.userInfo?.usedSpace || 0),
  totalSpace: Number(userStore.userInfo?.totalSpace || 10 * 1024 ** 3)
})

const currentPageName = computed(() => {
  const map = {
    '/app/disk': '全部文件',
    '/app/share': '我的分享',
    '/app/recycle': '回收站',
    '/app/admin': '后台管理',
    '/app/profile': '个人中心',
    '/app/settings': '设置中心',
    '/app/ai': 'AI 助手',
    '/app/messages': '私信中心'
  }
  return map[route.path] || '网盘'
})

const storagePercentage = computed(() => {
  if (!storageInfo.value.totalSpace) {
    return 0
  }
  return Math.min((storageInfo.value.usedSpace / storageInfo.value.totalSpace) * 100, 100)
})

const formatSpace = (value) => {
  const bytes = Number(value || 0)
  const gb = bytes / 1024 ** 3
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 100 ? 0 : 2)} GB`
  }
  const mb = bytes / 1024 ** 2
  return `${mb.toFixed(2)} MB`
}

const formattedUsed = computed(() => formatSpace(storageInfo.value.usedSpace))
const formattedTotal = computed(() => formatSpace(storageInfo.value.totalSpace))
const recycleReminderCount = computed(() => Number(userStore.userInfo?.recycleReminderCount || 0))

const fetchUserData = async () => {
  try {
    const res = await request.get('/file/user/info')
    storageInfo.value = {
      usedSpace: Number(res.data?.usedSpace || 0),
      totalSpace: Number(res.data?.totalSpace || 0)
    }
    userStore.setUserInfo({
      ...userStore.userInfo,
      ...res.data
    })
  } catch (error) {
    console.error('同步用户信息失败', error)
  }
}

const handleCommand = (command) => {
  if (command === 'logout') {
    userStore.logout()
    ElMessage.success('已安全退出')
    router.push('/login')
    return
  }

  if (command === 'profile') {
    router.push('/app/profile')
    return
  }

  if (command === 'settings') {
    router.push('/app/settings')
  }
}

onMounted(() => {
  fetchUserData()
  fetchNotices()
})

const activeMenu = computed(() => route.path)

// ===== 通知系统 =====
const notices = ref([])
const unreadCount = ref(0)
const showNotificationPanel = ref(false)
const notificationRefreshKey = ref(0)
const writeDialogVisible = ref(false)

// 打开写私信弹窗
const openWriteDialog = () => {
  showNotificationPanel.value = false
  writeDialogVisible.value = true
}

// 私信发送成功后刷新未读数
const handleMessageSent = () => {
  notificationRefreshKey.value++
}

// 获取侧边栏轮播公告：优先「最近公告+系统通知」混合（最近3条），失败退回侧边栏接口，再退回默认文案
const fetchNotices = async () => {
  try {
    const res = await getRecentAnnouncements(3)
    if (res && (res.code === 1 || res.code === 200) && (res.data || []).length) {
      notices.value = res.data.map(item => item.title)
      return
    }
  } catch (e) { /* 继续尝试兜底 */ }

  try {
    const res = await getSidebarAnnouncements()
    if (res && (res.code === 1 || res.code === 200) && (res.data || []).length) {
      notices.value = (res.data || []).map(item => item.title)
      return
    }
  } catch (e) { /* 使用默认 */ }

  notices.value = [
    '欢迎使用 LightDisk 云盘',
    '回收站现已支持 30 天有效期',
    '设置中心已接入主题与上传偏好'
  ]
}

// 未读数更新回调
const handleUnreadUpdated = (count) => {
  unreadCount.value = count
}

// 面板打开时刷新一次数据
watch(showNotificationPanel, (visible) => {
  if (visible) notificationRefreshKey.value++
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(16, 163, 127, 0.12), transparent 26%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.1), transparent 24%),
    var(--app-bg);
  overflow: hidden;
}

.aside-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  backdrop-filter: blur(16px);
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.logo-section {
  padding: 28px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #19c37d);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(16, 163, 127, 0.22);
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.side-menu {
  border-right: none !important;
  background: transparent !important;
  flex: 1;
}

.side-menu :deep(.el-menu-item) {
  margin: 8px 16px;
  height: 48px;
  border-radius: 14px;
  color: var(--text-secondary);
  transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.side-menu :deep(.el-menu-item:hover) {
  background: var(--accent-soft) !important;
  color: var(--accent);
  transform: translateX(4px);
}

.side-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, var(--accent), #19c37d) !important;
  color: #fff !important;
  box-shadow: 0 10px 24px rgba(16, 163, 127, 0.22);
}

.notice-card {
  margin: 16px;
  padding: 16px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 16px;
}

.notice-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.notice-item {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 12px;
}

.main-shell {
  overflow: hidden;
}

.header-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  background: var(--surface);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-color);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.storage-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.storage-label,
.storage-text {
  color: var(--text-secondary);
  font-size: 12px;
}

.storage-bar {
  width: 140px;
}

.menu-badge :deep(.el-badge__content) {
  transform: translateY(-2px);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 18px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.user-profile:hover {
  background: var(--accent-soft);
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.username {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.user-meta small {
  color: var(--text-secondary);
}

.bell-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}
.bell-trigger:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.page-main {
  padding: 24px;
  overflow-y: auto;
}

.content-card {
  min-height: calc(100vh - 126px);
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 22px;
  padding: 24px;
  box-shadow: var(--shadow-soft);
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.28s ease;
}

.fade-transform-enter-from,
.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
