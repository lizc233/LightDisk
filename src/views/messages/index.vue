<template>
  <div class="messages-page">
    <PageHeader eyebrow="Messages" title="私信中心">
      <template #sub>
        站内私信按「邮件」语义：知道对方 ID 或用户名即可发送，无需对方同意。
      </template>
      <template #actions>
        <el-button v-if="isAdminUser" type="warning" :icon="Bell" @click="noticeVisible = true">发通知</el-button>
        <el-button type="primary" :icon="Promotion" @click="openWrite()">写私信</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="main-tabs" v-show="!detailMsg">
      <!-- ==================== 收件箱 ==================== -->
      <el-tab-pane name="inbox">
        <template #label>
          <span class="tab-label"><el-icon><Message /></el-icon>收件箱</span>
        </template>

        <div class="group-bar">
          <el-radio-group v-model="group" size="small" @change="reloadMessages">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="contact">联系人</el-radio-button>
            <el-radio-button label="stranger">陌生消息</el-radio-button>
          </el-radio-group>
          <span class="group-tip">
            「全部」= 系统通知 + 所有私信；「联系人 / 陌生」仅筛选私信
          </span>
        </div>

        <div v-loading="messagesLoading" class="msg-list">
          <el-empty v-if="!messages.length" description="暂无消息" />

          <article
            v-for="msg in messages"
            :key="msg.id"
            :class="['msg-item', { unread: msg.isRead === 0 }]"
            @click="openDetail(msg)"
          >
            <div class="msg-avatar">
              <el-icon :size="18"><ChatDotRound /></el-icon>
            </div>

            <div class="msg-body">
              <div class="msg-top">
                <strong class="msg-from">{{ msg.senderName }}</strong>
                <span class="from-id" v-if="msg.senderId">#{{ msg.senderId }}</span>
                <el-tag v-if="msg.itemType === 'announcement'" size="small" type="info" effect="plain">系统通知</el-tag>
                <el-tag v-else-if="msg.messageType === 2" size="small" type="warning" effect="plain">管理员</el-tag>
                <el-tag v-else-if="msg.messageType === 4 && !msg.senderIsContact" size="small" type="danger" effect="plain">
                  陌生
                </el-tag>
                <el-tag v-else-if="msg.senderIsContact" size="small" type="success" effect="plain">联系人</el-tag>
                <span class="msg-time">{{ formatRelativeTime(msg.createdAt) }}</span>
              </div>
              <h4 class="msg-title">
                {{ msg.title }}
                <el-icon v-if="parseAttachments(msg.attachments).length" class="attach-flag" :size="13"><Paperclip /></el-icon>
              </h4>
              <p class="msg-content">{{ plainText(msg.content) }}</p>

              <div class="msg-actions" @click.stop>
                <el-button v-if="msg.isRead === 0" link type="primary" size="small" @click="handleMarkRead(msg)">
                  标记已读
                </el-button>
                <el-button
                  v-if="msg.itemType !== 'announcement' && msg.senderId"
                  link
                  type="primary"
                  size="small"
                  @click="openWrite({ id: msg.senderId, username: msg.senderName })"
                >
                  回信
                </el-button>
                <el-button v-if="msg.itemType !== 'announcement'" link type="danger" size="small" @click="handleDeleteMessage(msg)">删除</el-button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="total > pageSize" class="pager">
          <el-pagination
            layout="prev, pager, next, total"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="handlePageChange"
          />
        </div>
      </el-tab-pane>

      <!-- ==================== 联系人 ==================== -->
      <el-tab-pane name="contacts">
        <template #label>
          <span class="tab-label"><el-icon><Star /></el-icon>联系人</span>
        </template>

        <div class="toolbar">
          <el-button type="primary" :icon="CirclePlus" @click="openAdd">添加联系人</el-button>
          <span class="toolbar-tip">单向通讯录：把对方加为联系人不需要对方同意，仅方便你快速选人和备注</span>
        </div>

        <el-table v-loading="contactsLoading" :data="contacts" style="width: 100%">
          <el-table-column label="用户名" min-width="160">
            <template #default="{ row }">
              <span class="cell-strong">{{ row.username }}</span>
              <span class="cell-sub">#{{ row.userId }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="140">
            <template #default="{ row }">
              <span v-if="row.remark">{{ row.remark }}</span>
              <span v-else class="cell-sub">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openWrite({ id: row.userId, username: row.username })">
                发私信
              </el-button>
              <el-button link type="primary" size="small" @click="handleEditRemark(row)">改备注</el-button>
              <el-button link type="warning" size="small" @click="handleBlock(row.userId, row.username)">拉黑</el-button>
              <el-button link type="danger" size="small" @click="handleRemoveContact(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ==================== 黑名单 ==================== -->
      <el-tab-pane name="blocks">
        <template #label>
          <span class="tab-label"><el-icon><Warning /></el-icon>黑名单</span>
        </template>

        <p class="toolbar-tip block-tip">
          拉黑后，对方无法再给你发送私信；你可以在下方随时取消拉黑。
        </p>

        <el-table v-loading="blocksLoading" :data="blocks" style="width: 100%">
          <el-table-column label="用户名" min-width="200">
            <template #default="{ row }">
              <span class="cell-strong">{{ row.username }}</span>
              <span class="cell-sub">#{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleUnblock(row)">取消拉黑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 消息详情（页面内覆盖，浏览器式前进/后退） ==================== -->
    <transition name="detail-slide">
      <section v-if="detailMsg" class="detail-view">
        <div class="detail-toolbar">
          <el-button link type="primary" :icon="ArrowLeft" @click="closeDetail">返回收件箱</el-button>
          <div class="detail-toolbar-right">
            <el-button
              v-if="detailMsg.itemType !== 'announcement' && detailMsg.senderId"
              link
              type="primary"
              size="small"
              @click="openWrite({ id: detailMsg.senderId, username: detailMsg.senderName })"
            >回信</el-button>
            <el-button
              v-if="detailMsg.isRead === 0"
              link
              type="primary"
              size="small"
              @click="handleMarkRead(detailMsg)"
            >标记已读</el-button>
            <el-button
              v-if="detailMsg.itemType !== 'announcement'"
              link
              type="danger"
              size="small"
              @click="handleDeleteMessage(detailMsg)"
            >删除</el-button>
          </div>
        </div>

        <article :class="['detail-card', { unread: detailMsg.isRead === 0 }]">
          <div class="detail-head">
            <el-tag v-if="detailMsg.itemType === 'announcement'" size="small" type="info" effect="plain">系统通知</el-tag>
            <el-tag v-else-if="detailMsg.messageType === 2" size="small" type="warning" effect="plain">管理员</el-tag>
            <el-tag v-else-if="detailMsg.senderIsContact" size="small" type="success" effect="plain">联系人</el-tag>
            <el-tag v-else size="small" type="danger" effect="plain">陌生</el-tag>
          </div>

          <h2 class="detail-title">{{ detailMsg.title }}</h2>
          <div class="detail-meta">
            <span>发件人：<strong>{{ detailMsg.senderName }}</strong><span v-if="detailMsg.senderId" class="meta-id">（#{{ detailMsg.senderId }}）</span></span>
            <span>{{ formatFullTime(detailMsg.createdAt) }}</span>
          </div>

          <el-divider />

          <div class="detail-content">
            <!-- 公告内容是管理员编写的富文本，允许渲染 -->
            <div v-if="detailMsg.itemType === 'announcement'" v-html="detailMsg.content"></div>
            <template v-else>{{ detailMsg.content }}</template>
          </div>

          <!-- 附件（预留：附件转存/下载功能后续接入） -->
          <div v-if="detailAttachments.length" class="detail-attachments">
            <p class="attach-title">
              <el-icon><Paperclip /></el-icon>
              附件（{{ detailAttachments.length }}）
            </p>
            <div v-for="att in detailAttachments" :key="att.fileId" class="attach-item">
              <el-icon class="attach-icon"><Document /></el-icon>
              <span class="attach-name">{{ att.name }}</span>
              <span class="attach-size">{{ formatSize(att.size) }}</span>
              <el-button
                v-if="detailMsg.itemType !== 'announcement'"
                link
                type="primary"
                size="small"
                @click="handleSaveAttachment(att)"
              >转存</el-button>
            </div>
            <p class="attach-tip">点击「转存」把附件保存到你的网盘根目录（同一份物理存储，秒转不占双倍空间）</p>
          </div>
        </article>
      </section>
    </transition>

    <!-- 写私信 -->
    <WriteMessageDialog v-model="writeVisible" :preset="writePreset" @sent="onMessageSent" />

    <!-- 管理员发通知 -->
    <SendNoticeDialog v-model="noticeVisible" @sent="reloadMessages" />

    <!-- 添加联系人 -->
    <el-dialog v-model="addVisible" title="添加联系人" width="460px" append-to-body>
      <el-form label-width="70px">
        <el-form-item label="用户" required>
          <el-select
            v-model="addForm.contactId"
            filterable
            remote
            reserve-keyword
            :remote-method="handleAddSearch"
            :loading="addSearching"
            placeholder="输入 ID 或用户名搜索"
            style="width: 100%"
          >
            <el-option v-for="u in addOptions" :key="u.id" :label="`${u.username}（#${u.id}）`" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="addForm.remark" maxlength="50" placeholder="可选，方便自己识别" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="submitAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Bell,
  ChatDotRound,
  CirclePlus,
  Document,
  Message,
  Paperclip,
  Promotion,
  Star,
  Warning
} from '@element-plus/icons-vue'
import {
  addContact,
  blockUser,
  getBlocks,
  getContacts,
  removeContact,
  searchUsers,
  unblockUser,
  updateContactRemark
} from '@/api/contact'
import { deleteMessage, getNotificationList, getMessageList, markAnnouncementRead, markMessageRead, saveMessageAttachment } from '@/api/notification'
import { formatRelativeTime } from '@/utils/datetime'
import WriteMessageDialog from '@/components/WriteMessageDialog.vue'
import SendNoticeDialog from '@/components/SendNoticeDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const isAdminUser = computed(() => Number(userStore.userInfo?.isAdmin || 0) >= 1)

const activeTab = ref('inbox')
const noticeVisible = ref(false)

// ===== 收件箱 =====
const group = ref('all')
const messages = ref([])
const messagesLoading = ref(false)
const pageNum = ref(1)
const pageSize = ref(8)
const total = ref(0)

async function loadMessages() {
  messagesLoading.value = true
  try {
    if (group.value === 'all') {
      // 全部 = 系统通知(announcement 表) + 个人私信(personal_message 表)，走合并接口
      const res = await getNotificationList({ pageNum: pageNum.value, pageSize: pageSize.value })
      if (res && res.code === 1) {
        messages.value = (res.data?.list || []).map(normalizeNotification)
        total.value = Number(res.data?.total || 0)
      }
    } else {
      // 联系人 / 陌生分组只筛私信
      const res = await getMessageList({ pageNum: pageNum.value, pageSize: pageSize.value, group: group.value })
      if (res && res.code === 1) {
        messages.value = (res.data?.list || []).map((m) => ({ ...m, itemType: 'message', messageId: m.id }))
        total.value = Number(res.data?.total || 0)
      }
    }
  } finally {
    messagesLoading.value = false
  }
}

/**
 * 把合并接口的 NotificationItemVO 归一化为收件箱行结构：
 * - announcement → 系统通知（发件人=系统，用 announcementId 标记已读）
 * - message     → 私信（用 messageId 标记已读 / 删除）
 */
function normalizeNotification(item) {
  if (item.itemType === 'announcement') {
    return {
      id: `a_${item.announcementId}`,
      itemType: 'announcement',
      announcementId: item.announcementId,
      title: item.title,
      content: item.content,
      senderName: '系统',
      senderId: null,
      messageType: 1,
      isRead: item.isRead ? 1 : 0,
      createdAt: item.createdAt
    }
  }
  return {
    ...item,
    id: `m_${item.messageId}`,
    itemType: 'message',
    messageId: item.messageId || item.id,
    senderName: item.senderName || '未知用户',
    isRead: item.isRead ? 1 : 0
  }
}

function reloadMessages() {
  pageNum.value = 1
  loadMessages()
}

function handlePageChange(page) {
  pageNum.value = page
  loadMessages()
}

// ===== 未读数跨组件同步 =====
// 私信中心标记已读/删除后广播事件，铃铛面板（NotificationPanel）监听后立即刷新
function notifyUnreadChanged() {
  window.dispatchEvent(new Event('ld:refresh-unread'))
}

// ===== 消息详情（页面内覆盖） =====
const detailMsg = ref(null)
const detailAttachments = ref([])

function openDetail(msg) {
  detailMsg.value = msg
  detailAttachments.value = parseAttachments(msg.attachments)
  // 打开详情即视为阅读，未读则自动标记已读
  if (msg.isRead === 0) {
    handleMarkRead(msg)
  }
}

function closeDetail() {
  detailMsg.value = null
  detailAttachments.value = []
}

/** 附件一键转存到我的网盘 */
async function handleSaveAttachment(att) {
  if (!detailMsg.value || !detailMsg.value.messageId) return
  try {
    await saveMessageAttachment(detailMsg.value.messageId, att.fileId)
    ElMessage.success(`「${att.name}」已转存到你的网盘根目录`)
  } catch (e) {
    /* 拦截器已提示（如同名冲突/文件失效） */
  }
}

/** 解析消息的附件 JSON（容错） */
function parseAttachments(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((a) => a && a.name) : []
  } catch {
    return []
  }
}

/** 去掉 HTML 标签取纯文本（列表摘要用） */
function plainText(content) {
  if (!content) return ''
  return content.replace(/<[^>]+>/g, '').trim()
}

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

/** 详情页显示完整时间（yyyy-MM-dd HH:mm），兼容后端数组格式 */
function formatFullTime(value) {
  const d = toDate(value)
  if (!d) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDate(value) {
  if (!value) return null
  if (Array.isArray(value) && value.length >= 6) {
    return new Date(value[0], value[1] - 1, value[2], value[3], value[4], value[5] || 0)
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

async function handleMarkRead(msg) {
  try {
    if (msg.itemType === 'announcement') {
      await markAnnouncementRead(msg.announcementId)
    } else {
      await markMessageRead(msg.messageId)
    }
    if (msg.isRead === 0) {
      msg.isRead = 1
      notifyUnreadChanged()
    }
  } catch (e) { /* 静默 */ }
}

async function handleDeleteMessage(msg) {
  if (msg.itemType === 'announcement') return // 系统通知不允许在收件箱删除
  try {
    await ElMessageBox.confirm(`确认删除「${msg.title}」吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  await deleteMessage(msg.messageId)
  ElMessage.success('已删除')
  if (detailMsg.value && detailMsg.value.id === msg.id) {
    closeDetail()
  }
  notifyUnreadChanged()
  loadMessages()
}

// ===== 联系人 =====
const contacts = ref([])
const contactsLoading = ref(false)

async function loadContacts() {
  contactsLoading.value = true
  try {
    const res = await getContacts()
    if (res && res.code === 1) {
      contacts.value = res.data || []
    }
  } finally {
    contactsLoading.value = false
  }
}

const addVisible = ref(false)
const addSaving = ref(false)
const addSearching = ref(false)
const addOptions = ref([])
const addForm = reactive({ contactId: null, remark: '' })

function openAdd() {
  addForm.contactId = null
  addForm.remark = ''
  addOptions.value = []
  addVisible.value = true
}

async function handleAddSearch(keyword) {
  const kw = (keyword || '').trim()
  if (!kw) {
    addOptions.value = []
    return
  }
  addSearching.value = true
  try {
    const res = await searchUsers(kw)
    if (res && res.code === 1) {
      addOptions.value = res.data || []
    }
  } catch (e) {
    addOptions.value = []
  } finally {
    addSearching.value = false
  }
}

async function submitAdd() {
  if (!addForm.contactId) {
    ElMessage.warning('请先选择用户')
    return
  }
  addSaving.value = true
  try {
    await addContact({ contactId: addForm.contactId, remark: addForm.remark })
    ElMessage.success('已添加为联系人')
    addVisible.value = false
    loadContacts()
  } finally {
    addSaving.value = false
  }
}

async function handleEditRemark(row) {
  try {
    const { value } = await ElMessageBox.prompt('设置备注名（留空则清除）', '修改备注', {
      inputValue: row.remark || '',
      inputValidator: (v) => (v || '').length <= 50 || '备注最多 50 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    })
    await updateContactRemark(row.userId, (value || '').trim())
    ElMessage.success('备注已更新')
    loadContacts()
  } catch {
    /* 取消 */
  }
}

async function handleRemoveContact(row) {
  try {
    await ElMessageBox.confirm(`确认从联系人中移除「${row.username}」吗？`, '移除确认', { type: 'warning' })
  } catch {
    return
  }
  await removeContact(row.userId)
  ElMessage.success('已移除')
  loadContacts()
}

async function handleBlock(userId, username) {
  try {
    await ElMessageBox.confirm(`确认拉黑「${username}」？拉黑后对方无法给你发私信。`, '拉黑确认', { type: 'warning' })
  } catch {
    return
  }
  await blockUser(userId)
  ElMessage.success('已拉黑')
  loadContacts()
  loadBlocks()
}

// ===== 黑名单 =====
const blocks = ref([])
const blocksLoading = ref(false)

async function loadBlocks() {
  blocksLoading.value = true
  try {
    const res = await getBlocks()
    if (res && res.code === 1) {
      blocks.value = res.data || []
    }
  } finally {
    blocksLoading.value = false
  }
}

async function handleUnblock(row) {
  await unblockUser(row.id)
  ElMessage.success('已取消拉黑')
  loadBlocks()
}

// ===== 写私信 =====
const writeVisible = ref(false)
const writePreset = ref(null)

function openWrite(preset) {
  writePreset.value = preset || null
  writeVisible.value = true
}

function onMessageSent() {
  // 发送后刷新收件箱（如果当前看的是联系人/陌生分组也会一起刷新）
  if (activeTab.value === 'inbox') {
    reloadMessages()
  }
  loadContacts()
}

// ===== 时间格式 =====
// 统一走 utils/datetime（兼容后端 LocalDateTime 的数组格式）

// 切换 tab 时按需加载
watch(activeTab, (tab) => {
  if (tab === 'contacts') loadContacts()
  if (tab === 'blocks') loadBlocks()
})

onMounted(() => {
  loadMessages()
})
</script>

<style scoped>
.messages-page {
  display: flex;
  flex-direction: column;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.page-head h1 {
  font-size: 22px;
  font-weight: 500;
  color: var(--text-primary);
}

.sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.group-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.group-tip,
.toolbar-tip {
  font-size: 12px;
  color: var(--text-muted);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.block-tip {
  margin-bottom: 14px;
}

.msg-list {
  min-height: 200px;
}

.msg-item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-solid);
  margin-bottom: 10px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.msg-item.unread {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.msg-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.msg-item.unread .msg-avatar {
  background: var(--accent-soft);
  color: var(--accent);
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.msg-from {
  font-size: 14px;
  color: var(--text-primary);
}

.from-id {
  font-size: 12px;
  color: var(--text-muted);
}

.msg-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.msg-title {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.msg-content {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

.attach-flag {
  vertical-align: -2px;
  margin-left: 4px;
  color: var(--text-muted);
}

/* ===== 详情覆盖页 ===== */
.detail-view {
  margin-top: 8px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.detail-toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--surface-solid);
  padding: 22px 26px;
}

.detail-card.unread {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.detail-head {
  display: flex;
  gap: 8px;
}

.detail-title {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.detail-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-id {
  color: var(--text-muted);
  font-weight: 400;
}

.detail-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-attachments {
  margin-top: 18px;
  border-top: 1px dashed var(--border-color);
  padding-top: 14px;
}

.attach-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.attach-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-muted);
  margin-bottom: 8px;
  max-width: 480px;
}

.attach-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.attach-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attach-size {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.attach-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: all 0.24s ease;
}

.detail-slide-enter-from,
.detail-slide-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.cell-strong {
  color: var(--text-primary);
}

.cell-sub {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
