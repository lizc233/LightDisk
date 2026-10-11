<template>
  <div class="messages-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Messages</p>
        <h1>私信中心</h1>
        <p class="sub">站内私信按「邮件」语义：知道对方 ID 或用户名即可发送，无需对方同意。</p>
      </div>
      <el-button type="primary" :icon="Promotion" @click="openWrite()">写私信</el-button>
    </header>

    <el-tabs v-model="activeTab" class="main-tabs">
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
              <h4 class="msg-title">{{ msg.title }}</h4>
              <p class="msg-content">{{ msg.content }}</p>

              <div class="msg-actions">
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

    <!-- 写私信 -->
    <WriteMessageDialog v-model="writeVisible" :preset="writePreset" @sent="onMessageSent" />

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
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatDotRound,
  CirclePlus,
  Message,
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
import { deleteMessage, getNotificationList, getMessageList, markAnnouncementRead, markMessageRead } from '@/api/notification'
import { formatRelativeTime } from '@/utils/datetime'
import WriteMessageDialog from '@/components/WriteMessageDialog.vue'

const activeTab = ref('inbox')

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

async function handleMarkRead(msg) {
  try {
    if (msg.itemType === 'announcement') {
      await markAnnouncementRead(msg.announcementId)
    } else {
      await markMessageRead(msg.messageId)
    }
    msg.isRead = 1
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
