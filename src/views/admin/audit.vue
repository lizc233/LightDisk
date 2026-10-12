<template>
  <div class="admin-page">
    <section class="visual-card">
      <div class="card-head">
        <div>
          <h3>操作审计</h3>
          <p>全站安全与合规操作的流水台账，支持筛选与驳回违规分享。</p>
        </div>
        <el-button size="small" :icon="Refresh" @click="loadAudit()">刷新</el-button>
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
        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.action === 'share_send' && row.targetId"
              link
              type="danger"
              size="small"
              @click="handleRejectShare(row)"
            >
              驳回分享
            </el-button>
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
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatDateTime } from '@/utils/datetime'

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
  { value: 'announcement_delete', label: '删除公告' }
]

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

const resetAuditFilters = () => {
  Object.assign(auditFilters, { username: '', module: '', action: '', dateRange: null })
  loadAudit(1)
}

const loadAudit = async (page) => {
  if (page) auditPage.value = page
  auditLoading.value = true
  try {
    const body = {
      page: auditPage.value,
      pageSize: auditPageSize.value,
      username: auditFilters.username || undefined,
      module: auditFilters.module || undefined,
      action: auditFilters.action || undefined
    }
    if (Array.isArray(auditFilters.dateRange) && auditFilters.dateRange.length === 2) {
      body.startDate = auditFilters.dateRange[0]
      body.endDate = auditFilters.dateRange[1]
    }
    const res = await request.post('/admin/audit/logs', body)
    auditRows.value = res.data?.records || []
    auditTotal.value = Number(res.data?.total || 0)
  } catch (e) {
    /* 错误提示由全局拦截器处理 */
  } finally {
    auditLoading.value = false
  }
}

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

onMounted(() => {
  loadAudit()
})
</script>

<style scoped>
@import './admin-shared.css';
</style>
