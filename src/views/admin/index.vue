<template>
  <div class="admin-page">
    <section class="hero-card">
      <div>
        <p class="hero-eyebrow">Admin Console</p>
        <h1>后台管理</h1>
        <p class="hero-desc">这里先落地管理员最需要的 3 块：总览卡片、核心数据展示、用户管理。</p>
      </div>
      <div class="hero-actions">
        <el-tag type="warning" effect="dark">管理员入口</el-tag>
        <el-button :loading="dashboardLoading || tableLoading" @click="reloadAll">刷新数据</el-button>
      </div>
    </section>

    <section class="overview-grid">
      <article v-for="card in overviewCards" :key="card.key" class="metric-card">
        <p class="metric-label">{{ card.label }}</p>
        <div class="metric-value">{{ card.value }}</div>
        <p class="metric-hint">{{ card.hint }}</p>
      </article>
    </section>

    <section class="visual-grid">
      <article class="visual-card">
        <div class="card-head">
          <div>
            <h3>最近 7 天注册趋势</h3>
            <p>观察用户增长节奏，先看新增是不是稳定。</p>
          </div>
          <span class="head-tag">{{ registerTrendTotal }} 人</span>
        </div>

        <div class="trend-chart">
          <div
            v-for="item in registerTrend"
            :key="item.fullDate"
            class="trend-column"
          >
            <span class="trend-count">{{ item.count }}</span>
            <div class="trend-bar-shell">
              <div class="trend-bar" :style="{ height: `${calcTrendHeight(item.count)}%` }"></div>
            </div>
            <span class="trend-date">{{ item.date }}</span>
          </div>
        </div>
      </article>

      <article class="visual-card">
        <div class="card-head">
          <div>
            <h3>VIP 等级分布</h3>
            <p>先看普通用户、各级 VIP 的结构占比。</p>
          </div>
          <span class="head-tag">{{ vipUserTotal }} 人</span>
        </div>

        <div class="distribution-list">
          <div v-for="item in vipDistribution" :key="item.level" class="distribution-row">
            <div class="distribution-meta">
              <span>{{ item.levelName }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="distribution-bar-shell">
              <div class="distribution-bar" :style="{ width: `${calcVipPercent(item.count)}%` }"></div>
            </div>
          </div>
        </div>
      </article>

      <article class="visual-card full">
        <div class="card-head">
          <div>
            <h3>存储占用 Top 10</h3>
            <p>快速发现空间大户和异常占用账号。</p>
          </div>
          <span class="head-tag">按已用空间排序</span>
        </div>

        <div class="storage-list">
          <div v-for="item in storageTopUsers" :key="item.id" class="storage-row">
            <div class="storage-main">
              <div class="storage-user">
                <strong>{{ item.username }}</strong>
                <span>{{ item.levelName }}</span>
              </div>
              <div class="storage-values">{{ formatBytes(item.usedSpace) }} / {{ formatBytes(item.totalSpace) }}</div>
            </div>
            <div class="storage-bar-shell">
              <div class="storage-bar" :style="{ width: `${Math.min(Number(item.usageRate || 0), 100)}%` }"></div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="table-card">
      <div class="card-head">
        <div>
          <h3>用户管理</h3>
          <p>支持全量用户筛选、VIP 调整、账号启停。</p>
        </div>
      </div>

      <div class="filter-grid">
        <el-input
          v-model="filters.keyword"
          placeholder="用户名 / 邮箱"
          clearable
          @keyup.enter="handleSearch"
        />
        <el-select v-model="filters.role" placeholder="VIP 等级" clearable>
          <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
        </el-select>
        <el-select v-model="filters.status" placeholder="账号状态" clearable>
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="filters.isAdmin" placeholder="管理员身份" clearable>
          <el-option label="管理员" :value="1" />
          <el-option label="普通用户" :value="0" />
        </el-select>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="tableLoading" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table :data="tableRows" v-loading="tableLoading" class="user-table">
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <div class="user-name-line">
                <strong>{{ row.username }}</strong>
                <el-tag v-if="Number(row.isAdmin || 0) === 1" size="small" type="danger" effect="dark">管理员</el-tag>
              </div>
              <span>ID: {{ row.id }}</span>
              <span>{{ row.email || '未绑定邮箱' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="VIP 等级" min-width="170">
          <template #default="{ row }">
            <div class="vip-cell">
              <el-tag :type="Number(row.role || 0) > 0 ? 'warning' : 'info'" effect="plain">
                {{ row.levelName }}
              </el-tag>
              <span>{{ row.vipExpireTime ? formatDateTime(row.vipExpireTime) : '未开通' }}</span>
              <span v-if="row.vipExpired" class="expired-text">已过期，按普通用户生效</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="空间使用" min-width="220">
          <template #default="{ row }">
            <div class="usage-cell">
              <div class="usage-text">{{ formatBytes(row.usedSpace) }} / {{ formatBytes(row.totalSpace) }}</div>
              <el-progress :percentage="Number(row.usageRate || 0)" :stroke-width="8" :show-text="false" />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="Number(row.status || 0) === 1 ? 'success' : 'danger'" effect="dark">
              {{ Number(row.status || 0) === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="注册时间" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openVipDialog(row)">调整 VIP</el-button>
              <el-button
                link
                :type="Number(row.status || 0) === 1 ? 'danger' : 'success'"
                :loading="statusLoadingId === row.id"
                @click="handleToggleStatus(row)"
              >
                {{ Number(row.status || 0) === 1 ? '禁用账号' : '启用账号' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="pagination.total"
          :current-page="pagination.pageNum"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="vipDialogVisible" title="调整 VIP 等级" width="460px" destroy-on-close>
      <el-form :model="vipForm" label-position="top">
        <el-form-item label="目标用户">
          <el-input :model-value="vipTargetLabel" disabled />
        </el-form-item>
        <el-form-item label="目标等级">
          <el-select v-model="vipForm.role" style="width: 100%">
            <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
          </el-select>
        </el-form-item>
        <el-form-item label="续期天数">
          <el-input-number v-model="vipForm.durationDays" :min="1" :max="3650" :step="30" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vipDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="vipSaving" @click="handleSaveVip">保存</el-button>
      </template>
    </el-dialog>

    <!-- ===== 公告管理 ===== -->
    <section class="visual-card" style="margin-top: 24px;">
      <div class="card-head">
        <div>
          <h3>公告管理</h3>
          <p>发布系统公告或通知，支持置顶和定向推送。</p>
        </div>
        <el-button type="primary" size="small" @click="handleCreateAnnouncement">+ 新建公告</el-button>
      </div>

      <!-- 公告列表 -->
      <el-table :data="announcementList" v-loading="announcementLoading" stripe size="small">
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 1 ? '' : 'warning'" size="small">
              {{ row.type === 1 ? '公告' : '通知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isTop" label="置顶" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isTop === 1 ? 'danger' : 'info'" size="small" effect="plain">
              {{ row.isTop === 1 ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 1 ? 'success' : row.status === 0 ? 'info' : 'danger'"
              size="small"
            >
              {{ row.status === 1 ? '已发布' : row.status === 0 ? '草稿' : '已撤回' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publisherName" label="发布者" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleToggleTop(row)">
              {{ row.isTop === 1 ? '取消置顶' : '置顶' }}
            </el-button>
            <el-button link type="primary" size="small" @click="handleEditAnnouncement(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDeleteAnnouncement(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="announcementPagination.pageNum"
          v-model:page-size="announcementPagination.pageSize"
          :total="announcementPagination.total"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20]"
          small
          @current-change="fetchAnnouncementList"
          @size-change="fetchAnnouncementList"
        />
      </div>
    </section>

    <!-- 公告新建/编辑弹窗 -->
    <el-dialog
      v-model="announcementDialogVisible"
      :title="announcementForm.id ? '编辑公告' : '新建公告'"
      width="560px"
      destroy-on-close
    >
      <el-form :model="announcementForm" label-width="90px">
        <el-form-item label="类型" required>
          <el-radio-group v-model="announcementForm.type">
            <el-radio :value="1">公告（侧边栏轮播）</el-radio>
            <el-radio :value="2">系统通知（铃铛）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="announcementForm.title" placeholder="请输入标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="announcementForm.content" type="textarea" :rows="5" placeholder="支持 HTML 内容" />
        </el-form-item>
        <el-form-item label="目标范围">
          <el-radio-group v-model="announcementForm.targetType">
            <el-radio :value="0">全部用户</el-radio>
            <el-radio :value="1">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="announcementForm.targetType === 1" label="目标用户ID">
          <el-input v-model="announcementForm.targetIds" placeholder="逗号分隔，如: 5,9,12" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="announcementForm.status">
            <el-radio :value="0">草稿</el-radio>
            <el-radio :value="1">直接发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announcementDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="announcementSaving" @click="handleSaveAnnouncement">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import {
  getAdminAnnouncementList,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementTop
} from '@/api/notification'

const dashboardLoading = ref(false)
const tableLoading = ref(false)
const vipSaving = ref(false)
const statusLoadingId = ref(null)
const vipDialogVisible = ref(false)

const overview = reactive({
  totalUsers: 0,
  newUsersToday: 0,
  activeVipUsers: 0,
  totalUsedSpace: 0,
  activeShareCount: 0,
  recycleExpiringCount: 0
})

const registerTrend = ref([])
const vipDistribution = ref([])
const storageTopUsers = ref([])
const vipOptions = ref([])
const tableRows = ref([])

const filters = reactive({
  keyword: '',
  role: null,
  status: null,
  isAdmin: null
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const vipForm = reactive({
  userId: null,
  role: 0,
  durationDays: 365
})

const vipTargetLabel = computed(() => {
  const target = tableRows.value.find(item => item.id === vipForm.userId)
  if (!target) return ''
  return `${target.username}（当前 ${target.levelName}）`
})

const registerTrendMax = computed(() => {
  const values = registerTrend.value.map(item => Number(item.count || 0))
  return Math.max(...values, 1)
})

const registerTrendTotal = computed(() => {
  return registerTrend.value.reduce((sum, item) => sum + Number(item.count || 0), 0)
})

const vipUserTotal = computed(() => {
  return vipDistribution.value.reduce((sum, item) => sum + Number(item.count || 0), 0)
})

const overviewCards = computed(() => [
  {
    key: 'totalUsers',
    label: '总用户数',
    value: overview.totalUsers,
    hint: '当前库中全部账号'
  },
  {
    key: 'newUsersToday',
    label: '今日新增',
    value: overview.newUsersToday,
    hint: '以注册时间按天统计'
  },
  {
    key: 'activeVipUsers',
    label: '有效 VIP',
    value: overview.activeVipUsers,
    hint: '只统计当前仍在有效期内'
  },
  {
    key: 'totalUsedSpace',
    label: '总已用存储',
    value: formatBytes(overview.totalUsedSpace),
    hint: '来自用户 used_space 汇总'
  },
  {
    key: 'activeShareCount',
    label: '有效分享数',
    value: overview.activeShareCount,
    hint: '状态正常且未过期'
  },
  {
    key: 'recycleExpiringCount',
    label: '回收站临期项',
    value: overview.recycleExpiringCount,
    hint: '3 天内将自动过期'
  }
])

const parseDateValue = (value) => {
  if (!value) return null
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return new Date(year, (month || 1) - 1, day || 1, hour, minute, second)
  }
  return new Date(value)
}

const formatDateTime = (value) => {
  const date = parseDateValue(value)
  if (!date || Number.isNaN(date.getTime())) return '-'
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(bytes >= 100 * 1024 ** 3 ? 0 : 2)} GB`
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${bytes} B`
}

const calcTrendHeight = (count) => {
  return Math.max((Number(count || 0) / registerTrendMax.value) * 100, Number(count || 0) > 0 ? 12 : 6)
}

const calcVipPercent = (count) => {
  return vipUserTotal.value > 0 ? (Number(count || 0) / vipUserTotal.value) * 100 : 0
}

const applyDashboard = (data = {}) => {
  Object.assign(overview, data.overview || {})
  registerTrend.value = Array.isArray(data.registerTrend) ? data.registerTrend : []
  vipDistribution.value = Array.isArray(data.vipDistribution) ? data.vipDistribution : []
  storageTopUsers.value = Array.isArray(data.storageTopUsers) ? data.storageTopUsers : []
  vipOptions.value = Array.isArray(data.vipOptions) ? data.vipOptions : []
}

const loadDashboard = async () => {
  dashboardLoading.value = true
  try {
    const res = await request.get('/admin/dashboard')
    applyDashboard(res.data || {})
  } finally {
    dashboardLoading.value = false
  }
}

const loadUsers = async () => {
  tableLoading.value = true
  try {
    const res = await request.post('/admin/users/page', {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      keyword: filters.keyword || null,
      role: filters.role,
      status: filters.status,
      isAdmin: filters.isAdmin
    })
    tableRows.value = Array.isArray(res.data?.list) ? res.data.list : []
    pagination.total = Number(res.data?.total || 0)
    vipOptions.value = Array.isArray(res.data?.vipOptions) && res.data.vipOptions.length
      ? res.data.vipOptions
      : vipOptions.value
  } finally {
    tableLoading.value = false
  }
}

const reloadAll = async () => {
  await Promise.all([loadDashboard(), loadUsers()])
}

const handleSearch = async () => {
  pagination.pageNum = 1
  await loadUsers()
}

const resetFilters = async () => {
  filters.keyword = ''
  filters.role = null
  filters.status = null
  filters.isAdmin = null
  pagination.pageNum = 1
  await loadUsers()
}

const handlePageChange = async (page) => {
  pagination.pageNum = page
  await loadUsers()
}

const handleSizeChange = async (size) => {
  pagination.pageSize = size
  pagination.pageNum = 1
  await loadUsers()
}

const openVipDialog = (row) => {
  vipForm.userId = row.id
  vipForm.role = Number(row.role || 0)
  vipForm.durationDays = 365
  vipDialogVisible.value = true
}

const handleSaveVip = async () => {
  if (!vipForm.userId && vipForm.userId !== 0) {
    ElMessage.warning('未选择目标用户')
    return
  }
  vipSaving.value = true
  try {
    await request.post('/admin/users/vip/update', {
      userId: vipForm.userId,
      role: vipForm.role,
      durationDays: vipForm.durationDays
    })
    ElMessage.success('VIP 等级已更新')
    vipDialogVisible.value = false
    await reloadAll()
  } finally {
    vipSaving.value = false
  }
}

const handleToggleStatus = async (row) => {
  const nextStatus = Number(row.status || 0) === 1 ? 0 : 1
  const actionText = nextStatus === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确认${actionText}账号「${row.username}」吗？`, '账号状态调整', {
      type: nextStatus === 1 ? 'success' : 'warning'
    })
  } catch (error) {
    return
  }

  statusLoadingId.value = row.id
  try {
    await request.post('/admin/users/status/update', {
      userId: row.id,
      status: nextStatus
    })
    ElMessage.success(`账号已${actionText}`)
    await reloadAll()
  } finally {
    statusLoadingId.value = null
  }
}

onMounted(() => {
  reloadAll()
  fetchAnnouncementList()
})

// ===== 公告管理 =====
const announcementList = ref([])
const announcementLoading = ref(false)
const announcementSaving = ref(false)
const announcementDialogVisible = ref(false)
const announcementPagination = reactive({ pageNum: 1, pageSize: 10, total: 0 })
const announcementForm = reactive({
  id: null,
  title: '',
  content: '',
  type: 1,
  targetType: 0,
  targetIds: '',
  status: 1
})

const fetchAnnouncementList = async () => {
  announcementLoading.value = true
  try {
    const res = await getAdminAnnouncementList({
      pageNum: announcementPagination.pageNum,
      pageSize: announcementPagination.pageSize
    })
    announcementList.value = Array.isArray(res.data?.list) ? res.data.list : []
    announcementPagination.total = Number(res.data?.total || 0)
  } finally {
    announcementLoading.value = false
  }
}

const handleCreateAnnouncement = () => {
  Object.assign(announcementForm, { id: null, title: '', content: '', type: 1, targetType: 0, targetIds: '', status: 1 })
  announcementDialogVisible.value = true
}

const handleEditAnnouncement = (row) => {
  Object.assign(announcementForm, {
    id: row.id, title: row.title, content: row.content,
    type: row.type, targetType: 0, targetIds: '', status: row.status
  })
  announcementDialogVisible.value = true
}

const handleSaveAnnouncement = async () => {
  if (!announcementForm.title || !announcementForm.content) {
    ElMessage.warning('标题和内容不能为空')
    return
  }
  announcementSaving.value = true
  try {
    if (announcementForm.id) {
      await updateAnnouncement(announcementForm)
      ElMessage.success('公告已更新')
    } else {
      await createAnnouncement(announcementForm)
      ElMessage.success('公告已创建')
    }
    announcementDialogVisible.value = false
    fetchAnnouncementList()
  } finally {
    announcementSaving.value = false
  }
}

const handleToggleTop = async (row) => {
  try {
    await toggleAnnouncementTop(row.id)
    ElMessage.success(row.isTop === 1 ? '已取消置顶' : '已置顶')
    fetchAnnouncementList()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleDeleteAnnouncement = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除公告「${row.title}」吗？`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteAnnouncement(row.id)
    ElMessage.success('已删除')
    fetchAnnouncementList()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 4px 36px;
}

.hero-card,
.metric-card,
.visual-card,
.table-card {
  background: linear-gradient(180deg, var(--surface-solid), var(--surface-muted));
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 30px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(251, 191, 36, 0.2), transparent 28%),
    radial-gradient(circle at left bottom, rgba(59, 130, 246, 0.14), transparent 30%),
    linear-gradient(180deg, var(--surface-solid), var(--surface-muted));
}

.hero-eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #c2410c;
}

.hero-card h1 {
  margin: 0;
  font-size: 34px;
  color: var(--text-primary);
}

.hero-desc {
  margin: 12px 0 0;
  max-width: 720px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 22px 20px;
  border-radius: 20px;
}

.metric-label {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.metric-value {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.visual-card,
.table-card {
  border-radius: 24px;
  padding: 24px;
}

.visual-card.full {
  grid-column: 1 / -1;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.card-head h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.card-head p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.head-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.trend-chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 14px;
  align-items: end;
  min-height: 260px;
}

.trend-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.trend-count,
.trend-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.trend-bar-shell {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 170px;
  padding: 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, var(--surface-muted), var(--surface-solid));
}

.trend-bar {
  width: 100%;
  border-radius: 14px;
  background: linear-gradient(180deg, #f59e0b, #f97316);
  box-shadow: 0 14px 22px rgba(249, 115, 22, 0.28);
  transition: height 0.2s ease;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.distribution-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.distribution-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-primary);
}

.distribution-bar-shell,
.storage-bar-shell {
  width: 100%;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 78%, var(--border-color) 22%);
}

.distribution-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.storage-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.storage-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.storage-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.storage-user {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storage-user strong {
  color: var(--text-primary);
}

.storage-user span,
.storage-values {
  color: var(--text-secondary);
  font-size: 13px;
}

.storage-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #0ea5e9);
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(140px, 1fr)) auto;
  gap: 14px;
  margin-bottom: 18px;
}

.filter-actions {
  display: flex;
  gap: 10px;
}

.user-cell,
.vip-cell,
.usage-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-cell strong {
  color: var(--text-primary);
}

.user-cell span,
.vip-cell span,
.usage-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.expired-text {
  color: #dc2626 !important;
}

.user-table {
  --el-table-bg-color: var(--surface-solid);
  --el-table-tr-bg-color: var(--surface-solid);
  --el-table-row-hover-bg-color: var(--surface-muted);
  --el-table-header-bg-color: var(--surface-muted);
  --el-table-text-color: var(--text-primary);
  --el-table-border-color: var(--border-color);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 1440px) {
  .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1080px) {
  .hero-card,
  .card-head,
  .storage-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .visual-grid,
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .admin-page {
    padding-bottom: 24px;
  }

  .hero-card,
  .visual-card,
  .table-card {
    padding: 18px;
    border-radius: 18px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .trend-chart {
    gap: 8px;
  }
}
</style>
