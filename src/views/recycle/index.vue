<template>
  <div class="recycle-container">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索回收站文件"
          :prefix-icon="Search"
          clearable
          class="search-input"
        />

        <el-button
          type="primary"
          plain
          :icon="RefreshLeft"
          :disabled="selectedItems.length === 0"
          @click="handleBatchRestore"
        >
          批量还原
        </el-button>

        <el-button
          type="danger"
          :icon="Delete"
          :disabled="selectedItems.length === 0"
          @click="handleBatchDelete"
        >
          彻底删除
        </el-button>
      </div>

      <div class="toolbar-right">
        <el-radio-group v-model="viewMode">
          <el-radio-button label="table">
            <el-icon><Menu /></el-icon>
          </el-radio-button>
          <el-radio-button label="grid">
            <el-icon><Grid /></el-icon>
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="main-content" v-loading="loading" element-loading-text="正在加载回收站">
      <el-empty
        v-if="!loading && filteredList.length === 0"
        description="回收站暂无文件"
      />

      <template v-else>
        <el-table
          v-if="viewMode === 'table'"
          :data="filteredList"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />

          <el-table-column label="文件名" min-width="220">
            <template #default="{ row }">
              <div class="file-name-col">
                <el-icon size="18" class="file-icon">
                  <component :is="getFileIcon(row)" />
                </el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="大小" width="140">
            <template #default="{ row }">
              {{ formatSize(row.size) }}
            </template>
          </el-table-column>

          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              {{ row.type === 'folder' ? '文件夹' : '文件' }}
            </template>
          </el-table-column>

          <el-table-column label="删除时间" width="180">
            <template #default="{ row }">
              {{ row.deleteTimeText }}
            </template>
          </el-table-column>

          <el-table-column label="剩余有效期" width="120" prop="expireDays">
            <template #default="{ row }">
              <span :class="{ 'danger-text': row.expireDays <= 3 }">
                {{ row.expireDays }} 天
              </span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleRestore(row)">还原</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="grid-view">
          <el-card
            v-for="item in filteredList"
            :key="`${item.type}-${item.id}`"
            class="file-card"
            shadow="hover"
          >
            <el-checkbox
              class="card-checkbox"
              v-model="item.selected"
              @change="syncGridSelection"
            />

            <div class="card-image">
              <el-icon size="48" class="file-icon">
                <component :is="getFileIcon(item)" />
              </el-icon>
            </div>

            <div class="card-info">
              <div class="card-name" :title="item.name">{{ item.name }}</div>
              <div class="card-meta">{{ item.expireDays }} 天后过期</div>
            </div>

            <div class="card-actions">
              <el-button circle type="primary" :icon="RefreshLeft" @click="handleRestore(item)" />
              <el-button circle type="danger" :icon="Delete" @click="handleDelete(item)" />
            </div>
          </el-card>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Folder, Grid, Menu, RefreshLeft, Search } from '@element-plus/icons-vue'
import request from '@/utils/request'

const loading = ref(false)
const searchKeyword = ref('')
const viewMode = ref('table')
const selectedItems = ref([])
const fileList = ref([])

const filteredList = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return fileList.value
  }
  return fileList.value.filter(item => item.name.toLowerCase().includes(keyword))
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/file/recycle/list')
    fileList.value = (res.data || []).map(item => ({
      id: item.id,
      name: item.name,
      size: item.size || 0,
      type: item.type || 'file',
      expireDays: Number.isFinite(item.expireDays) ? item.expireDays : 0,
      deleteTimeText: formatTime(item.deleteTime),
      selected: false
    }))
    selectedItems.value = []
  } finally {
    loading.value = false
  }
}

const formatTime = (value) => {
  if (!value) {
    return '未知时间'
  }
  if (typeof value === 'string') {
    return value.replace('T', ' ').substring(0, 19)
  }
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
  }
  return String(value)
}

const formatSize = (bytes) => {
  if (!bytes) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 2)} ${units[index]}`
}

const getFileIcon = (row) => {
  return row.type === 'folder' ? Folder : Document
}

const handleSelectionChange = (rows) => {
  selectedItems.value = rows
}

const syncGridSelection = () => {
  selectedItems.value = fileList.value.filter(item => item.selected)
}

const buildPayload = (items) => ({
  fileIds: items.filter(item => item.type !== 'folder').map(item => item.id),
  folderIds: items.filter(item => item.type === 'folder').map(item => item.id)
})

const executeRestore = async (items) => {
  await request.put('/file/recycle/restore', buildPayload(items))
  await fetchData()
}

const executeDelete = async (items) => {
  await request.delete('/file/recycle/delete', {
    data: buildPayload(items)
  })
  await fetchData()
}

const handleRestore = async (row) => {
  await executeRestore([row])
  ElMessage.success('已还原')
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要彻底删除 [${row.name}] 吗？此操作不可恢复。`,
      '危险提示',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    )
    await executeDelete([row])
    ElMessage.success('已彻底删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      throw error
    }
  }
}

const handleBatchRestore = async () => {
  const count = selectedItems.value.length
  await executeRestore(selectedItems.value)
  ElMessage.success(`已还原 ${count} 项`)
}

const handleBatchDelete = async () => {
  try {
    const count = selectedItems.value.length
    await ElMessageBox.confirm(
      `确定要彻底删除选中的 ${count} 项吗？此操作不可恢复。`,
      '危险提示',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    )
    await executeDelete(selectedItems.value)
    ElMessage.success(`已彻底删除 ${count} 项`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      throw error
    }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.recycle-container {
  padding: 20px;
  background: var(--surface-solid);
  min-height: calc(100vh - 40px);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 260px;
}

.file-name-col {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #409eff;
}

.danger-text {
  color: #f56c6c;
  font-weight: 600;
}

.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 18px;
}

.file-card {
  position: relative;
}

.card-checkbox {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
}

.card-image {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-info {
  text-align: center;
  line-height: 1.6;
}

.card-name {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  font-size: 12px;
  color: #f56c6c;
}

.card-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}
</style>
