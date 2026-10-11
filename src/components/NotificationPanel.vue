<template>
  <div class="notification-panel" v-loading="loading">
    <!-- Tab 切换 -->
    <div class="panel-tabs">
      <span
        :class="['tab', { active: activeTab === 'all' }]"
        @click="activeTab = 'all'"
      >全部</span>
      <span
        :class="['tab', { active: activeTab === 'message' }]"
        @click="activeTab = 'message'"
      >私信</span>
      <span class="tab-right">
        <el-button link type="primary" size="small" @click="handleMarkAllRead" :disabled="unreadTotal === 0">
          全部已读
        </el-button>
      </span>
    </div>

    <!-- 通知列表 -->
    <div class="panel-list" v-if="list.length > 0">
      <div
        v-for="item in filteredList"
        :key="item.itemType + '-' + (item.announcementId || item.messageId)"
        :class="['notify-item', { unread: !item.isRead }]"
        @click="handleItemClick(item)"
      >
        <div class="notify-icon">
          <el-icon v-if="item.itemType === 'announcement'" :size="18"><Bell /></el-icon>
          <el-icon v-else :size="18"><ChatDotRound /></el-icon>
        </div>
        <div class="notify-body">
          <div class="notify-title">{{ item.title }}</div>
          <div class="notify-desc" v-html="truncateContent(item.content)"></div>
          <div class="notify-time">{{ formatTime(item.createdAt) }}</div>
        </div>
        <div class="notify-unread-dot" v-if="!item.isRead"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="panel-empty" v-else>
      <el-icon :size="40" color="#c0c4cc"><BellFilled /></el-icon>
      <p>暂无{{ activeTab === 'all' ? '通知' : '私信' }}</p>
    </div>

    <!-- 分页（简化） -->
    <div class="panel-footer" v-if="total > pageSize">
      <el-button link size="small" @click="loadMore" :loading="loading">加载更多</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Bell, BellFilled, ChatDotRound } from '@element-plus/icons-vue'
import { getUnreadCount, getNotificationList, markAnnouncementRead, markMessageRead, markAllRead } from '@/api/notification'
import { ElMessage } from 'element-plus'

const props = defineProps({
  /** 外部触发刷新的版本号 */
  refreshVersion: { type: Number, default: 0 }
})

const emit = defineEmits(['unread-updated'])

// ===== 状态 =====
const loading = ref(false)
const list = ref([])
const unreadTotal = ref(0)
const activeTab = ref('all')
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)

let pollTimer = null

// ===== 计算属性 =====
const filteredList = computed(() => {
  if (activeTab.value === 'all') return list.value
  return list.value.filter(item => item.itemType === 'message')
})

// ===== 方法 =====
async function fetchUnreadCount() {
  try {
    const res = await getUnreadCount()
    if (res && res.code === 1) {
      const d = res.data
      unreadTotal.value = d.totalUnread || 0
      emit('unread-updated', unreadTotal.value)
    }
  } catch (e) { /* 静默 */ }
}

async function fetchList(append = false) {
  loading.value = true
  try {
    const res = await getNotificationList({ pageNum: pageNum.value, pageSize })
    if (res && res.code === 1) {
      const d = res.data
      total.value = d.total || 0
      if (append) {
        list.value.push(...(d.list || []))
      } else {
        list.value = d.list || []
      }
    }
  } catch (e) {
    console.error('获取通知列表失败', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  pageNum.value++
  fetchList(true)
}

async function handleItemClick(item) {
  // 标记已读
  try {
    if (!item.isRead) {
      if (item.itemType === 'announcement' && item.announcementId) {
        await markAnnouncementRead(item.announcementId)
      } else if (item.messageId) {
        await markMessageRead(item.messageId)
      }
      item.isRead = true
      unreadTotal.value = Math.max(0, unreadTotal.value - 1)
      emit('unread-updated', unreadTotal.value)
    }
  } catch (e) { /* 静默 */ }
}

async function handleMarkAllRead() {
  try {
    await markAllRead()
    list.value.forEach(item => { item.isRead = true })
    unreadTotal.value = 0
    emit('unread-updated', 0)
    ElMessage.success('已全部标记为已读')
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

function truncateContent(content) {
  if (!content) return ''
  const text = content.replace(/<[^>]+>/g, '') // 去掉 HTML 标签
  return text.length > 60 ? text.substring(0, 60) + '...' : text
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前'
  return d.toLocaleDateString()
}

// ===== 轮询未读数（每 30 秒） =====
function startPolling() {
  stopPolling()
  pollTimer = setInterval(fetchUnreadCount, 30000)
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// ===== 生命周期 =====
onMounted(() => {
  fetchUnreadCount()
  fetchList()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

// 监听外部刷新信号
import { watch } from 'vue'
watch(() => props.refreshVersion, () => {
  fetchUnreadCount()
  fetchList()
})
</script>

<style scoped>
.notification-panel {
  width: 360px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
}
.panel-tabs {
  display: flex;
  align-items: center;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #f0f0f0;
}
.tab {
  margin-right: 16px;
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  padding-bottom: 4px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab.active {
  color: #409eff;
  border-bottom-color: #409eff;
  font-weight: 600;
}
.tab-right { margin-left: auto; }
.panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.notify-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.notify-item:hover { background: #f5f7fa; }
.notify-item.unread { background: #ecf5ff; }
.notify-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
  color: #909399;
}
.notify-item.unread .notify-icon {
  background: #e6f1fc;
  color: #409eff;
}
.notify-body { flex: 1; min-width: 0; }
.notify-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notify-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notify-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}
.notify-unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
  flex-shrink: 0;
  margin-top: 6px;
}
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #c0c4cc;
}
.panel-empty p { margin-top: 12px; font-size: 13px; }
.panel-footer {
  text-align: center;
  padding: 8px;
  border-top: 1px solid #f0f0f0;
}
</style>
