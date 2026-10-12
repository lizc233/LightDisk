<template>
  <el-dialog
    v-model="visible"
    :title="`${editorTitle} - ${fileName || '文本文件'}`"
    width="78%"
    top="6vh"
    destroy-on-close
    :close-on-click-modal="false"
    @closed="destroyEditor"
  >
    <div v-if="loading" v-loading="true" class="editor-loading"></div>

    <template v-else>
      <div v-if="!editable" class="editor-readonly-tip">
        <el-alert :title="reason || '该文件不支持在线编辑，仅提供只读查看'" type="warning" :closable="false" show-icon />
      </div>

      <!-- P3：Markdown 左写右预览分栏 -->
      <div class="editor-body" :class="{ split: isMarkdown && showPreview }">
        <div ref="editorHost" class="editor-host" :class="{ readonly: !editable }"></div>
        <div v-if="isMarkdown && showPreview" class="md-preview md-preview-scope" v-html="previewHtml"></div>
      </div>

      <p class="editor-meta">
        <span v-if="dirty" class="dirty-flag">● 有未保存修改</span>
        <span v-else class="clean-flag">已与服务器同步</span>
        <span class="meta-right">
          <el-switch
            v-if="isMarkdown"
            v-model="showPreview"
            size="small"
            active-text="预览"
            style="margin-right: 14px"
          />
          MD5: {{ shortMd5 }}　保存采用「写时复制」，不会影响分享出去的同内容文件
        </span>
      </p>
    </template>

    <template #footer>
      <el-button @click="openVersions">历史版本</el-button>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="saving" :disabled="!editable || !dirty" @click="handleSave">
        保存
      </el-button>
    </template>

    <!-- P2：历史版本抽屉 -->
    <el-drawer v-model="versionDrawer" title="历史版本" size="480px" append-to-body>
      <div v-loading="versionLoading" class="version-list">
        <el-empty v-if="!versionLoading && versions.length === 0" description="还没有历史版本，保存一次就会生成" />
        <div v-for="item in versions" :key="item.id" class="version-item">
          <div class="version-head">
            <span class="version-no">v{{ item.version }}</span>
            <el-tag v-if="item.current" type="success" size="small">当前</el-tag>
            <el-tag :type="editorTagType(item.editorType)" size="small" effect="plain">
              {{ item.editorTypeName }}
            </el-tag>
            <span class="version-time">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div class="version-info">
            <span>{{ item.fileSize }} 字节</span>
            <span class="version-md5">md5: {{ (item.fileMd5 || '').slice(0, 10) }}</span>
          </div>
          <div class="version-actions">
            <el-button size="small" @click="previewVersion(item)">预览</el-button>
            <el-button
              size="small"
              type="primary"
              plain
              :disabled="item.current"
              @click="handleRollback(item)"
            >
              回滚到此版本
            </el-button>
          </div>

          <div v-if="previewing && previewVersionId === item.id" class="version-preview">
            <div v-if="previewLoading" v-loading="true" class="preview-loading"></div>
            <pre v-else class="preview-pre">{{ previewContent }}</pre>
          </div>
        </div>
      </div>
    </el-drawer>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { renderMarkdown } from '@/utils/markdown'
import request from '@/utils/request'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fileId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const loading = ref(false)
const saving = ref(false)
const editable = ref(false)
const reason = ref('')
const fileName = ref('')
const fileExt = ref('')
const dirty = ref(false)
const baseMd5 = ref('')
const editorHost = ref(null)

// P3 分栏预览
const showPreview = ref(true)
const isMarkdown = computed(() => ['md', 'markdown'].includes(fileExt.value))
const previewHtml = computed(() => renderMarkdown(currentText()))

// P2 历史版本
const versionDrawer = ref(false)
const versionLoading = ref(false)
const versions = ref([])
const previewing = ref(false)
const previewVersionId = ref(null)
const previewLoading = ref(false)
const previewContent = ref('')

let editorView = null

const shortMd5 = computed(() => (baseMd5.value ? baseMd5.value.slice(0, 8) : '-'))
const editorTitle = computed(() => (editable.value ? '编辑' : '查看'))

const currentText = () => (editorView ? editorView.state.doc.toString() : '')

const langExtension = (ext) => {
  if (ext === 'md' || ext === 'markdown') return markdown()
  if (ext === 'json') return json()
  return []
}

watch(visible, (v) => {
  if (v && props.fileId) {
    loadContent()
  }
})

const loadContent = async () => {
  loading.value = true
  dirty.value = false
  try {
    const res = await request.get(`/file/${props.fileId}/content`)
    const data = res.data || {}
    fileName.value = data.fileName || ''
    editable.value = Boolean(data.editable)
    reason.value = data.reason || ''
    baseMd5.value = data.md5 || ''
    fileExt.value = data.ext || ''
    // 关键：先关掉 loading 让 v-else 里的 editor-host 真正挂载，再创建 CodeMirror，
    // 否则 editorHost 还是 null，编辑器根本不会创建（表现为打开后一片空白）
    loading.value = false
    await nextTick()
    createEditor(data.content || '', editable.value, data.ext || '')
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '读取文件内容失败')
    visible.value = false
  } finally {
    loading.value = false
  }
}

const createEditor = (content, isEditable, ext) => {
  destroyEditor()
  if (!editorHost.value) return
  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged) dirty.value = true
  })
  editorView = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: [basicSetup, langExtension(ext), updateListener, EditorView.editable.of(isEditable)]
    }),
    parent: editorHost.value
  })
}

const destroyEditor = () => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
}

const handleSave = async () => {
  if (!editorView) return
  saving.value = true
  try {
    const content = editorView.state.doc.toString()
    const res = await request.put(`/file/${props.fileId}/content`, {
      content,
      baseMd5: baseMd5.value,
      editorType: 0
    })
    baseMd5.value = res.data || baseMd5.value
    dirty.value = false
    ElMessage.success('保存成功，已生成历史版本')
    emit('saved')
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

// ==================== P2 历史版本 ====================

const openVersions = () => {
  versionDrawer.value = true
  previewing.value = false
  fetchVersions()
}

const fetchVersions = async () => {
  versionLoading.value = true
  try {
    const res = await request.get(`/file/${props.fileId}/versions`)
    versions.value = res.data || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '获取历史版本失败')
  } finally {
    versionLoading.value = false
  }
}

const previewVersion = async (item) => {
  if (previewing.value && previewVersionId.value === item.id) {
    previewing.value = false
    previewVersionId.value = null
    return
  }
  previewing.value = true
  previewVersionId.value = item.id
  previewLoading.value = true
  previewContent.value = ''
  try {
    const res = await request.get(`/file/${props.fileId}/versions/${item.id}/content`)
    const data = res.data || {}
    previewContent.value = data.editable ? data.content || '' : `（${data.reason || '该版本不支持预览'}）`
  } catch (e) {
    previewing.value = false
    ElMessage.error(e?.response?.data?.msg || '读取版本内容失败')
  } finally {
    previewLoading.value = false
  }
}

const handleRollback = async (item) => {
  const tip = dirty.value
    ? '当前有未保存的修改，回滚会丢弃这些修改（修改前的内容仍会存为历史版本）。确定回滚？'
    : `确定回滚到 v${item.version}？当前内容会先存为新版本，随时可以再滚回来。`
  try {
    await ElMessageBox.confirm(tip, '回滚确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await request.post(`/file/${props.fileId}/versions/${item.id}/rollback`)
    baseMd5.value = res.data || baseMd5.value
    dirty.value = false
    ElMessage.success(`已回滚到 v${item.version}`)
    emit('saved')
    // 用回滚后的内容刷新编辑器 + 版本列表
    const contentRes = await request.get(`/file/${props.fileId}/content`)
    const data = contentRes.data || {}
    baseMd5.value = data.md5 || baseMd5.value
    await nextTick()
    createEditor(data.content || '', editable.value, data.ext || fileExt.value)
    fetchVersions()
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '回滚失败')
  }
}

const editorTagType = (type) => {
  if (type === 1) return 'warning'
  if (type === 2) return 'info'
  return 'primary'
}

const formatTime = (t) => {
  if (!t) return '-'
  if (Array.isArray(t)) {
    const [y, mo, d, h, mi, s] = t
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  }
  return String(t).replace('T', ' ').slice(0, 16)
}
</script>

<style scoped>
.editor-loading {
  height: 420px;
}
.editor-body {
  display: flex;
  flex-direction: column;
}
.editor-body.split {
  flex-direction: row;
  gap: 12px;
}
.editor-body.split .editor-host {
  flex: 1;
  min-width: 0;
}
.editor-host {
  height: 62vh;
  overflow: auto;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 8px;
  background: #fff;
}
.editor-host :deep(.cm-editor) {
  height: 100%;
  font-size: 13px;
}
.editor-host :deep(.cm-gutters) {
  background: #f7f8fa;
  border-right: 1px solid #ebeef5;
}
.editor-host.readonly {
  opacity: 0.85;
}
.md-preview {
  flex: 1;
  min-width: 0;
  height: 62vh;
  overflow: auto;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 8px;
  background: #fff;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
  word-break: break-word;
}
.editor-readonly-tip {
  margin-bottom: 10px;
}
.editor-meta {
  display: flex;
  justify-content: space-between;
  margin: 10px 0 0;
  font-size: 12px;
  color: #909399;
}
.dirty-flag {
  color: #e6a23c;
  font-weight: 600;
}
.clean-flag {
  color: #67c23a;
}
.meta-right {
  text-align: right;
}

/* 历史版本抽屉 */
.version-list {
  min-height: 200px;
}
.version-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.version-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.version-no {
  font-weight: 700;
  color: #303133;
}
.version-time {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}
.version-info {
  display: flex;
  gap: 14px;
  margin: 6px 0 8px;
  font-size: 12px;
  color: #909399;
}
.version-actions {
  display: flex;
  gap: 8px;
}
.version-preview {
  margin-top: 8px;
  border-top: 1px dashed #ebeef5;
  padding-top: 8px;
}
.preview-loading {
  height: 80px;
}
.preview-pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f7f8fa;
  border-radius: 6px;
  padding: 8px 10px;
  color: #303133;
}
</style>

<!-- Markdown 预览内部样式：v-html 内容不受 scoped 限制，用全局选择器约束在容器内 -->
<style>
.md-preview-scope h1.md-h,
.md-preview-scope h2.md-h {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 6px;
}
.md-preview-scope .md-h {
  margin: 14px 0 8px;
}
.md-preview-scope p {
  margin: 6px 0;
}
.md-preview-scope ul,
.md-preview-scope ol {
  padding-left: 22px;
  margin: 6px 0;
}
.md-preview-scope .md-quote {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid #dcdfe6;
  color: #606266;
  background: #fafafa;
}
.md-preview-scope .md-code {
  background: #f7f8fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px;
  overflow: auto;
  font-size: 12px;
}
.md-preview-scope .md-inline-code {
  background: #f2f3f5;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 13px;
  color: #c7254e;
}
.md-preview-scope .md-hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 12px 0;
}
.md-preview-scope a {
  color: #409eff;
}
</style>
