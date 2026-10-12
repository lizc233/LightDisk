<template>
  <div class="admin-page">
    <section class="visual-card">
      <el-tabs v-model="activeTab" class="audit-tabs">
        <!-- ==================== Tab 1：操作流水 ==================== -->
        <el-tab-pane label="操作流水" name="logs">
          <div class="card-head">
            <div>
              <h3>操作审计</h3>
              <p>全站安全与合规操作的流水台账，支持筛选、导出留档与驳回违规分享。</p>
            </div>
            <div class="head-actions">
              <el-button size="small" @click="exportLogs('csv')">导出 CSV</el-button>
              <el-button size="small" @click="exportLogs('json')">导出 JSON</el-button>
              <el-button size="small" :icon="Refresh" @click="loadAudit()">刷新</el-button>
            </div>
          </div>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="audit-privacy"
            title="隐私分级：文件、回收站、私信属于用户私人操作，仅本人可查，审计范围不包含此类日志。"
          />

          <div class="filter-grid audit-filter">
            <el-input
              v-model="auditFilters.username"
              placeholder="用户名"
              clearable
              @keyup.enter="loadAudit(1)"
            />
            <el-select v-model="auditFilters.module" placeholder="模块" clearable>
              <el-option v-for="m in auditModules" :key="m" :label="m" :value="m" />
            </el-select>
            <el-select v-model="auditFilters.action" placeholder="动作" clearable>
              <el-option v-for="a in auditActions" :key="a.value" :label="a.label" :value="a.value" />
            </el-select>
            <el-date-picker
              v-model="auditFilters.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 260px"
            />
            <div class="filter-actions">
              <el-button @click="resetAuditFilters">重置</el-button>
              <el-button type="primary" :loading="auditLoading" @click="loadAudit(1)">查询</el-button>
            </div>
          </div>

          <el-table :data="auditRows" v-loading="auditLoading" stripe size="small">
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="username" label="用户" width="130" show-overflow-tooltip />
            <el-table-column label="模块" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.module }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="动作" width="110" align="center">
              <template #default="{ row }">{{ actionLabel(row.action) }}</template>
            </el-table-column>
            <el-table-column prop="content" label="操作内容" min-width="280" show-overflow-tooltip />
            <el-table-column prop="ip" label="IP" width="130">
              <template #default="{ row }">
                <span class="audit-ip">{{ row.ip || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="center" fixed="right">
              <template #default="{ row }">
                <template v-if="row.action === 'share_send' && row.targetId">
                  <el-button link type="primary" size="small" @click="goShareTab(row.targetId)">去审核</el-button>
                  <el-button link type="danger" size="small" @click="handleRejectShare(row)">驳回</el-button>
                </template>
                <span v-else class="audit-noop">-</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrap">
            <el-pagination
              background
              layout="total, prev, pager, next, sizes"
              :total="auditTotal"
              :current-page="auditPage"
              :page-size="auditPageSize"
              :page-sizes="[10, 20, 30, 50]"
              @current-change="(p) => loadAudit(p)"
              @size-change="(s) => { auditPageSize = s; loadAudit(1) }"
            />
          </div>
        </el-tab-pane>

        <!-- ==================== Tab 2：分享审核 ==================== -->
        <el-tab-pane name="shares">
          <template #label>
            <span class="tab-label">
              分享审核
              <el-badge v-if="shareActiveCount" :value="shareActiveCount" :max="999" class="tab-badge" />
            </span>
          </template>

          <div class="card-head">
            <div>
              <h3>分享审核</h3>
              <p>集中查看全站生效中的分享链接，人工判断是否让链接立即失效，无需再去流水里逐条筛选。</p>
            </div>
            <el-button size="small" :icon="Refresh" @click="loadShares(1)">刷新</el-button>
          </div>

          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="audit-privacy share-audit-tip"
            title="驳回后分享链接即刻失效：缓存会被清除，分享者与管理员都会留下审计记录。"
          />

          <div class="filter-grid audit-filter">
            <el-input v-model="shareFilters.username" placeholder="分享者用户名" clearable @keyup.enter="loadShares(1)" />
            <el-input v-model="shareFilters.keyword" placeholder="文件名 / 分享码" clearable @keyup.enter="loadShares(1)" />
            <el-select v-model="shareFilters.status" placeholder="链接状态" clearable>
              <el-option label="生效中" :value="1" />
              <el-option label="已失效" :value="0" />
            </el-select>
            <el-checkbox v-model="shareFilters.onlyExpired" class="share-expired-check">只看已过期</el-checkbox>
            <div class="filter-actions">
              <el-button @click="resetShareFilters">重置</el-button>
              <el-button type="primary" :loading="shareLoading" @click="loadShares(1)">查询</el-button>
            </div>
          </div>

          <div v-if="selectedShares.length" class="batch-bar">
            <div class="batch-info">
              <el-icon><Select /></el-icon>
              <span>已选 <strong>{{ selectedShares.length }}</strong> 条分享</span>
            </div>
            <div class="batch-actions">
              <el-button size="small" type="danger" @click="handleBatchReject">批量驳回并失效</el-button>
              <el-button size="small" text @click="clearShareSelection">取消选择</el-button>
            </div>
          </div>

          <el-table
            ref="shareTableRef"
            :data="shareRows"
            v-loading="shareLoading"
            stripe
            size="small"
            row-key="id"
            @selection-change="handleShareSelectionChange"
          >
            <el-table-column type="selection" width="46" :selectable="(row) => !row.expired" />
            <el-table-column prop="fileName" label="文件" min-width="180" show-overflow-tooltip />
            <el-table-column prop="username" label="分享者" width="120" show-overflow-tooltip />
            <el-table-column label="分享码 / 提取码" width="170">
              <template #default="{ row }">
                <div class="share-code-cell">
                  <span>{{ row.shareCode }}</span>
                  <el-tag size="small" effect="plain">{{ row.extractCode }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="访问" width="80" align="center">
              <template #default="{ row }">{{ row.visitCount || 0 }}</template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="到期时间" width="160">
              <template #default="{ row }">{{ row.expireTime ? formatDateTime(row.expireTime) : '永久' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <span class="share-link-state">
                  <el-tag v-if="row.expired" size="small" type="info" effect="plain">已失效</el-tag>
                  <el-tag v-else size="small" type="success">生效中</el-tag>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="!row.expired"
                  link
                  type="danger"
                  size="small"
                  @click="handleRejectShareRow(row)"
                >
                  驳回链接
                </el-button>
                <span v-else class="audit-noop">-</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrap">
            <el-pagination
              background
              layout="total, prev, pager, next, sizes"
              :total="shareTotal"
              :current-page="sharePage"
              :page-size="sharePageSize"
              :page-sizes="[10, 20, 30, 50]"
              @current-change="(p) => loadShares(p)"
              @size-change="(s) => { sharePageSize = s; loadShares(1) }"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Select } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatDateTime } from '@/utils/datetime'
import { getAdminSharePage, rejectAdminShares, buildAuditExportUrl } from '@/api/adminManage'

const auditModules = ['账号', '分享', '会员', '管理', '审计']
const auditActions = [
  { value: 'login', label: '登录' },
  { value: 'share_send', label: '创建分享' },
  { value: 'share_cancel', label: '取消分享' },
  { value: 'share_reject', label: '驳回分享' },
  { value: 'vip_upgrade', label: '升级会员' },
  { value: 'admin_add_user', label: '新增用户' },
  { value: 'admin_vip_update', label: '调整会员' },
  { value: 'admin_status_update', label: '启停账号' },
  { value: 'admin_role_update', label: '调整身份' },
  { value: 'announcement_publish', label: '发布公告' },
  { value: 'announcement_batch', label: '批量公告' },
  { value: 'announcement_delete', label: '删除公告' },
  { value: 'audit_export', label: '导出审计' }
]

const activeTab = ref('logs')

// ===== 操作流水 =====
const auditFilters = reactive({ username: '', module: '', action: '', dateRange: null })
const auditLoading = ref(false)
const auditRows = ref([])
const auditTotal = ref(0)
const auditPage = ref(1)
const auditPageSize = ref(10)

const actionLabelMap = auditActions.reduce((map, item) => {
  map[item.value] = item.label
  return map
}, {})

const actionLabel = (action) => actionLabelMap[action] || action || '-'

const buildAuditQuery = () => {
  const query = {
    username: auditFilters.username || undefined,
    module: auditFilters.module || undefined,
    action: auditFilters.action || undefined
  }
  if (Array.isArray(auditFilters.dateRange) && auditFilters.dateRange.length === 2) {
    query.startDate = auditFilters.dateRange[0]
    query.endDate = auditFilters.dateRange[1]
  }
  return query
}

const resetAuditFilters = () => {
  Object.assign(auditFilters, { username: '', module: '', action: '', dateRange: null })
  loadAudit(1)
}

const loadAudit = async (page) => {
  if (page) auditPage.value = page
  auditLoading.value = true
  try {
    const res = await request.post('/admin/audit/logs', {
      ...buildAuditQuery(),
      page: auditPage.value,
      pageSize: auditPageSize.value
    })
    auditRows.value = res.data?.records || []
    auditTotal.value = Number(res.data?.total || 0)
  } catch (e) {
    /* 错误提示由全局拦截器处理 */
  } finally {
    auditLoading.value = false
  }
}

/** 导出当前筛选条件下的审计日志（浏览器直接另存，token 走查询参数） */
const exportLogs = (format) => {
  const url = buildAuditExportUrl(buildAuditQuery(), format)
  window.open(url, '_self')
  ElMessage.success(`正在导出 ${format.toUpperCase()} ...`)
}

// ===== 分享审核 =====
const shareFilters = reactive({ username: '', keyword: '', status: null, onlyExpired: false })
const shareLoading = ref(false)
const shareRows = ref([])
const shareTotal = ref(0)
const sharePage = ref(1)
const sharePageSize = ref(10)
const shareActiveCount = ref(0)
const shareTableRef = ref(null)
const selectedShares = ref([])

const loadShares = async (page) => {
  if (page) sharePage.value = page
  shareLoading.value = true
  try {
    const res = await getAdminSharePage({
      username: shareFilters.username || undefined,
      keyword: shareFilters.keyword || undefined,
      status: shareFilters.status === null || shareFilters.status === '' ? undefined : shareFilters.status,
      onlyExpired: shareFilters.onlyExpired || undefined,
      page: sharePage.value,
      pageSize: sharePageSize.value
    })
    shareRows.value = res.data?.list || []
    shareTotal.value = Number(res.data?.total || 0)
    shareActiveCount.value = Number(res.data?.activeCount || 0)
    selectedShares.value = []
  } catch (e) {
    /* 错误提示由全局拦截器处理 */
  } finally {
    shareLoading.value = false
  }
}

const resetShareFilters = () => {
  Object.assign(shareFilters, { username: '', keyword: '', status: null, onlyExpired: false })
  loadShares(1)
}

const handleShareSelectionChange = (rows) => {
  selectedShares.value = rows || []
}

const clearShareSelection = () => {
  shareTableRef.value?.clearSelection()
  selectedShares.value = []
}

/** 从操作流水点「去审核」直接跳到分享审核并定位到该分享码 */
const goShareTab = (shareId) => {
  activeTab.value = 'shares'
  shareFilters.username = ''
  shareFilters.keyword = ''
  shareFilters.status = null
  shareFilters.onlyExpired = false
  loadShares(1).then(() => {
    const target = shareRows.value.find(item => String(item.id) === String(shareId))
    if (target) {
      shareFilters.keyword = target.shareCode
      loadShares(1)
    } else {
      shareFilters.keyword = ''
      ElMessage.info('该分享可能已失效，请在「已失效」筛选中查看')
    }
  })
}

const askRejectReason = async (count) => {
  const { value } = await ElMessageBox.prompt(
    `将驳回 ${count} 条分享，链接立即失效。请输入驳回原因：`,
    '驳回违规分享',
    {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '如：分享内容涉嫌违规',
      inputValidator: (v) => (v && v.trim().length >= 2) || '请至少输入 2 个字的原因'
    }
  )
  return value.trim()
}

const rejectShares = async (shareIds) => {
  if (!shareIds.length) return
  let reason
  try {
    reason = await askRejectReason(shareIds.length)
  } catch {
    return
  }
  const res = await rejectAdminShares({ shareIds, reason })
  ElMessage.success(`已驳回 ${res.data || 0} 条分享，链接已失效`)
  await loadShares()
}

const handleRejectShareRow = (row) => rejectShares([row.id])
const handleBatchReject = () => rejectShares(selectedShares.value.map(item => item.id))

/** 操作流水表格里的单条驳回（按 targetId = 分享 id） */
const handleRejectShare = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt(
      `将驳回「${row.username}」创建的分享，链接立即失效。请输入驳回原因：`,
      '驳回违规分享',
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '如：分享内容涉嫌违规',
        inputValidator: (v) => (v && v.trim().length >= 2) || '请至少输入 2 个字的原因'
      }
    )
    await request.post('/admin/audit/share/reject', { shareId: row.targetId, reason: value.trim() })
    ElMessage.success('分享已驳回，链接已失效')
    loadAudit()
  } catch (e) {
    /* 用户取消或请求失败（失败提示由全局拦截器处理） */
  }
}

watch(activeTab, (tab) => {
  if (tab === 'shares' && !shareRows.value.length) {
    loadShares(1)
  }
})

onMounted(() => {
  loadAudit()
})
</script>

<style scoped>
@import './admin-shared.css';

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  transform: translateY(-2px);
}

.share-expired-check {
  align-self: center;
  color: var(--text-secondary);
}
</style>
