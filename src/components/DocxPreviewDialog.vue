<template>
  <el-dialog
    v-model="visible"
    :title="`预览：${fileName || 'Word 文档'}`"
    width="82%"
    top="4vh"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-loading="loading" element-loading-text="正在解析 Word 文档..." class="docx-loading">
      <div v-show="!loading" ref="docxHost" class="docx-host"></div>
    </div>
    <p class="docx-tip">Word 为只读预览；文本类文件（txt/md/csv 等）支持在线编辑</p>
  </el-dialog>
</template>

<script setup>
// docx 在线预览：浏览器原生渲染不了 docx，用 docx-preview（纯前端解析 OOXML）绘制
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { renderAsync } from 'docx-preview'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fileId: { type: [Number, String], default: null },
  fileName: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const loading = ref(false)
const docxHost = ref(null)

const getToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

watch(visible, (v) => {
  if (v && props.fileId) {
    loadDocx()
  }
})

const loadDocx = async () => {
  loading.value = true
  try {
    const resp = await axios.get(`/api/file/preview/${props.fileId}`, {
      params: { token: getToken() },
      responseType: 'blob',
      timeout: 60000
    })
    const blob = resp.data
    // 后端出错时会返回 JSON（Blob 包装），转文本检查一下
    if (blob && blob.type && blob.type.includes('application/json')) {
      const text = await blob.text()
      let msg = '预览失败'
      try {
        msg = JSON.parse(text).msg || msg
      } catch {
        /* 忽略解析失败 */
      }
      ElMessage.error(msg)
      visible.value = false
      return
    }
    await nextTick()
    if (!docxHost.value) return
    docxHost.value.innerHTML = ''
    await renderAsync(blob, docxHost.value, null, {
      className: 'docx-render',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      experimental: true,
      useBase64URL: true
    })
  } catch (e) {
    ElMessage.error('Word 预览失败，文件可能已损坏')
    visible.value = false
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.docx-loading {
  min-height: 300px;
}
.docx-host {
  height: 74vh;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f0f2f5;
}
.docx-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
  text-align: right;
}
</style>

<style>
/* docx-preview 渲染内容不受 scoped 限制，用全局选择器约束 */
.docx-host .docx-wrapper {
  background: #f0f2f5;
  padding: 16px 0;
  min-height: 100%;
  box-sizing: border-box;
}
.docx-host .docx-wrapper > section.docx {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  margin-bottom: 16px;
  background: #fff;
}
</style>
