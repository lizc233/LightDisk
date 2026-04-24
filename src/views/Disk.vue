<template>
  <div class="dropbox-container">
    <div class="sub-sidebar">
      <div class="sidebar-header">
        <h2 class="title">所有文件</h2>
      </div>
      <nav class="nav-group">
        <div class="nav-item" :class="{ active: currentCategory === 'all' && !isRecentMode }" @click="switchCategory('all', false)">
          <el-icon><Folder /></el-icon> <span>全部文件</span>
        </div>
        <div class="nav-item" :class="{ active: isRecentMode }" @click="switchCategory('all', true)">
          <el-icon><Clock /></el-icon> <span>最近使用</span>
        </div>
      </nav>

      <div class="nav-divider"></div>

      <div class="nav-section">
        <h3 class="nav-label">快速筛选</h3>
        <nav class="nav-group">
          <div class="nav-item" :class="{ active: currentCategory === 'doc' }" @click="switchCategory('doc', false)">
            <el-icon><Document /></el-icon> <span>文档</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'image' }" @click="switchCategory('image', false)">
            <el-icon><Picture /></el-icon> <span>图片</span>
          </div>
          <div class="nav-item" :class="{ active: currentCategory === 'video' }" @click="switchCategory('video', false)">
            <el-icon><VideoCamera /></el-icon> <span>视频</span>
          </div>
        </nav>
      </div>
    </div>

    <div class="main-content">
      <header class="content-header">
        <el-input
            v-model="searchQuery"
            placeholder="搜索文件、文件夹..."
            class="search-input"
            :prefix-icon="Search"
            clearable
        />
      </header>

      <div class="action-grid">
        <div class="action-tile light" @click="triggerUpload">
          <el-icon><Upload /></el-icon>
          <span>上传</span>
        </div>
        <div class="action-tile light" @click="handleCreateFolder">
          <el-icon><FolderAdd /></el-icon>
          <span>新建文件夹</span>
        </div>
      </div>

      <input
          type="file"
          ref="fileInput"
          style="display: none"
          @change="handleFileUpload"
      />

      <div class="file-list-wrapper">
        <el-table :data="tableData" class="custom-table" @row-click="handleRowClick">
          <el-table-column label="名称" min-width="300">
            <template #default="scope">
              <div class="file-info-cell">
                <el-icon class="file-icon" :size="24" :color="getIconColor(scope.row)">
                  <component :is="getIconComponent(scope.row)" />
                </el-icon>
                <span class="file-name" style="margin-left: 10px;">{{ scope.row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="修改时间" width="180" />
          <el-table-column label="" width="220" align="right">
            <template #default="scope">
              <div class="premium-actions">
                <button class="action-btn" @click.stop="handleDownload(scope.row)">
                  <el-icon><Download /></el-icon><span>下载</span>
                </button>
                <button class="action-btn" @click.stop="handleShare(scope.row)">
                  <el-icon><Share /></el-icon><span>分享</span>
                </button>
                <button class="action-btn danger" @click.stop="handleDelete(scope.row)">
                  <el-icon><Delete /></el-icon><span>删除</span>
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

    <el-dialog
        v-model="shareDialogVisible"
        title="分享文件"
        width="420px"
        class="custom-dialog"
        destroy-on-close
    >
      <div v-if="!shareResult" class="share-box">
        <p class="share-desc">链接有效期</p>
        <el-radio-group v-model="shareForm.expireType" class="modern-radio">
          <el-radio-button :label="0">永久</el-radio-button>
          <el-radio-button :label="1">7天</el-radio-button>
          <el-radio-button :label="2">30天</el-radio-button>
        </el-radio-group>
      </div>
      <div v-else class="share-success">
        <el-result icon="success" title="分享链接已就绪">
          <template #extra>
            <div class="copy-field">
              <el-input v-model="shareResult.shareUrl" readonly>
                <template #append>
                  <el-button @click="copyText(shareResult.shareUrl)">复制链接</el-button>
                </template>
              </el-input>
            </div>
          </template>
        </el-result>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="shareDialogVisible = false">关闭</el-button>
          <el-button v-if="!shareResult" type="primary" :loading="sharing" @click="createShareLink">创建分享</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// 【改动1】删除了原生的 axios，引入你封装好的 request.js
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

// 补全 Download 和 Share 图标
import { Folder, Document, VideoCamera, Picture, Search, Plus, Upload, FolderAdd, MoreFilled, Delete, Clock, Download, Share } from '@element-plus/icons-vue'

const searchQuery = ref('')
const tableData = ref([])
const currentFolderId = ref(0)

const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const currentCategory = ref('all') // 'all', 'doc', 'image', 'video'
const isRecentMode = ref(false)
// ========== 新增：菜单切换逻辑 ==========
const switchCategory = (category, recent) => {
  currentCategory.value = category
  isRecentMode.value = recent
  currentPage.value = 1 // 切换分类时，必须把页码重置为第1页

  // 如果是按类型全局搜索或最近使用，通常不在特定文件夹里查，所以将当前目录重置为根目录
  if (category !== 'all' || recent) {
    currentFolderId.value = 0
  }

  loadFileList()
}

// ========== 新增：分页触发逻辑 ==========
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadFileList()
}
const handleCurrentChange = (val) => {
  currentPage.value = val
  loadFileList()
}

// 【改动2】删除了冗余的 getAuthHeaders 方法，因为 request.js 已经自动处理了 Token

// ========== 获取文件列表 ==========
// ========== 获取文件列表 ==========
const loadFileList = async () => {
  try {
    const res = await request.post('/file/list', {
      folderId: currentFolderId.value,
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      category: currentCategory.value,
      isRecent: isRecentMode.value
    })
    total.value = res.data.total

    // 因为 request.js 返回的是 response.data，所以这里直接用 res.data
    tableData.value = res.data.records.map(item => {
      // 🌟 新增：时间格式超级兼容处理
      let timeStr = '未知时间'
      if (item.updateTime) {
        if (typeof item.updateTime === 'string') {
          // 如果是标准 ISO 字符串
          timeStr = item.updateTime.replace('T', ' ').substring(0, 19)
        } else if (Array.isArray(item.updateTime)) {
          // 如果是 Spring Boot 默认的 LocalDateTime 数组 [年, 月, 日, 时, 分, 秒]
          const [y, m, d, h, min, s] = item.updateTime
          timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`
        } else {
          // 如果是长整型时间戳
          timeStr = new Date(item.updateTime).toLocaleString()
        }
      }

      return {
        id: item.id,
        name: item.name,
        type: item.type,
        date: timeStr,
        isFolder: item.type === 'folder'
      }
    })
  } catch (error) {
    console.error('加载列表异常:', error)
  }
}

const getToken = () => {
  // 🌟 这里请根据你项目的实际情况获取！最常见的是存在 localStorage 里：
  // 如果你不知道存在哪，去看看你的 request.js 文件里的拦截器是怎么拿 token 的。
  return localStorage.getItem('token') || localStorage.getItem('satoken') || ''
}
const handleRowClick = (row) => {
  if (row.isFolder) {
    currentFolderId.value = row.id;
    loadFileList();
  } else {
    ElMessage.info(`正在加载预览...`);
    const token = getToken();
    console.log("当前提取到的Token是:", token);
    // 🌟 直接拼接 URL，让浏览器自己去处理！
    window.open(`/api/file/preview/${row.id}?token=${token}`, '_blank');
  }
}
const handleDownload = (row) => {
  if (row.isFolder) {
    ElMessage.warning('暂不支持直接下载文件夹');
    return;
  }
  ElMessage.info(`开始安全下载...`);
  const token = getToken();
  // 🌟 下载接口也一样，传 token 即可
  window.open(`/api/file/download/${row.id}?token=${token}`, '_self');
}

onMounted(() => {
  loadFileList()
})

// ========== 删除文件/文件夹逻辑 ==========
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要把 [${row.name}] 移入回收站吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const url = row.isFolder ? `/folder/${row.id}` : `/file/${row.id}`
      await request.delete(url) // 极简调用

      ElMessage.success('已移入回收站')
      loadFileList()
    } catch (e) {
      // 错误由 request.js 统一处理
    }
  }).catch(() => {})
}

// ========== 分享逻辑 ==========
const shareDialogVisible = ref(false)
const sharing = ref(false)
const currentFile = ref(null)
const shareResult = ref(null)
const shareForm = reactive({ expireType: 1 })

const handleShare = (row) => {
  if (row.isFolder) {
    ElMessage.warning('目前暂不支持分享文件夹哦')
    return
  }
  currentFile.value = row
  shareResult.value = null
  shareDialogVisible.value = true
}

const createShareLink = async () => {
  sharing.value = true
  try {
    // 假设后端分享接口为 /api/share/create
    const res = await request.post('/share/create', {
      fileId: currentFile.value.id,
      expireType: shareForm.expireType
    })
    shareResult.value = res.data
    ElMessage.success('分享成功')
  } catch (e) {
    // 错误由 request.js 统一处理
  } finally {
    sharing.value = false
  }
}

// ========== 动态图标逻辑 ==========
const getIconComponent = (row) => {
  if (row.isFolder) return Folder
  if (!row.name) return Document
  const ext = row.name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return Picture
  if (['mp4', 'avi', 'mov'].includes(ext)) return VideoCamera
  return Document
}

const getIconColor = (row) => {
  if (row.isFolder) return '#FFCA28' // 文件夹是亮黄色
  if (!row.name) return '#909399'
  const ext = row.name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '#F56C6C' // PDF是红色
  if (['doc', 'docx'].includes(ext)) return '#409EFF' // Word是蓝色
  if (['png', 'jpg', 'jpeg'].includes(ext)) return '#67C23A' // 图片是绿色
  return '#909399' // 默认灰色
}

// ========== 文件上传逻辑 ==========
const fileInput = ref(null)

const triggerUpload = () => {
  fileInput.value.click()
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folderId', currentFolderId.value)

  try {
    ElMessage.info('正在全速上传...')
    // 【改动4】axios 遇到 FormData 会自动把 Content-Type 设为 multipart/form-data，无需手动干预
    await request.post('/file/upload', formData)

    ElMessage.success('数字资产已落盘')
    await loadFileList()
    loadFileList()
  } catch (error) {
    console.error('上传受阻:', error)
  } finally {
    event.target.value = ''
  }
}
</script>

<style scoped>
.dropbox-container { display: flex; height: 100%; background: #fff; }

/* 侧边栏样式 */
.sub-sidebar { width: 240px; background: #f7f9fa; border-right: 1px solid #e6e9eb; padding: 32px 16px; }
.title { font-size: 20px; font-weight: 700; margin-bottom: 24px; padding-left: 12px; }
.nav-label { font-size: 12px; color: #637282; margin: 24px 0 12px 12px; text-transform: uppercase; }
.nav-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; color: #1e1919; transition: all 0.2s;
}
.nav-item:hover { background: #e6e9eb; }
.nav-item.active { background: #0061fe; color: #fff; }
.nav-divider { height: 1px; background: #e6e9eb; margin: 20px 12px; }

/* 主区域样式 */
.main-content { flex: 1; padding: 32px 48px; overflow-y: auto; }
.search-input { max-width: 560px; margin-bottom: 32px; }
:deep(.search-input .el-input__wrapper) {
  background: #f7f9fa; border-radius: 24px; box-shadow: none !important; border: 1px solid transparent;
}
:deep(.search-input .el-input__wrapper:hover) { border-color: #0061fe; }

/* 磁贴按键 */
.action-grid { display: flex; gap: 16px; margin-bottom: 40px; }
.action-tile {
  width: 130px; height: 90px; border-radius: 12px; display: flex; flex-direction: column;
  justify-content: center; align-items: flex-start; padding: 16px; cursor: pointer; transition: 0.2s;
}
.action-tile.dark { background: #1e1919; color: #fff; }
.action-tile.light { border: 1px solid #e6e9eb; }
.action-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

/* 胶囊过滤器 */
.filter-pills { display: flex; gap: 8px; margin-bottom: 24px; }
.pill {
  padding: 6px 16px; border-radius: 20px; background: #f7f9fa; font-size: 14px;
  cursor: pointer; transition: 0.2s; border: 1px solid transparent;
}
.pill:hover { background: #e6e9eb; }
.pill.active { background: #1e1919; color: #fff; }

/* 表格定制 */
.file-info-cell { display: flex; align-items: center; gap: 12px; font-weight: 500; }
.file-icon { font-size: 20px; }
.pdf { color: #fa4b4b; }
.video { color: #0061fe; }
.img { color: #00a870; }
.custom-table { --el-table-header-text-color: #637282; }
.premium-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0; /* 默认完全透明，保持列表清爽 */
  transform: translateX(10px); /* 默认带一点点位移 */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); /* 顶级顺滑的弹性动画 */
}

/* 核心：当鼠标悬浮在这一行时，按钮组平滑滑入并显现 */
:deep(.el-table__row:hover .premium-actions) {
  opacity: 1;
  transform: translateX(0);
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
  color: #8a94a5; /* 极其柔和的默认灰蓝色 */
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn .el-icon {
  font-size: 15px;
}

/* 常规按钮悬浮：极浅的品牌蓝背景，文字点亮为品牌蓝 */
.action-btn:hover {
  background: rgba(0, 97, 254, 0.08);
  color: #0061fe;
}

/* 危险按钮悬浮：极浅的红色背景，文字点亮为警告红 */
.action-btn.danger:hover {
  background: rgba(250, 75, 75, 0.08);
  color: #fa4b4b;
}
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid #f0f2f5;
}
:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: #fcfdfd; /* 修改默认的高亮颜色，改为极其克制的白偏灰 */
}
/* 分页条优雅居中 */
.pagination-container {
  display: flex;
  justify-content: flex-end; /* 靠右对齐显得更专业，也可改为 center 居中 */
  padding: 24px 0 10px 0;
  margin-top: 10px;
}
:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: #0061fe; /* 品牌蓝 */
}
</style>