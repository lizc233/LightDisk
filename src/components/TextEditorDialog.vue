<template>
  <el-dialog
    v-model="visible"
    :title="`编辑 - ${fileName || '文本文件'}`"
    width="72%"
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

      <div ref="editorHost" class="editor-host" :class="{ readonly: !editable }"></div>

      <p class="editor-meta">
        <span v-if="dirty" class="dirty-flag">● 有未保存修改</span>
        <span v-else class="clean-flag">已与服务器同步</span>
        <span class="meta-right">MD5: {{ shortMd5 }}　保存采用「写时复制」，不会影响分享出去的同内容文件</span>
      </p>
    </template>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="saving" :disabled="!editable || !dirty" @click="handleSave">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
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
const dirty = ref(false)
const baseMd5 = ref('')
const editorHost = ref(null)

let editorView = null

const shortMd5 = computed(() => (baseMd5.value ? baseMd5.value.slice(0, 8) : '-'))

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
      baseMd5: baseMd5.value
    })
    baseMd5.value = res.data || baseMd5.value
    dirty.value = false
    ElMessage.success('保存成功')
    emit('saved')
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-loading {
  height: 420px;
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
</style>
