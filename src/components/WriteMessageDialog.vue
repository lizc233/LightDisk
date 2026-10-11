<template>
  <el-dialog
    :model-value="modelValue"
    title="写私信"
    width="520px"
    append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)"
    @closed="handleClosed"
  >
    <el-form label-width="76px" @submit.prevent>
      <el-form-item label="收件人" required>
        <el-select
          v-model="selectedIds"
          multiple
          filterable
          remote
          reserve-keyword
          :remote-method="handleSearch"
          :loading="searching"
          placeholder="输入用户 ID 或用户名搜索"
          style="width: 100%"
        >
          <el-option v-for="u in options" :key="u.id" :label="optionLabel(u)" :value="u.id">
            <span class="opt-name">{{ optionLabel(u) }}</span>
            <span class="opt-id">#{{ u.id }}</span>
            <el-tag v-if="u.isAdmin" size="small" type="warning" effect="plain">管理员</el-tag>
            <el-tag v-if="u.isContact" size="small" type="success" effect="plain">联系人</el-tag>
            <el-tag v-if="u.isBlocked" size="small" type="danger" effect="plain">已拉黑</el-tag>
          </el-option>
        </el-select>
        <p class="field-hint">按 ID 精确搜索或按用户名模糊搜索，最多返回 10 条，可多选</p>
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

      <el-form-item v-if="!isAdmin">
        <el-checkbox v-model="form.autoAddContact">同时把这些用户加为我的联系人</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="sending" @click="handleSend">发送</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { searchUsers } from '@/api/contact'
import { sendPersonalMessage } from '@/api/notification'
import { useUserStore } from '@/stores/user'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 预设收件人 { id, username }，从联系人/消息列表点「发私信」时带入 */
  preset: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'sent'])

const userStore = useUserStore()
const isAdmin = computed(() => Number(userStore.userInfo?.isAdmin || 0) === 1)

const options = ref([])
const selectedIds = ref([])
const searching = ref(false)
const sending = ref(false)

const form = reactive({
  title: '',
  content: '',
  autoAddContact: true
})

function optionLabel(u) {
  if (u.remark && u.remark !== u.username) {
    return `${u.remark}（${u.username}）`
  }
  return u.username
}

async function handleSearch(keyword) {
  const kw = (keyword || '').trim()
  if (!kw) {
    options.value = []
    return
  }
  searching.value = true
  try {
    const res = await searchUsers(kw)
    if (res && res.code === 1) {
      options.value = res.data || []
    }
  } catch (e) {
    options.value = []
  } finally {
    searching.value = false
  }
}

/** 确保预设/已选收件人仍在选项中，否则标签会显示为纯 ID */
function ensurePresetOptions() {
  const merged = new Map(options.value.map((u) => [u.id, u]))
  if (props.preset && props.preset.id) {
    if (!merged.has(props.preset.id)) {
      merged.set(props.preset.id, {
        id: props.preset.id,
        username: props.preset.username || `用户${props.preset.id}`,
        isContact: false,
        isBlocked: false
      })
    }
  }
  options.value = Array.from(merged.values())
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    ensurePresetOptions()
    if (props.preset && props.preset.id) {
      if (!selectedIds.value.includes(props.preset.id)) {
        selectedIds.value = [props.preset.id]
      }
    }
  }
)

async function handleSend() {
  if (!selectedIds.value.length) {
    ElMessage.warning('请先选择收件人')
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
      receiverIds: selectedIds.value.join(','),
      title: form.title.trim(),
      content: form.content.trim(),
      autoAddContact: !isAdmin.value && form.autoAddContact
    })
    ElMessage.success('私信已发送')
    emit('sent')
    emit('update:modelValue', false)
  } finally {
    sending.value = false
  }
}

function handleClosed() {
  selectedIds.value = []
  options.value = []
  form.title = ''
  form.content = ''
  form.autoAddContact = true
}
</script>

<style scoped>
.opt-name {
  margin-right: 8px;
}
.opt-id {
  color: var(--text-muted);
  font-size: 12px;
  margin-right: 8px;
}
.opt-id ~ .el-tag {
  margin-left: 4px;
}
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
