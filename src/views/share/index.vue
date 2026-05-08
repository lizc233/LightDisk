<template>
  <div class="share-container">
    <header class="content-header">
      <div class="header-left">
        <h2 class="title">我的分享</h2>
        <span class="stat-badge">有效分享：{{ validShareCount }} 个</span>
      </div>
      <div class="header-right">
        <el-button plain class="custom-btn" @click="clearExpired">
          <el-icon><Delete /></el-icon> 一键清理已失效
        </el-button>
      </div>
    </header>

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
// import request from '@/utils/request' // 等后端接口写好后取消注释

const tableRef = ref(null)
const tableData = ref([])
const selectedRows = ref([])
const loading = ref(false)

const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)

// 计算有效分享数量
const validShareCount = computed(() => {
  return tableData.value.filter(item => !getStatusInfo(item).isExpired).length
})

// 加载分享列表
const loadShareList = async () => {
  loading.value = true
  try {
    /* // 真实后端请求示例：
    const res = await request.post('/share/list', {
      pageNum: currentPage.value,
      pageSize: pageSize.value
    })
    tableData.value = res.data.records
    total.value = res.data.total
    */

    // --- 以下为模拟数据，方便你预览前端效果 ---
    setTimeout(() => {
      tableData.value = [
        { id: 1, fileName: '2026-项目启动计划书.pdf', shareTime: '2026-05-08 10:20', expireType: 0, views: 12, saves: 3, url: 'http://localhost:5173/s/abcd123', code: '8888' },
        { id: 2, fileName: '毕业设计-架构图.png', shareTime: '2026-05-07 15:30', expireType: 7, expireTime: '2026-05-14 15:30', views: 5, saves: 1, url: 'http://localhost:5173/s/efgh456', code: '6666' },
        { id: 3, fileName: 'LightDisk-演示视频.mp4', shareTime: '2026-04-01 09:00', expireType: 1, expireTime: '2026-04-02 09:00', views: 45, saves: 12, url: 'http://localhost:5173/s/xyz987', code: '1234' } // 这是一个过期的
      ]
      total.value = 3
      loading.value = false
    }, 500)
    // --- 模拟数据结束 ---

  } catch (error) {
    console.error('获取分享列表失败:', error)
    loading.value = false
  }
}

// 状态计算逻辑 (核心)
const getStatusInfo = (row) => {
  if (row.expireType === 0) {
    return { text: '永久有效', type: 'success', effect: 'light', isExpired: false }
  }

  // 简单判断是否过期 (实际项目中建议后端直接返回一个 isExpired 字段，前端少算时间)
  const now = new Date().getTime()
  const expire = new Date(row.expireTime).getTime()

  if (now > expire) {
    return { text: '已失效', type: 'info', effect: 'dark', isExpired: true }
  } else {
    // 计算剩余天数
    const daysLeft = Math.ceil((expire - now) / (1000 * 60 * 60 * 24))
    return { text: `${daysLeft} 天后失效`, type: 'primary', effect: 'light', isExpired: false }
  }
}

// 勾选变化
const handleSelectionChange = (val) => {
  selectedRows.value = val
}

// 复制链接
const copyLink = async (row) => {
  if (getStatusInfo(row).isExpired) return

  const textToCopy = `分享文件：${row.fileName}\n链接：${row.url}\n提取码：${row.code}`
  try {
    await navigator.clipboard.writeText(textToCopy)
    ElMessage.success('链接及提取码已复制到剪贴板')
  } catch (err) {
    // 兼容旧版浏览器
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
    // await request.post(`/share/cancel`, { ids: [row.id] })
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
    // await request.post(`/share/cancel`, { ids })
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
    // await request.post(`/share/clear-expired`)
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

// 图标处理 (复用 Disk.vue 的逻辑保持一致性)
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
  background: #fff;
  padding: 32px 48px;
}

/* 头部样式 */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.title {
  font-size: 24px;
  font-weight: 700;
  color: #1e1919;
  margin: 0;
}
.stat-badge {
  background: #f0f5ff;
  color: #0061fe;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
}
.custom-btn {
  border-radius: 8px;
}

/* 批量操作栏动画与样式 */
.batch-action-bar {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.selected-count {
  font-size: 14px;
  color: #f56c6c;
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
  color: #1e1919;
}
.status-tag {
  font-weight: 500;
  border: none;
}
.audit-text {
  color: #8a94a5;
  font-size: 13px;
}

/* 操作按钮悬浮显示逻辑 */
.custom-table {
  --el-table-header-text-color: #637282;
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
  color: #8a94a5;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-btn .el-icon {
  font-size: 15px;
}
.action-btn:hover:not(.is-disabled) {
  background: rgba(0, 97, 254, 0.08);
  color: #0061fe;
}
.action-btn.danger:hover {
  background: rgba(250, 75, 75, 0.08);
  color: #fa4b4b;
}
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid #f0f2f5;
}
:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: #fcfdfd;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  padding: 24px 0 10px 0;
  margin-top: 10px;
}
:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: #0061fe;
}
</style>