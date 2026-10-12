<template>
  <div class="share-container">
    <PageHeader eyebrow="Shares" title="我的分享" sub="这里管理你创建的所有分享链接，可随时复制或取消。">
      <template #badge>
        <el-tag effect="plain" size="small" round type="success">有效 {{ validShareCount }} 个</el-tag>
      </template>
      <template #actions>
        <el-button plain class="custom-btn" @click="clearExpired">
          <el-icon><Delete /></el-icon> 清理已失效
        </el-button>
      </template>
    </PageHeader>

    <transition name="slide-down">
      <div v-if="selectedRows.length > 0" class="batch-action-bar">
        <span class="selected-count">已选择 {{ selectedRows.length }} 项</span>
        <el-button type="danger" plain size="small" @click="batchCancelShare">
          批量取消分享
        </el-button>
        <el-button size="small" @click="tableRef.clearSelection()">取消选择</el-button>
      </div>
    </transition>

    <div class="file-list-wrapper">
      <el-table
          ref="tableRef"
          :data="tableData"
          class="custom-table"
          @selection-change="handleSelectionChange"
          v-loading="loading"
      >
        <el-table-column type="selection" width="50" />

        <el-table-column label="分享文件" min-width="280">
          <template #default="scope">
            <div class="file-info-cell">
              <el-icon class="file-icon" :size="24" :color="getIconColor(scope.row.fileName)">
                <component :is="getIconComponent(scope.row.fileName)" />
              </el-icon>
              <div class="file-details">
                <span class="file-name">{{ scope.row.fileName }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态 / 有效期" width="180">
          <template #default="scope">
            <el-tag
                :type="getStatusInfo(scope.row).type"
                :effect="getStatusInfo(scope.row).effect"
                round
                class="status-tag"
            >
              {{ getStatusInfo(scope.row).text }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="浏览/保存" width="120" align="center">
          <template #default="scope">
            <span class="audit-text">{{ scope.row.views || 0 }} / {{ scope.row.saves || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="shareTime" label="分享时间" width="180" />

        <el-table-column label="操作" width="220" align="right">
          <template #default="scope">
            <div class="premium-actions">
              <button
                  class="action-btn"
                  @click.stop="copyLink(scope.row)"
                  :disabled="getStatusInfo(scope.row).isExpired"
                  :class="{ 'is-disabled': getStatusInfo(scope.row).isExpired }"
              >
                <el-icon><CopyDocument /></el-icon><span>复制链接</span>
              </button>
              <button class="action-btn danger" @click.stop="cancelShare(scope.row)">
                <el-icon><CircleClose /></el-icon><span>取消分享</span>
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :background="true"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, VideoCamera, Picture, CopyDocument, CircleClose, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request' // 已解除注释，引入封装好的 axios
import PageHeader from '@/components/PageHeader.vue'

const tableRef = ref(null)
const tableData = ref([])
const selectedRows = ref([])
const loading = ref(false)

const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)

// 计算有效分享数量 (直接使用后端传来的 expired 字段)
const validShareCount = computed(() => {
  return tableData.value.filter(item => !item.expired).length
})

// 核心：加载真实的分享列表
const loadShareList = async () => {
  loading.value = true
  try {
    const res = await request.post('/share/list', {
      pageNum: currentPage.value,
      pageSize: pageSize.value
    })
    // 假设你的 request 拦截器已经处理了 Result.success 剥离
    // 如果没有剥离，请改为 res.data.data.records
    tableData.value = res.data.records
    total.value = res.data.total
  } catch (error) {
    console.error('获取分享列表失败:', error)
    ElMessage.error('获取分享列表失败')
  } finally {
    loading.value = false
  }
}

// 状态计算逻辑 (利用后端的 status 和 expired 字段精简代码)
const getStatusInfo = (row) => {
  if (row.status === 0 || row.expired) {
    return { text: '已失效', type: 'info', effect: 'dark', isExpired: true }
  }
  if (!row.expireTime) {
    return { text: '永久有效', type: 'success', effect: 'light', isExpired: false }
  }

  // 计算剩余天数 (前端做简单展示)
  const now = new Date().getTime()
  // 注意：后端返回的 expireTime 是 "yyyy-MM-dd HH:mm:ss" 字符串
  const expire = new Date(row.expireTime.replace(/-/g, '/')).getTime()
  const daysLeft = Math.ceil((expire - now) / (1000 * 60 * 60 * 24))

  return { text: `${daysLeft} 天后失效`, type: 'primary', effect: 'light', isExpired: false }
}

// 勾选变化
const handleSelectionChange = (val) => {
  selectedRows.value = val
}

// 复制链接 (字段对齐后端的 shareUrl 和 extractCode)
const copyLink = async (row) => {
  if (getStatusInfo(row).isExpired) return

  const textToCopy = `分享文件：${row.fileName}\n链接：${row.shareUrl}\n提取码：${row.extractCode}`
  try {
    await navigator.clipboard.writeText(textToCopy)
    ElMessage.success('链接及提取码已复制到剪贴板')
  } catch (err) {
    const input = document.createElement('textarea')
    input.value = textToCopy
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('链接及提取码已复制到剪贴板')
  }
}

// 单个取消分享
const cancelShare = (row) => {
  ElMessageBox.confirm(`确定要取消分享 [${row.fileName}] 吗？取消后，原链接将立刻失效。`, '取消分享', {
    confirmButtonText: '确定取消',
    cancelButtonText: '暂不',
    type: 'warning',
    confirmButtonClass: 'el-button--danger'
  }).then(async () => {
    // 对应后端的 ShareCreateDTO.shareIds
    await request.post(`/share/cancel`, { shareIds: [row.id] })
    ElMessage.success('已取消分享')
    loadShareList()
  }).catch(() => {})
}

// 批量取消分享
const batchCancelShare = () => {
  ElMessageBox.confirm(`确定要批量取消这 ${selectedRows.value.length} 个分享吗？`, '批量操作', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger'
  }).then(async () => {
    const ids = selectedRows.value.map(row => row.id)
    await request.post(`/share/cancel`, { shareIds: ids })
    ElMessage.success(`已成功取消 ${ids.length} 个分享`)
    tableRef.value.clearSelection()
    loadShareList()
  }).catch(() => {})
}

// 清理已过期
const clearExpired = () => {
  ElMessageBox.confirm('确定要清除所有已失效的分享记录吗？', '清理记录', {
    confirmButtonText: '清理',
    cancelButtonText: '取消',
    type: 'info'
  }).then(async () => {
    await request.post(`/share/clear-expired`)
    ElMessage.success('失效记录已清理')
    loadShareList()
  }).catch(() => {})
}

// 分页逻辑
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadShareList()
}
const handleCurrentChange = (val) => {
  currentPage.value = val
  loadShareList()
}

// 图标处理
const getIconComponent = (filename) => {
  if (!filename) return Document
  const ext = filename.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return Picture
  if (['mp4', 'avi', 'mov'].includes(ext)) return VideoCamera
  return Document
}

const getIconColor = (filename) => {
  if (!filename) return '#909399'
  const ext = filename.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '#F56C6C'
  if (['doc', 'docx'].includes(ext)) return '#409EFF'
  if (['png', 'jpg', 'jpeg'].includes(ext)) return '#67C23A'
  return '#909399'
}

onMounted(() => {
  loadShareList()
})
</script>

<style scoped>
.share-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-solid);
  padding: 28px 40px;
  overflow-y: auto;
}

/* 旧头部样式已由统一 PageHeader 组件取代 */
.custom-btn {
  border-radius: 8px;
}

/* 批量操作栏动画与样式 */
.batch-action-bar {
  background: color-mix(in srgb, var(--surface-solid) 78%, #ef4444 22%);
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, #ef4444 30%);
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.selected-count {
  font-size: 14px;
  color: #ef4444;
  font-weight: 600;
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 表格定制 (保持和 Disk.vue 一致) */
.file-list-wrapper {
  flex: 1;
  overflow: auto;
}
.file-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}
.file-icon {
  font-size: 24px;
}
.file-details {
  display: flex;
  flex-direction: column;
}
.file-name {
  color: var(--text-primary);
}
.status-tag {
  font-weight: 500;
  border: none;
}
.audit-text {
  color: var(--text-secondary);
  font-size: 13px;
}

/* 操作按钮悬浮显示逻辑 */
.custom-table {
  --el-table-header-text-color: #637282;
  --el-table-bg-color: var(--surface-solid);
  --el-table-tr-bg-color: var(--surface-solid);
  --el-table-row-hover-bg-color: var(--surface-muted);
  --el-table-header-bg-color: var(--surface-muted);
  --el-table-text-color: var(--text-primary);
  --el-table-border-color: var(--border-color);
}
.premium-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
:deep(.el-table__row:hover .premium-actions) {
  opacity: 1;
  transform: translateX(0);
}
/* 如果是失效状态，即使不 hover 也显示一点透明度暗示 */
:deep(.el-table__row .is-disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-btn .el-icon {
  font-size: 15px;
}
.action-btn:hover:not(.is-disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}
.action-btn.danger:hover {
  background: rgba(250, 75, 75, 0.08);
  color: #fa4b4b;
}
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid var(--border-color);
}
:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: var(--surface-muted);
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  padding: 24px 0 10px 0;
  margin-top: 10px;
}
:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: var(--accent);
}

:deep(.el-pagination button),
:deep(.el-pagination .el-pager li) {
  background: var(--surface-muted);
  color: var(--text-primary);
}
</style>
