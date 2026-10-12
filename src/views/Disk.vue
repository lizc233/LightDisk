<template>
  <div class="dropbox-container">
    <div class="sub-sidebar">
      <div class="sidebar-header">
        <h2 class="title">所有文件</h2>
      </div>
      <nav class="nav-group">
        <div class="nav-item" :class="{ active: currentCategory === 'all' && !isRecentMode && !activeFilterKey }" @click="switchCategory('all', false)">
          <el-icon><Folder /></el-icon>
          <span>全部文件</span>
        </div>
        <div class="nav-item" :class="{ active: isRecentMode && !activeFilterKey }" @click="switchCategory('all', true)">
          <el-icon><Clock /></el-icon>
          <span>最近使用</span>
        </div>
      </nav>

      <div class="nav-divider"></div>

      <div class="nav-section">
        <div class="nav-section-head">
          <h3 class="nav-label">快速筛选</h3>
          <button class="mini-btn" title="管理标签" @click="openTagManage">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
        <nav class="nav-group">
          <div
            v-for="entry in sidebarEntries"
            :key="entry.key"
            class="nav-item"
            :class="{ active: isEntryActive(entry), dragging: dragKey === entry.key }"
            draggable="true"
            @click="activateEntry(entry)"
            @dragstart="onDragStart(entry, $event)"
            @dragover.prevent
            @drop="onDrop(entry, $event)"
            @dragend="dragKey = null"
          >
            <el-icon v-if="entry.icon"><component :is="entry.icon" /></el-icon>
            <span v-else class="tag-dot" :style="{ background: entry.color }"></span>
            <span class="nav-text">{{ entry.label }}</span>
          </div>
        </nav>
      </div>
    </div>

    <div class="main-content">
      <header class="content-header">
        <div class="breadcrumb-wrap">
          <button
            v-for="item in breadcrumbs"
            :key="item.id"
            class="crumb-btn"
            :class="{ active: item.id === currentFolderId && !isRecentMode && currentCategory === 'all' }"
            @click="goToFolder(item.id)"
          >
            <span>{{ item.name }}</span>
            <el-icon v-if="item.id !== breadcrumbs[breadcrumbs.length - 1].id"><ArrowRight /></el-icon>
          </button>
        </div>

        <el-input
          v-model="searchQuery"
          placeholder="搜索当前列表..."
          class="search-input"
          :prefix-icon="Search"
          clearable
        />

        <el-select
          v-if="tags.length"
          v-model="uploadTagIds"
          multiple
          collapse-tags
          size="small"
          placeholder="上传后打标签"
          class="upload-tag-select"
        >
          <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </header>

      <div class="action-grid">
        <div class="action-tile light" @click="triggerUpload">
          <el-icon><Upload /></el-icon>
          <span>上传到当前目录</span>
        </div>
        <div class="action-tile light" @click="handleCreateFolder">
          <el-icon><FolderAdd /></el-icon>
          <span>新建文件夹</span>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        style="display: none"
        @change="handleFileUpload"
      />

      <div class="file-list-wrapper">
        <el-table :data="displayTableData" class="custom-table" @row-click="handleRowClick">
          <el-table-column label="名称" min-width="320">
            <template #default="{ row }">
              <div class="file-info-cell">
                <button
                  v-if="!row.isFolder"
                  class="star-btn"
                  :class="{ on: row.isFavorite }"
                  :title="row.isFavorite ? '取消收藏' : '收藏'"
                  @click.stop="toggleFavorite(row)"
                >
                  <el-icon><StarFilled v-if="row.isFavorite" /><Star v-else /></el-icon>
                </button>
                <el-icon class="file-icon" :size="24" :color="getIconColor(row)">
                  <component :is="getIconComponent(row)" />
                </el-icon>
                <span class="file-name">{{ row.name }}</span>
                <span
                  v-for="t in (row.tags || [])"
                  :key="t.id"
                  class="tag-chip"
                  :style="{ color: t.color, borderColor: t.color, background: t.color + '1A' }"
                >{{ t.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="date" label="修改时间" width="180" />

          <el-table-column label="" width="320" align="right">
            <template #default="{ row }">
              <div class="premium-actions">
                <button class="action-btn" @click.stop="handleDownload(row)">
                  <el-icon><Download /></el-icon>
                  <span>下载</span>
                </button>

                <button class="action-btn" @click.stop="handleShare(row)">
                  <el-icon><Share /></el-icon>
                  <span>分享</span>
                </button>

                <button class="action-btn danger" @click.stop="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                  <span>删除</span>
                </button>

                <el-popover
                  v-if="!row.isFolder"
                  placement="bottom-end"
                  trigger="hover"
                  :width="150"
                >
                  <template #reference>
                    <button class="action-btn more-btn" @click.stop>
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                  </template>

                  <button class="popover-action" @click.stop="openMoveDialog(row)">
                    <el-icon><FolderOpened /></el-icon>
                    <span>移入文件夹</span>
                  </button>
                  <button v-if="!row.isFolder" class="popover-action" @click.stop="openTagPicker(row)">
                    <el-icon><CollectionTag /></el-icon>
                    <span>设置标签</span>
                  </button>
                </el-popover>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :background="true"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>

    <!-- 在线文本编辑器 -->
    <TextEditorDialog v-model="editorVisible" :file-id="editorFileId" @saved="loadFileList" />
    <OfficePreviewDialog
      v-model="officeVisible"
      :file-id="officeFileId"
      :file-name="officeFileName"
      :kind="officeKind"
    />

    <el-dialog
      v-model="shareDialogVisible"
      title="分享文件"
      width="420px"
      class="custom-dialog"
      destroy-on-close
    >
      <div v-if="!shareResult" class="share-box">
        <p class="share-desc">链接有效期</p>
        <el-radio-group v-model="shareForm.expireDays" class="modern-radio">
          <el-radio-button :label="7">7天</el-radio-button>
          <el-radio-button :label="15">15天</el-radio-button>
          <el-radio-button :label="30">30天</el-radio-button>
        </el-radio-group>
      </div>

      <div v-else class="share-success">
        <el-result icon="success" title="分享链接已创建">
          <template #extra>
            <div class="copy-field">
              <el-input :model-value="shareResult.shareUrl" readonly>
                <template #append>
                  <el-button @click="copyText(shareResult.shareUrl)">复制链接</el-button>
                </template>
              </el-input>
            </div>
            <div class="extract-code-line">提取码：{{ shareResult.extractCode }}</div>
            <div class="share-copy-actions">
              <el-button text @click="copyShareMessage()">复制链接和提取码</el-button>
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

    <el-dialog
      v-model="moveDialogVisible"
      title="移入文件夹"
      width="440px"
      destroy-on-close
    >
      <div class="move-dialog-body">
        <div class="move-current-file">
          <span class="move-label">当前文件</span>
          <strong>{{ moveTargetFile?.name || '-' }}</strong>
        </div>

        <button
          class="root-folder-card"
          :class="{ active: moveTargetFolderId === 0 }"
          @click="selectMoveFolder(0)"
        >
          <el-icon><Folder /></el-icon>
          <span>全部文件</span>
        </button>

        <div v-if="folderTreeData.length" class="folder-tree-panel">
          <div class="move-label">已有文件夹</div>
          <el-tree
            ref="folderTreeRef"
            :data="folderTreeData"
            node-key="id"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            @node-click="handleFolderNodeClick"
          >
            <template #default="{ data }">
              <div class="folder-tree-node">
                <el-icon><Folder /></el-icon>
                <span>{{ data.label }}</span>
              </div>
            </template>
          </el-tree>
        </div>

        <el-empty v-else description="还没有可选文件夹，文件可以先留在全部文件中" :image-size="100" />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="moveDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="movingFile" @click="submitMoveFile">确认移入</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 标签管理（新建 / 改名 / 换色 / 删除） -->
    <el-dialog v-model="tagManageVisible" title="标签管理" width="520px" destroy-on-close>
      <div class="tag-manage-list">
        <div v-for="t in tags" :key="t.id" class="tag-manage-row">
          <el-color-picker v-model="t.color" size="small" :predefine="TAG_COLORS" @change="saveTag(t)" />
          <el-input v-model="t.name" size="small" maxlength="16" @keyup.enter="saveTag(t)" />
          <el-button size="small" text type="primary" @click="saveTag(t)">保存</el-button>
          <el-button size="small" text type="danger" @click="removeTag(t)">删除</el-button>
        </div>
        <div v-if="!tags.length" class="tag-empty">还没有标签，在下方创建第一个吧</div>
        <div class="tag-create-row">
          <el-color-picker v-model="newTagColor" size="small" :predefine="TAG_COLORS" />
          <el-input v-model="newTagName" size="small" maxlength="16" placeholder="新标签名称" @keyup.enter="createTag" />
          <el-button size="small" type="primary" :disabled="!newTagName.trim()" @click="createTag">创建</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 为文件设置标签 -->
    <el-dialog v-model="tagPickerVisible" :title="`设置标签：${tagPickerFile?.name || ''}`" width="420px" destroy-on-close>
      <div v-if="!tags.length" class="tag-empty">
        还没有标签，请先点侧边栏「快速筛选」旁的齿轮按钮创建。
      </div>
      <el-checkbox-group v-else v-model="tagPickerSelection">
        <div v-for="t in tags" :key="t.id" class="tag-picker-row">
          <el-checkbox :value="t.id">
            <span class="tag-chip" :style="{ color: t.color, borderColor: t.color, background: t.color + '1A' }">
              {{ t.name }}
            </span>
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="tagPickerVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagPickerSaving" @click="saveFileTags">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import TextEditorDialog from '@/components/TextEditorDialog.vue'
import OfficePreviewDialog from '@/components/OfficePreviewDialog.vue'
import {
  ArrowRight,
  Clock,
  CollectionTag,
  Delete,
  Document,
  Download,
  Folder,
  FolderAdd,
  FolderOpened,
  MoreFilled,
  Picture,
  Search,
  Setting,
  Share,
  Star,
  StarFilled,
  Upload,
  VideoCamera
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const searchQuery = ref('')
const tableData = ref([])
const allFolders = ref([])
const currentFolderId = ref(0)

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const currentCategory = ref('all')
const isRecentMode = ref(false)

// ===== 收藏 / 标签 / 快速筛选拖拽 =====
const TAG_COLORS = ['#0F6E56', '#2563eb', '#d85a30', '#993556', '#639922', '#ba7517', '#534AB7', '#888780']
const tags = ref([])                      // 我的标签 [{id,name,color,fileCount}]
const activeFilterKey = ref('')           // '' | 'fav' | 'tag:{id}'
const sidebarOrder = ref([])              // 快速筛选条目顺序 key 列表
const dragKey = ref('')
const tagManageVisible = ref(false)
const newTagName = ref('')
const newTagColor = ref(TAG_COLORS[0])
const tagPickerVisible = ref(false)
const tagPickerFile = ref(null)
const tagPickerSelection = ref([])
const tagPickerSaving = ref(false)
const uploadTagIds = ref([])

/** 快速筛选条目：内置类型 + 收藏 + 各标签，按用户拖拽顺序排列 */
const sidebarEntries = computed(() => {
  const entries = [
    { key: 'type:doc', type: 'type', label: '文档', icon: Document },
    { key: 'type:image', type: 'type', label: '图片', icon: Picture },
    { key: 'type:video', type: 'type', label: '视频', icon: VideoCamera },
    { key: 'fav', type: 'fav', label: '收藏', icon: StarFilled },
    ...tags.value.map(t => ({ key: `tag:${t.id}`, type: 'tag', label: t.name, color: t.color, tagId: t.id }))
  ]
  const order = sidebarOrder.value
  const known = new Set(entries.map(e => e.key))
  const sorted = [
    ...order.filter(k => known.has(k)).map(k => entries.find(e => e.key === k)),
    ...entries.filter(e => !order.includes(e.key))
  ]
  return sorted
})

const isEntryActive = (entry) => {
  if (entry.type === 'type') {
    return currentCategory.value === entry.key.slice(5) && activeFilterKey.value === ''
  }
  return activeFilterKey.value === entry.key
}

const activateEntry = async (entry) => {
  if (entry.type === 'type') {
    activeFilterKey.value = ''
    await switchCategory(entry.key.slice(5), false)
    return
  }
  activeFilterKey.value = entry.key
  currentCategory.value = 'all'
  isRecentMode.value = true
  currentPage.value = 1
  await goToFolder(0, { preserveFilters: true })
}

const onDragStart = (entry, event) => {
  dragKey.value = entry.key
  event.dataTransfer.effectAllowed = 'move'
  try {
    event.dataTransfer.setData('text/plain', entry.key)
  } catch (e) { /* IE 兼容忽略 */ }
}

const onDrop = async (targetEntry, event) => {
  event.preventDefault()
  const from = dragKey.value
  dragKey.value = null
  if (!from || from === targetEntry.key) return

  const keys = sidebarEntries.value.map(e => e.key)
  const fromIdx = keys.indexOf(from)
  const toIdx = keys.indexOf(targetEntry.key)
  if (fromIdx < 0 || toIdx < 0) return

  keys.splice(toIdx, 0, keys.splice(fromIdx, 1)[0])
  sidebarOrder.value = keys
  try {
    await request.post('/user/settings', { sidebarOrder: JSON.stringify(keys) })
  } catch (e) {
    /* 顺序保存失败不影响本地使用 */
  }
}

const loadTags = async () => {
  try {
    const res = await request.get('/file/tags')
    tags.value = res.data || []
  } catch (e) {
    tags.value = []
  }
}

const loadSidebarOrder = async () => {
  try {
    const res = await request.get('/user/settings')
    const raw = res.data?.sidebarOrder
    if (raw) sidebarOrder.value = JSON.parse(raw)
  } catch (e) {
    sidebarOrder.value = []
  }
}

const toggleFavorite = async (row) => {
  try {
    const res = await request.put(`/file/${row.id}/favorite`)
    row.isFavorite = res.data ? 1 : 0
    if (activeFilterKey.value === 'fav' && !row.isFavorite) {
      // 收藏视图里取消收藏 → 从列表中移除
      tableData.value = tableData.value.filter(item => item.id !== row.id)
      total.value = Math.max(total.value - 1, 0)
    }
  } catch (e) {
    /* 失败提示由全局拦截器处理 */
  }
}

const openTagManage = () => {
  newTagName.value = ''
  newTagColor.value = TAG_COLORS[0]
  tagManageVisible.value = true
}

const createTag = async () => {
  const name = newTagName.value.trim()
  if (!name) return
  try {
    const res = await request.post('/file/tags', { name, color: newTagColor.value })
    tags.value.push(res.data)
    newTagName.value = ''
    ElMessage.success('标签已创建')
  } catch (e) { /* 同名等错误由全局拦截器提示 */ }
}

const saveTag = async (t) => {
  if (!t.name.trim()) return
  try {
    await request.put(`/file/tags/${t.id}`, { name: t.name.trim(), color: t.color })
    ElMessage.success('标签已更新')
  } catch (e) { /* 同名等错误由全局拦截器提示 */ }
}

const removeTag = async (t) => {
  try {
    await ElMessageBox.confirm(`删除标签「${t.name}」？文件本身不受影响。`, '删除标签', { type: 'warning' })
  } catch { return }
  await request.delete(`/file/tags/${t.id}`)
  tags.value = tags.value.filter(item => item.id !== t.id)
  sidebarOrder.value = sidebarOrder.value.filter(k => k !== `tag:${t.id}`)
  if (activeFilterKey.value === `tag:${t.id}`) {
    activeFilterKey.value = ''
    await loadFileList()
  }
}

const openTagPicker = (row) => {
  tagPickerFile.value = row
  tagPickerSelection.value = (row.tags || []).map(t => t.id)
  tagPickerVisible.value = true
}

const saveFileTags = async () => {
  if (!tagPickerFile.value) return
  tagPickerSaving.value = true
  try {
    await request.post(`/file/${tagPickerFile.value.id}/tags`, { tagIds: tagPickerSelection.value })
    tagPickerFile.value.tags = tags.value
      .filter(t => tagPickerSelection.value.includes(t.id))
      .map(t => ({ id: t.id, name: t.name, color: t.color }))
    tagPickerVisible.value = false
    ElMessage.success('标签已更新')
  } finally {
    tagPickerSaving.value = false
  }
}

const shareDialogVisible = ref(false)
const sharing = ref(false)
const currentFile = ref(null)
const shareResult = ref(null)
const shareForm = reactive({ expireDays: 15 })

const fileInput = ref(null)
const moveDialogVisible = ref(false)
const movingFile = ref(false)
const moveTargetFile = ref(null)
const moveTargetFolderId = ref(0)
const folderTreeRef = ref(null)

const folderMap = computed(() => {
  const map = new Map()
  allFolders.value.forEach(folder => {
    map.set(folder.id, folder)
  })
  return map
})

const breadcrumbs = computed(() => {
  const items = [{ id: 0, name: '全部文件' }]
  let current = folderMap.value.get(currentFolderId.value)
  let guard = 0

  while (current && guard < 20) {
    items.splice(1, 0, { id: current.id, name: current.folderName })
    current = folderMap.value.get(current.parentId)
    guard++
  }

  return items
})

const displayTableData = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) {
    return tableData.value
  }
  return tableData.value.filter(item => item.name.toLowerCase().includes(keyword))
})

const folderTreeData = computed(() => buildFolderTree(allFolders.value))

const parseFolderId = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

const syncCurrentFolderFromRoute = () => {
  currentFolderId.value = parseFolderId(route.query.folderId)
}

const formatTime = (value) => {
  if (!value) return '未知时间'
  if (typeof value === 'string') {
    return value.replace('T', ' ').substring(0, 19)
  }
  if (Array.isArray(value)) {
    const [y, m, d, h, min] = value
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`
  }
  return new Date(value).toLocaleString()
}

const buildFolderTree = (folders) => {
  const nodes = folders.map(folder => ({
    id: folder.id,
    label: folder.folderName,
    parentId: folder.parentId,
    children: []
  }))
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const roots = []

  nodes.forEach(node => {
    const parent = nodeMap.get(node.parentId)
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

const loadFolderCatalog = async () => {
  const res = await request.get('/folder/all')
  allFolders.value = res.data || []

  if (currentFolderId.value !== 0 && !folderMap.value.has(currentFolderId.value)) {
    ElMessage.warning('目标文件夹不存在，已返回全部文件')
    await goToFolder(0)
  }
}

const loadFileList = async () => {
  try {
    const tagFilterKey = activeFilterKey.value.startsWith('tag:') ? activeFilterKey.value : ''
    const res = await request.post('/file/list', {
      folderId: currentFolderId.value,
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      category: currentCategory.value,
      isRecent: isRecentMode.value,
      favorite: activeFilterKey.value === 'fav' || undefined,
      tagId: tagFilterKey ? Number(tagFilterKey.slice(4)) : undefined
    })

    total.value = res.data.total
    tableData.value = (res.data.records || []).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      date: formatTime(item.updateTime),
      isFavorite: item.isFavorite === 1,
      tags: item.tags || [],
      isFolder: item.type === 'folder'
    }))
  } catch (error) {
    console.error('加载文件列表失败:', error)
  }
}

const goToFolder = async (folderId, options = {}) => {
  const { preserveFilters = false } = options
  if (!preserveFilters) {
    currentCategory.value = 'all'
    isRecentMode.value = false
    activeFilterKey.value = ''
  }

  const targetQuery = folderId ? { folderId: String(folderId) } : {}
  if (String(route.query.folderId || '') === String(targetQuery.folderId || '')) {
    currentFolderId.value = folderId
    currentPage.value = 1
    await loadFileList()
    return
  }

  await router.push({
    name: 'Disk',
    query: targetQuery
  })
}

const switchCategory = async (category, recent) => {
  currentCategory.value = category
  isRecentMode.value = recent
  activeFilterKey.value = ''
  currentPage.value = 1

  if (category !== 'all' || recent) {
    await goToFolder(0, { preserveFilters: true })
    return
  }

  await goToFolder(0, { preserveFilters: true })
}

const handleSizeChange = async (value) => {
  pageSize.value = value
  currentPage.value = 1
  await loadFileList()
}

const handleCurrentChange = async (value) => {
  currentPage.value = value
  await loadFileList()
}

const getToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

const handleRowClick = async (row) => {
  if (row.isFolder) {
    currentCategory.value = 'all'
    isRecentMode.value = false
    await goToFolder(row.id)
    return
  }

  // 文本类文件 → 在线编辑器（txt/md/json/csv 等，后端白名单 + 2MB 限制）
  if (isTextEditable(row)) {
    editorFileId.value = row.id
    editorVisible.value = true
    return
  }

  const action = resolveOpenAction(row)
  if (action === 'download') {
    handleDownload(row)
    return
  }

  // docx → 前端 docx-preview 在线预览；doc → 后端 POI 解析后在线预览
  const ext = (row.name || '').split('.').pop().toLowerCase()
  if (ext === 'docx' || ext === 'doc') {
    officeFileId.value = row.id
    officeFileName.value = row.name
    officeKind.value = ext
    officeVisible.value = true
    return
  }

  ElMessage.info('正在加载预览...')
  if (!isBrowserPreviewable(row)) {
    ElMessage.warning('当前浏览器无法直接预览该文档，已切换为下载')
    handleDownload(row)
    return
  }

  const token = getToken()
  window.open(`/api/file/preview/${row.id}?token=${token}`, '_blank')
}

const handleDownload = (row) => {
  if (row.isFolder) {
    ElMessage.warning('文件夹暂不支持直接下载')
    return
  }
  const token = getToken()
  window.open(`/api/file/download/${row.id}?token=${token}`, '_self')
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要把 [${row.name}] 移入回收站吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await request.put('/file/recycle/trash', {
      fileIds: row.isFolder ? [] : [row.id],
      folderIds: row.isFolder ? [row.id] : []
    })
    ElMessage.success('已移入回收站')
    await loadFolderCatalog()
    await loadFileList()
  }).catch(() => {})
}

const handleShare = (row) => {
  if (row.isFolder) {
    ElMessage.warning('文件夹暂不支持分享')
    return
  }
  currentFile.value = row
  shareResult.value = null
  shareForm.expireDays = Number(userStore.userInfo?.defaultShareExpireDays || 15)
  shareDialogVisible.value = true
}

const createShareLink = async () => {
  sharing.value = true
  try {
    const res = await request.post('/share/create', {
      fileId: currentFile.value.id,
      expireDays: shareForm.expireDays
    })
    shareResult.value = res.data
    ElMessage.success('分享创建成功')
  } finally {
    sharing.value = false
  }
}

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    ElMessage.success('复制成功')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const copyShareMessage = async () => {
  if (!shareResult.value) return
  const text = `分享文件：${currentFile.value?.name || shareResult.value.fileName}\n链接：${shareResult.value.shareUrl}\n提取码：${shareResult.value.extractCode}`
  await copyText(text)
}

const getIconComponent = (row) => {
  if (row.isFolder) return Folder
  if (!row.name) return Document
  const ext = row.name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return Picture
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return VideoCamera
  return Document
}

const resolveFileCategory = (row) => {
  if (row.isFolder || !row.name) return 'other'
  const ext = row.name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) return 'doc'
  return 'other'
}

// ===== 在线文本编辑器 =====
const editorVisible = ref(false)
const editorFileId = ref(null)

// ===== Word 预览（docx 前端渲染 / doc 后端解析）=====
const officeVisible = ref(false)
const officeFileId = ref(null)
const officeFileName = ref('')
const officeKind = ref('docx')
const TEXT_EDITABLE_EXTS = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'ini', 'conf', 'properties', 'html', 'css', 'js', 'sql', 'bat', 'sh']

const isTextEditable = (row) => {
  if (row.isFolder || !row.name) return false
  const ext = row.name.split('.').pop().toLowerCase()
  return TEXT_EDITABLE_EXTS.includes(ext)
}

const resolveOpenAction = (row) => {  const category = resolveFileCategory(row)
  const info = userStore.userInfo || {}
  if (category === 'image') return info.imageOpenAction || 'preview'
  if (category === 'video') return info.videoOpenAction || 'preview'
  if (category === 'doc') return info.docOpenAction || 'download'
  return info.otherOpenAction || 'download'
}

const isBrowserPreviewable = (row) => {
  if (row.isFolder || !row.name) return false
  const ext = row.name.split('.').pop().toLowerCase()
  return [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    'mp4', 'avi', 'mov', 'mkv', 'webm',
    'pdf', 'txt', 'md'
  ].includes(ext)
}

const getIconColor = (row) => {
  if (row.isFolder) return '#FFCA28'
  if (!row.name) return '#909399'
  const ext = row.name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '#F56C6C'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return '#409EFF'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return '#67C23A'
  return '#909399'
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleCreateFolder = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '文件夹名称不能为空'
    })

    await request.post('/folder/create', {
      name: value.trim(),
      parentId: currentFolderId.value
    })

    ElMessage.success('文件夹创建成功')
    await loadFolderCatalog()
    await loadFileList()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error('创建文件夹失败:', error)
    }
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folderId', currentFolderId.value)

  try {
    ElMessage.info('正在上传...')
    const res = await request.post('/file/upload', formData, {
      timeout: 0
    })
    ElMessage.success('文件上传成功')
    // 上传后自动打上工具栏选择的标签
    if (uploadTagIds.value.length && res.data) {
      try {
        await request.post(`/file/${res.data}/tags`, { tagIds: uploadTagIds.value })
      } catch (e) { /* 打标失败不阻断上传流程 */ }
    }
    await loadFileList()
  } catch (error) {
    console.error('上传失败:', error)
  } finally {
    event.target.value = ''
  }
}

const openMoveDialog = async (row) => {
  moveTargetFile.value = row
  moveTargetFolderId.value = currentFolderId.value
  moveDialogVisible.value = true
  await loadFolderCatalog()
  await nextTick()
  folderTreeRef.value?.setCurrentKey(moveTargetFolderId.value)
}

const selectMoveFolder = (folderId) => {
  moveTargetFolderId.value = folderId
  if (folderId === 0) {
    folderTreeRef.value?.setCurrentKey(null)
  } else {
    folderTreeRef.value?.setCurrentKey(folderId)
  }
}

const handleFolderNodeClick = (data) => {
  moveTargetFolderId.value = data.id
}

const submitMoveFile = async () => {
  if (!moveTargetFile.value) return

  movingFile.value = true
  try {
    await request.put(`/file/${moveTargetFile.value.id}/move`, null, {
      params: {
        folderId: moveTargetFolderId.value
      }
    })
    ElMessage.success('文件已移入目标文件夹')
    moveDialogVisible.value = false
    await loadFileList()
  } finally {
    movingFile.value = false
  }
}

watch(() => route.query.folderId, async () => {
  syncCurrentFolderFromRoute()
  currentPage.value = 1
  await loadFileList()
}, { immediate: true })

onMounted(async () => {
  syncCurrentFolderFromRoute()
  await loadFolderCatalog()
  loadTags()
  loadSidebarOrder()
})
</script>

<style scoped>
.dropbox-container {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--surface-solid);
}

.sub-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface-muted);
  border-right: 1px solid var(--border-color);
  padding: 32px 16px;
  overflow-y: auto;
}

.title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 24px;
  padding-left: 12px;
}

.nav-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 24px 0 12px 12px;
  text-transform: uppercase;
}

.nav-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 4px;
}

.nav-section-head .nav-label {
  flex: 1;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.mini-btn:hover {
  background: var(--surface-strong);
  color: var(--accent);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.nav-item[draggable='true'] {
  cursor: grab;
}

.nav-item.dragging {
  opacity: 0.45;
}

.tag-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 4px;
}

.nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--surface-strong);
}

.nav-item.active {
  background: #0061fe;
  color: #fff;
}

.nav-divider {
  height: 1px;
  background: var(--border-color);
  margin: 20px 12px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 36px 16px;
  overflow: hidden;
  min-height: 0;
}

/* 面包屑 / 搜索 / 上传按钮固定不动，只有文件列表区域滚动 */
.content-header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.breadcrumb-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.crumb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s ease;
}

.crumb-btn:hover {
  background: var(--accent-soft);
  color: #0061fe;
}

.crumb-btn.active {
  background: var(--accent-soft);
  color: #0061fe;
  font-weight: 600;
}

.search-input {
  max-width: 560px;
}

:deep(.search-input .el-input__wrapper) {
  background: var(--surface-muted);
  border-radius: 24px;
  box-shadow: none !important;
  border: 1px solid transparent;
}

:deep(.search-input .el-input__wrapper:hover) {
  border-color: #0061fe;
}

.action-grid {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.action-tile {
  width: 160px;
  height: 92px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  cursor: pointer;
  transition: 0.2s;
}

.action-tile.light {
  border: 1px solid #e6e9eb;
}

.action-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.file-list-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--surface-solid);
  padding: 4px 18px 0;
}

.file-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.file-name {
  line-height: 1.4;
}

/* 收藏星标 */
.star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.star-btn:hover {
  background: var(--surface-strong);
  color: #f7b955;
  transform: scale(1.1);
}

.star-btn.on {
  color: #f7b955;
}

/* 文件标签 chip */
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.6;
  white-space: nowrap;
}

/* 上传后打标签选择器 */
.upload-tag-select {
  width: 170px;
  flex-shrink: 0;
}

/* 标签管理弹窗 */
.tag-manage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tag-manage-row,
.tag-create-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-manage-row .el-input {
  flex: 1;
}

.tag-create-row {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.tag-create-row .el-input {
  flex: 1;
}

.tag-empty {
  padding: 12px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.tag-picker-row {
  padding: 2px 0;
}

.custom-table {
  --el-table-header-text-color: var(--text-secondary);
}

.premium-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

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
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(0, 97, 254, 0.08);
  color: #0061fe;
}

.action-btn.danger:hover {
  background: rgba(250, 75, 75, 0.08);
  color: #fa4b4b;
}

.more-btn {
  padding: 6px 8px;
}

.popover-action {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  border: none;
  background: transparent;
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.popover-action:hover {
  background: #eef4ff;
  color: #0061fe;
}

:deep(.el-table td.el-table__cell),
:deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: var(--surface-muted);
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  /* 负外边距把遮盖面撑满列表容器整个宽度与底边，行内容不会从边缘漏出 */
  margin: 6px -18px 0;
  padding: 18px 18px 16px;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: var(--surface-solid);
  border-radius: 0 0 13px 13px;
}

/* 分页条上方的渐隐遮罩：让被盖住的前一行以淡出方式收尾，而不是硬切 */
.pagination-container::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -28px;
  height: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--surface-solid) 78%);
  pointer-events: none;
}

.extract-code-line {
  margin-top: 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.share-copy-actions {
  margin-top: 8px;
}

:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: #0061fe;
}

.move-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.move-current-file {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-muted);
}

.move-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.root-folder-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: 0.2s ease;
}

.root-folder-card:hover,
.root-folder-card.active {
  border-color: #0061fe;
  background: #eef4ff;
  color: #0061fe;
}

.folder-tree-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
}

.folder-tree-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
