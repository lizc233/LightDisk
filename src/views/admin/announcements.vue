<template>
  <div class="admin-page">
    <section class="visual-card">
      <div class="card-head">
        <div>
          <h3>公告管理</h3>
          <p>发布系统公告或通知，支持置顶和定向推送。</p>
        </div>
        <el-button type="primary" size="small" @click="handleCreateAnnouncement">+ 新建公告</el-button>
      </div>

      <div v-if="selectedAnnouncements.length" class="batch-bar">
        <div class="batch-info">
          <el-icon><Select /></el-icon>
          <span>已选 <strong>{{ selectedAnnouncements.length }}</strong> 条公告</span>
        </div>
        <div class="batch-actions">
          <el-button size="small" @click="handleBatchAction('publish')">批量发布</el-button>
          <el-button size="small" @click="handleBatchAction('withdraw')">批量撤回</el-button>
          <el-button size="small" @click="handleBatchAction('top')">批量置顶</el-button>
          <el-button size="small" @click="handleBatchAction('untop')">批量取消置顶</el-button>
          <el-button size="small" type="danger" @click="handleBatchAction('delete')">批量删除</el-button>
          <el-button size="small" text @click="clearSelection">取消选择</el-button>
        </div>
      </div>

      <!-- 公告列表 -->
      <el-table
        ref="announcementTableRef"
        :data="announcementList"
        v-loading="announcementLoading"
        stripe
        size="small"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="46" />
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
          <el-select v-model="announcementForm.targetType" style="width: 100%" @change="onAnnouncementTargetChange">
            <el-option :value="0" label="全部用户" />
            <el-option :value="2" label="指定 VIP 等级的用户" />
            <el-option :value="1" label="指定用户（按 ID）" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="announcementForm.targetType === 1" label="目标用户ID">
          <el-input v-model="announcementForm.targetIds" placeholder="逗号分隔，如: 5,9,12" />
        </el-form-item>
        <el-form-item v-if="announcementForm.targetType === 2" label="VIP 等级">
          <el-select
            v-model="announcementTargetLevels"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择要通知的等级"
            style="width: 100%"
          >
            <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
          </el-select>
          <p class="target-tip">VIP 已过期的用户按「普通用户」收到对应等级通知</p>
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Select } from '@element-plus/icons-vue'
import request from '@/utils/request'
import {
  getAdminAnnouncementList,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementTop,
  batchOperateAnnouncements
} from '@/api/notification'

const vipOptions = ref([])

const announcementList = ref([])
const announcementLoading = ref(false)
const announcementSaving = ref(false)
const announcementDialogVisible = ref(false)
const announcementTargetLevels = ref([])
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

/** 公告定向推送需要 VIP 等级选项，从数据大屏接口顺带取 */
const loadVipOptions = async () => {
  try {
    const res = await request.get('/admin/dashboard')
    vipOptions.value = Array.isArray(res.data?.vipOptions) ? res.data.vipOptions : []
  } catch (e) {
    /* 静默失败，仅影响定向等级选项 */
  }
}

const fetchAnnouncementList = async () => {
  announcementLoading.value = true
  try {
    const res = await getAdminAnnouncementList({
      pageNum: announcementPagination.pageNum,
      pageSize: announcementPagination.pageSize
    })
    announcementList.value = Array.isArray(res.data?.list) ? res.data.list : []
    announcementPagination.total = Number(res.data?.total || 0)
    selectedAnnouncements.value = []
  } finally {
    announcementLoading.value = false
  }
}

// ===== 批量操作 =====
const announcementTableRef = ref(null)
const selectedAnnouncements = ref([])
const batchSaving = ref(false)

const BATCH_ACTION_LABEL = {
  publish: '发布',
  withdraw: '撤回',
  top: '置顶',
  untop: '取消置顶',
  delete: '删除'
}

const handleSelectionChange = (rows) => {
  selectedAnnouncements.value = rows || []
}

const clearSelection = () => {
  announcementTableRef.value?.clearSelection()
  selectedAnnouncements.value = []
}

const handleBatchAction = async (action) => {
  if (!selectedAnnouncements.value.length) return
  const label = BATCH_ACTION_LABEL[action] || action
  try {
    await ElMessageBox.confirm(
      `确认批量${label}选中的 ${selectedAnnouncements.value.length} 条公告吗？`,
      `批量${label}`,
      { type: action === 'delete' ? 'warning' : 'info' }
    )
  } catch { return }

  batchSaving.value = true
  try {
    const res = await batchOperateAnnouncements({
      ids: selectedAnnouncements.value.map(item => item.id),
      action
    })
    ElMessage.success(`已${label} ${res.data || 0} 条公告`)
    await fetchAnnouncementList()
    clearSelection()
  } finally {
    batchSaving.value = false
  }
}

const handleCreateAnnouncement = () => {
  Object.assign(announcementForm, { id: null, title: '', content: '', type: 1, targetType: 0, targetIds: '', status: 1 })
  announcementTargetLevels.value = []
  announcementDialogVisible.value = true
}

const onAnnouncementTargetChange = () => {
  announcementForm.targetIds = ''
  announcementTargetLevels.value = []
}

// 把 targetType=2 的等级列表与 targetIds 互转，统一提交格式
const syncAnnouncementTargetIds = () => {
  if (announcementForm.targetType === 2) {
    announcementForm.targetIds = announcementTargetLevels.value.join(',')
  }
}

const handleEditAnnouncement = (row) => {
  Object.assign(announcementForm, {
    id: row.id, title: row.title, content: row.content,
    type: row.type,
    targetType: Number(row.targetType || 0),
    targetIds: row.targetIds || '',
    status: row.status
  })
  announcementTargetLevels.value = announcementForm.targetType === 2 && row.targetIds
    ? row.targetIds.split(',').map(v => Number(v)).filter(v => !Number.isNaN(v))
    : []
  announcementDialogVisible.value = true
}

const handleSaveAnnouncement = async () => {
  if (!announcementForm.title || !announcementForm.content) {
    ElMessage.warning('标题和内容不能为空')
    return
  }
  if (announcementForm.targetType === 2 && !announcementTargetLevels.value.length) {
    ElMessage.warning('请选择 VIP 等级')
    return
  }
  if (announcementForm.targetType === 1 && !String(announcementForm.targetIds || '').trim()) {
    ElMessage.warning('请填写目标用户 ID')
    return
  }
  syncAnnouncementTargetIds()
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

onMounted(() => {
  fetchAnnouncementList()
  loadVipOptions()
})
</script>

<style scoped>
@import './admin-shared.css';
</style>
