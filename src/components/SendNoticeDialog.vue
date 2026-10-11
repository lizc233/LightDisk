<template>
  <el-dialog v-model="visible" title="发送通知" width="560px" destroy-on-close @closed="resetForm">
    <p class="notice-tip">
      以管理员身份向指定范围推送系统通知（进入用户「私信中心-收件箱」并计入未读红点）。
    </p>

    <el-form :model="form" label-width="90px">
      <el-form-item label="通知类型">
        <el-radio-group v-model="form.type">
          <el-radio :value="1">公告（侧边栏轮播）</el-radio>
          <el-radio :value="2">系统通知（铃铛）</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="发送对象">
        <el-select v-model="form.targetType" style="width: 100%" @change="onTargetChange">
          <el-option :value="0" label="全部用户" />
          <el-option :value="2" label="指定 VIP 等级的用户" />
          <el-option :value="1" label="指定用户（可多选，模糊搜索）" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.targetType === 2" label="VIP 等级">
        <el-select
          v-model="form.targetLevels"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择要通知的等级"
          style="width: 100%"
        >
          <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
        </el-select>
        <p class="field-tip">VIP 已过期的用户会按「普通用户」收到对应通知</p>
      </el-form-item>

      <el-form-item v-if="form.targetType === 1" label="目标用户">
        <el-select
          v-model="form.targetUserIds"
          multiple
          filterable
          remote
          reserve-keyword
          :remote-method="searchUsers"
          :loading="searching"
          placeholder="输入用户名或邮箱搜索（支持模糊）"
          style="width: 100%"
        >
          <el-option
            v-for="u in userOptions"
            :key="u.id"
            :label="`${u.username}（#${u.id}${u.adminRole >= 1 ? ' · 管理员' : ''}）`"
            :value="u.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" show-word-limit placeholder="通知标题" />
      </el-form-item>

      <el-form-item label="内容" required>
        <el-input v-model="form.content" type="textarea" :rows="5" placeholder="支持 HTML 内容" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">发送</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createAnnouncement } from '@/api/notification'
import { adminSearchUsers, getAdminVipOptions } from '@/api/adminManage'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'sent'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const form = reactive({
  type: 2,
  targetType: 0,
  targetLevels: [],
  targetUserIds: [],
  title: '',
  content: ''
})
const saving = ref(false)
const searching = ref(false)
const vipOptions = ref([])
const userOptions = ref([])

watch(visible, (v) => {
  if (v && !vipOptions.value.length) {
    loadVipOptions()
  }
})

const loadVipOptions = async () => {
  try {
    const res = await getAdminVipOptions()
    vipOptions.value = res.data || []
  } catch (e) {
    vipOptions.value = []
  }
}

const onTargetChange = () => {
  form.targetLevels = []
  form.targetUserIds = []
  userOptions.value = []
}

const searchUsers = async (kw) => {
  if (!kw || !kw.trim()) {
    userOptions.value = []
    return
  }
  searching.value = true
  try {
    const res = await adminSearchUsers(kw.trim())
    userOptions.value = res.data || []
  } catch (e) {
    userOptions.value = []
  } finally {
    searching.value = false
  }
}

const resetForm = () => {
  form.type = 2
  form.targetType = 0
  form.targetLevels = []
  form.targetUserIds = []
  form.title = ''
  form.content = ''
  userOptions.value = []
}

const submit = async () => {
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  if (form.targetType === 1 && !form.targetUserIds.length) {
    ElMessage.warning('请选择目标用户')
    return
  }
  if (form.targetType === 2 && !form.targetLevels.length) {
    ElMessage.warning('请选择 VIP 等级')
    return
  }

  const payload = {
    type: form.type,
    title: form.title.trim(),
    content: form.content.trim(),
    targetType: form.targetType,
    status: 1
  }
  if (form.targetType === 1) {
    payload.targetIds = form.targetUserIds.join(',')
  } else if (form.targetType === 2) {
    payload.targetIds = form.targetLevels.join(',')
  }

  saving.value = true
  try {
    await createAnnouncement(payload)
    ElMessage.success('通知已发送')
    visible.value = false
    emit('sent')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.notice-tip {
  margin: 0 0 14px;
  padding: 8px 12px;
  background: #f0f9eb;
  border-radius: 6px;
  color: #67c23a;
  font-size: 12px;
  line-height: 1.6;
}
.field-tip {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}
</style>
