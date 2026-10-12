<template>
  <el-dialog
    v-model="visible"
    :title="`预览：${fileName || 'Office 文档'}`"
    width="82%"
    top="4vh"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <!-- 旧版 .doc：后端解析结果 -->
    <template v-if="mode === 'doc'">
      <el-alert v-if="docError" :title="docError" type="warning" :closable="false" show-icon />
      <div v-else v-loading="loading" element-loading-text="正在解析旧版 Word 文档..." class="office-loading">
        <!-- POI 转出的 HTML 放在沙箱 iframe 里渲染：脚本被禁用，样式也不会污染主页面 -->
        <iframe v-if="docFormat === 'html'" :srcdoc="docHtml" sandbox="" class="office-frame"></iframe>
        <pre v-else-if="docFormat === 'text'" class="office-text">{{ docText }}</pre>
      </div>
    </template>

    <!-- docx（含后缀骗人的 .doc）：浏览器端 docx-preview 渲染 -->
    <div v-else v-loading="loading" element-loading-text="正在解析 Word 文档..." class="office-loading">
      <div v-show="!loading" ref="docxHost" class="docx-host"></div>
    </div>

    <p class="office-tip">{{ tipText }}</p>
  </el-dialog>
</template>

<script setup>
// Word 预览统一入口：
//   docx → 浏览器端 docx-preview 解析（OOXML 是 zip，前端能直接读）
//   doc  → 旧版 OLE2 二进制格式，浏览器读不了，由后端 POI HWPF 转 HTML/纯文本再渲染
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { renderAsync } from 'docx-preview'
import request from '@/utils/request'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fileId: { type: [Number, String], default: null },
  fileName: { type: String, default: '' },
  /** docx | doc */
  kind: { type: String, default: 'docx' }
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// mode: 'docx' 走前端渲染 / 'doc' 走后端解析
const mode = ref('docx')
const loading = ref(false)
const docxHost = ref(null)
const docFormat = ref('')
const docHtml = ref('')
const docText = ref('')
const docError = ref('')

const tipText = computed(() =>
  mode.value === 'doc'
    ? '旧版 .doc 为只读预览（后端解析后渲染）；文本类文件（txt/md/csv 等）支持在线编辑'
    : 'Word 为只读预览；文本类文件（txt/md/csv 等）支持在线编辑'
)

const getToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

watch(visible, (v) => {
  if (v && props.fileId) {
    reset()
    if (props.kind === 'doc') {
      loadDoc()
    } else {
      loadDocx()
    }
  }
})

const reset = () => {
  mode.value = props.kind === 'doc' ? 'doc' : 'docx'
  docFormat.value = ''
  docHtml.value = ''
  docText.value = ''
  docError.value = ''
}

// ============ docx：前端渲染 ============
const loadDocx = async () => {
  loading.value = true
  try {
    const blob = await fetchBlob()
    if (!blob) return
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

// ============ doc：后端 POI 解析 ============
const loadDoc = async () => {
  loading.value = true
  try {
    const res = await request.get(`/file/${props.fileId}/doc-preview`)
    const data = res.data || {}
    if (data.format === 'html') {
      docFormat.value = 'html'
      docHtml.value = data.html || ''
    } else if (data.format === 'text') {
      docFormat.value = 'text'
      docText.value = data.text || ''
    } else if (data.format === 'docx') {
      // 后缀写着 .doc，内容其实是 docx —— 改走前端渲染
      loading.value = false
      mode.value = 'docx'
      ElMessage.info(data.reason || '该文件实际为 .docx 格式，已按新版格式预览')
      await loadDocx()
    } else {
      docError.value = data.reason || '该 .doc 文件暂不支持在线预览，请下载后用 Word 打开'
    }
  } catch (e) {
    docError.value = e?.response?.data?.msg || '解析失败，请下载后用 Word 打开'
  } finally {
    loading.value = false
  }
}

// 统一 blob 获取（带 JSON 错误兜底）
const fetchBlob = async () => {
  const resp = await axios.get(`/api/file/preview/${props.fileId}`, {
    params: { token: getToken() },
    responseType: 'blob',
    timeout: 60000
  })
  const blob = resp.data
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
    return null
  }
  return blob
}
</script>

<style scoped>
.office-loading {
  min-height: 300px;
}
.office-frame {
  width: 100%;
  height: 74vh;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f0f2f5;
}
.office-text {
  height: 74vh;
  overflow: auto;
  margin: 0;
  padding: 20px 24px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Microsoft YaHei', SimSun, serif;
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
}
.docx-host {
  height: 74vh;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f0f2f5;
}
.office-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
  text-align: right;
}
</style>

<style>
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
