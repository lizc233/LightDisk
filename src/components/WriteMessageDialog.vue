<template>
  <el-dialog
    :model-value="modelValue"
    title="写私信"
    width="560px"
    append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)"
    @closed="handleClosed"
  >
    <el-form label-width="76px" @submit.prevent>
      <!-- 收件人：邮件式精确确认，不做模糊推荐 -->
      <el-form-item label="收件人" required>
        <div class="receiver-box">
          <div v-if="receivers.length" class="receiver-chips">
            <span v-for="r in receivers" :key="r.id" class="receiver-chip">
              {{ r.username }}<i class="chip-id">#{{ r.id }}</i>
              <el-tag v-if="r.isAdmin" size="small" type="warning" effect="plain">管理员</el-tag>
              <el-tag v-if="r.isContact" size="small" type="success" effect="plain">联系人</el-tag>
              <el-icon class="chip-remove" @click="removeReceiver(r.id)"><Close /></el-icon>
            </span>
          </div>
          <div class="receiver-input-row">
            <el-input
              v-model="receiverInput"
              placeholder="输入完整用户名 或 #用户ID（如 #123）"
              @keydown.enter.prevent="confirmReceiver"
            />
            <el-button :loading="checking" @click="confirmReceiver">确认存在</el-button>
          </div>
          <p class="field-hint">
            邮件式隐私保护：系统只在最终确认时校验该账号是否存在，不会列出相似用户。
            可添加多个收件人。
          </p>
        </div>
      </el-form-item>

      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" show-word-limit placeholder="一句话说明来意" />
      </el-form-item>

      <el-form-item label="内容" required>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="5"
          maxlength="2000"
          show-word-limit
          placeholder="正文内容"
        />
      </el-form-item>

      <!-- 附件：从我的网盘选择（附件转存/下载能力后续接入） -->
      <el-form-item label="附件">
        <div class="attach-box">
          <div v-if="attachments.length" class="attach-chips">
            <span v-for="att in attachments" :key="att.fileId" class="attach-chip">
              <el-icon><Document /></el-icon>
              {{ att.name }}（{{ formatSize(att.size) }}）
              <el-icon class="chip-remove" @click="removeAttachment(att.fileId)"><Close /></el-icon>
            </span>
          </div>
          <el-button size="small" :icon="FolderOpened" @click="openFilePicker">从我的文件选择</el-button>
          <span class="attach-hint">支持 pdf / 图片 / 视频 / zip 等，收件人后续可一键转存</span>
        </div>
      </el-form-item>

      <el-form-item v-if="!isAdmin">
        <el-checkbox v-model="form.autoAddContact">同时把这些用户加为我的联系人</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="sending" @click="handleSend">发送</el-button>
    </template>

    <!-- 文件选择弹窗 -->
    <el-dialog v-model="pickerVisible" title="从我的文件选择附件" width="560px" append-to-body>
      <el-table
        ref="pickerTableRef"
        v-loading="pickerLoading"
        :data="pickerFiles"
        max-height="360"
        @selection-change="handlePickerSelection"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="name" label="文件名" min-width="220" show-overflow-tooltip />
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.size) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!pickerSelection.length" @click="confirmPicker">
          添加所选（{{ pickerSelection.length }}）
        </el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Document, FolderOpened } from '@element-plus/icons-vue'
import { searchUsers } from '@/api/contact'
import { sendPersonalMessage } from '@/api/notification'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 预设收件人 { id, username }，从联系人/消息列表点「发私信」时带入 */
  preset: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'sent'])

const userStore = useUserStore()
const isAdmin = computed(() => Number(userStore.userInfo?.isAdmin || 0) === 1)
const myId = computed(() => Number(userStore.userInfo?.id || userStore.userInfo?.userId || 0))

const receivers = ref([])
const receiverInput = ref('')
const checking = ref(false)
const sending = ref(false)

const form = reactive({
  title: '',
  content: '',
  autoAddContact: true
})

// ===== 附件 =====
const attachments = ref([])
const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerFiles = ref([])
const pickerSelection = ref([])

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

async function openFilePicker() {
  pickerVisible.value = true
  pickerLoading.value = true
  pickerSelection.value = []
  try {
    const res = await request.post('/file/list', { pageNum: 1, pageSize: 50 })
    if (res && res.code === 1) {
      pickerFiles.value = res.data?.records || []
    }
  } catch (e) {
    pickerFiles.value = []
  } finally {
    pickerLoading.value = false
  }
}

function handlePickerSelection(rows) {
  pickerSelection.value = rows
}

function confirmPicker() {
  for (const f of pickerSelection.value) {
    if (!attachments.value.some((a) => a.fileId === f.id)) {
      attachments.value.push({
        fileId: f.id,
        name: f.name,
        size: Number(f.size || 0),
        type: f.ext || f.type || ''
      })
    }
  }
  pickerVisible.value = false
}

function removeAttachment(fileId) {
  attachments.value = attachments.value.filter((a) => a.fileId !== fileId)
}

// ===== 收件人（邮件式精确确认） =====
async function confirmReceiver() {
  const raw = (receiverInput.value || '').trim().replace(/^#/, '')
  if (!raw) {
    ElMessage.warning('请输入完整用户名或 #用户ID')
    return
  }
  if (myId.value && /^\d+$/.test(raw) && Number(raw) === myId.value) {
    ElMessage.warning('不能发送给自己')
    return
  }
  if (receivers.value.length >= 10) {
    ElMessage.warning('单条私信最多 10 个收件人')
    return
  }

  checking.value = true
  try {
    const res = await searchUsers(raw)
    const list = (res && res.code === 1 && res.data) || []
    if (!list.length) {
      ElMessage.error(`用户「${raw}」不存在，请检查拼写或 ID`)
      return
    }
    const u = list[0]
    if (receivers.value.some((r) => r.id === u.id)) {
      ElMessage.warning('该用户已在收件人列表中')
      return
    }
    receivers.value.push(u)
    receiverInput.value = ''
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    checking.value = false
  }
}

function removeReceiver(id) {
  receivers.value = receivers.value.filter((r) => r.id !== id)
}

/** 预设收件人（来自联系人/消息列表的「回信」入口）直接加入 */
function ensurePreset() {
  if (props.preset && props.preset.id && !receivers.value.some((r) => r.id === props.preset.id)) {
    receivers.value.push({
      id: props.preset.id,
      username: props.preset.username || `用户${props.preset.id}`,
      isAdmin: false,
      isContact: false
    })
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    ensurePreset()
  }
)

async function handleSend() {
  if (!receivers.value.length) {
    ElMessage.warning('请先添加收件人（输入后点「确认存在」）')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.warning('请填写内容')
    return
  }

  sending.value = true
  try {
    await sendPersonalMessage({
      receiverIds: receivers.value.map((r) => r.id).join(','),
      title: form.title.trim(),
      content: form.content.trim(),
      autoAddContact: !isAdmin.value && form.autoAddContact,
      attachments: attachments.value.length ? JSON.stringify(attachments.value) : undefined
    })
    ElMessage.success('私信已发送')
    emit('sent')
    emit('update:modelValue', false)
  } finally {
    sending.value = false
  }
}

function handleClosed() {
  receivers.value = []
  receiverInput.value = ''
  attachments.value = []
  form.title = ''
  form.content = ''
  form.autoAddContact = true
}
</script>

<style scoped>
.receiver-box {
  width: 100%;
}

.receiver-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.receiver-chip,
.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-muted);
  font-size: 13px;
  color: var(--text-primary);
}

.chip-id {
  font-style: normal;
  font-size: 12px;
  color: var(--text-muted);
}

.chip-remove {
  cursor: pointer;
  color: var(--text-muted);
}

.chip-remove:hover {
  color: var(--el-color-danger);
}

.receiver-input-row {
  display: flex;
  gap: 8px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.attach-box {
  width: 100%;
}

.attach-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.attach-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
