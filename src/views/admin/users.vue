<template>
  <div class="admin-page">
    <section class="table-card">
      <div class="card-head">
        <div>
          <h3>用户管理</h3>
          <p>支持全量用户筛选、VIP 调整、账号启停{{ isSuperAdmin ? '；超级管理员可添加用户、调整身份' : '' }}。</p>
        </div>
        <el-button v-if="isSuperAdmin" type="primary" size="small" @click="openAddUser">+ 添加用户</el-button>
      </div>

      <div class="filter-grid">
        <el-input
          v-model="filters.keyword"
          placeholder="用户名 / 邮箱"
          clearable
          @keyup.enter="handleSearch"
        />
        <el-select v-model="filters.role" placeholder="VIP 等级" clearable>
          <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
        </el-select>
        <el-select v-model="filters.status" placeholder="账号状态" clearable>
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-select v-model="filters.isAdmin" placeholder="管理员身份" clearable>
          <el-option label="超级管理员" :value="2" />
          <el-option label="管理员" :value="1" />
          <el-option label="普通用户" :value="0" />
        </el-select>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" :loading="tableLoading" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table :data="tableRows" v-loading="tableLoading" class="user-table">
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <div class="user-name-line">
                <strong>{{ row.username }}</strong>
                <el-tag v-if="Number(row.isAdmin || 0) === 2" size="small" type="danger" effect="dark">超级管理员</el-tag>
                <el-tag v-else-if="Number(row.isAdmin || 0) === 1" size="small" type="warning" effect="dark">管理员</el-tag>
              </div>
              <span>ID: {{ row.id }}</span>
              <span>{{ row.email || '未绑定邮箱' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="VIP 等级" min-width="170">
          <template #default="{ row }">
            <div class="vip-cell">
              <el-tag :type="Number(row.role || 0) > 0 ? 'warning' : 'info'" effect="plain">
                {{ row.levelName }}
              </el-tag>
              <span>{{ row.vipExpireTime ? formatDateTime(row.vipExpireTime) : '未开通' }}</span>
              <span v-if="row.vipExpired" class="expired-text">已过期，按普通用户生效</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="空间使用" min-width="220">
          <template #default="{ row }">
            <div class="usage-cell">
              <div class="usage-text">{{ formatBytes(row.usedSpace) }} / {{ formatBytes(row.totalSpace) }}</div>
              <el-progress :percentage="Number(row.usageRate || 0)" :stroke-width="8" :show-text="false" />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="Number(row.status || 0) === 1 ? 'success' : 'danger'" effect="dark">
              {{ Number(row.status || 0) === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="注册时间" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openVipDialog(row)">调整 VIP</el-button>
              <el-button v-if="isSuperAdmin" link type="warning" @click="openRoleDialog(row)">设身份</el-button>
              <el-button
                link
                :type="Number(row.status || 0) === 1 ? 'danger' : 'success'"
                :loading="statusLoadingId === row.id"
                @click="handleToggleStatus(row)"
              >
                {{ Number(row.status || 0) === 1 ? '禁用账号' : '启用账号' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="pagination.total"
          :current-page="pagination.pageNum"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="vipDialogVisible" title="调整 VIP 等级" width="460px" destroy-on-close>
      <el-form :model="vipForm" label-position="top">
        <el-form-item label="目标用户">
          <el-input :model-value="vipTargetLabel" disabled />
        </el-form-item>
        <el-form-item label="目标等级">
          <el-select v-model="vipForm.role" style="width: 100%">
            <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
          </el-select>
        </el-form-item>
        <el-form-item label="续期天数">
          <el-input-number v-model="vipForm.durationDays" :min="1" :max="3650" :step="30" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vipDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="vipSaving" @click="handleSaveVip">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加用户（仅超级管理员） -->
    <el-dialog v-model="addUserDialogVisible" title="添加用户" width="460px" destroy-on-close>
      <el-form :model="addUserForm" label-position="top">
        <el-form-item label="用户名" required>
          <el-input v-model="addUserForm.username" maxlength="32" placeholder="2-32 位字母/数字/下划线/中文" />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input v-model="addUserForm.password" maxlength="20" show-password placeholder="6-20 位" />
        </el-form-item>
        <el-form-item label="邮箱（可选）">
          <el-input v-model="addUserForm.email" placeholder="选填" />
        </el-form-item>
        <el-form-item label="VIP 等级">
          <el-select v-model="addUserForm.vipRole" style="width: 100%">
            <el-option v-for="item in vipOptions" :key="item.level" :label="item.levelName" :value="item.level" />
          </el-select>
        </el-form-item>
        <el-form-item label="身份">
          <el-radio-group v-model="addUserForm.isAdmin">
            <el-radio :value="0">普通用户</el-radio>
            <el-radio :value="1">管理员</el-radio>
            <el-radio :value="2">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addUserDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addUserSaving" @click="handleAddUser">创建</el-button>
      </template>
    </el-dialog>

    <!-- 修改身份（仅超级管理员） -->
    <el-dialog v-model="roleDialogVisible" title="修改用户身份" width="440px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="目标用户">
          <el-input :model-value="roleTargetLabel" disabled />
        </el-form-item>
        <el-form-item label="身份">
          <el-radio-group v-model="roleForm.isAdmin">
            <el-radio :value="0">普通用户</el-radio>
            <el-radio :value="1">管理员（发通知/查数据/调VIP）</el-radio>
            <el-radio :value="2">超级管理员（可添加用户/改身份）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSaving" @click="handleSaveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { useUserStore } from '@/stores/user'
import { formatDateTime } from '@/utils/datetime'
import { adminAddUser, adminUpdateUserRole } from '@/api/adminManage'

const userStore = useUserStore()
// 0-普通用户 1-管理员 2-超级管理员；只有超级管理员可添加用户/修改身份
const isSuperAdmin = computed(() => Number(userStore.userInfo?.isAdmin || 0) >= 2)

const tableLoading = ref(false)
const vipSaving = ref(false)
const statusLoadingId = ref(null)
const vipDialogVisible = ref(false)

const vipOptions = ref([])
const tableRows = ref([])

const filters = reactive({
  keyword: '',
  role: null,
  status: null,
  isAdmin: null
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

const vipForm = reactive({
  userId: null,
  role: 0,
  durationDays: 365
})

const vipTargetLabel = computed(() => {
  const target = tableRows.value.find(item => item.id === vipForm.userId)
  if (!target) return ''
  return `${target.username}（当前 ${target.levelName}）`
})

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(bytes >= 100 * 1024 ** 3 ? 0 : 2)} GB`
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${bytes} B`
}

const loadUsers = async () => {
  tableLoading.value = true
  try {
    const res = await request.post('/admin/users/page', {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      keyword: filters.keyword || null,
      role: filters.role,
      status: filters.status,
      isAdmin: filters.isAdmin
    })
    tableRows.value = Array.isArray(res.data?.list) ? res.data.list : []
    pagination.total = Number(res.data?.total || 0)
    vipOptions.value = Array.isArray(res.data?.vipOptions) && res.data.vipOptions.length
      ? res.data.vipOptions
      : vipOptions.value
  } finally {
    tableLoading.value = false
  }
}

const handleSearch = async () => {
  pagination.pageNum = 1
  await loadUsers()
}

const resetFilters = async () => {
  filters.keyword = ''
  filters.role = null
  filters.status = null
  filters.isAdmin = null
  pagination.pageNum = 1
  await loadUsers()
}

const handlePageChange = async (page) => {
  pagination.pageNum = page
  await loadUsers()
}

const handleSizeChange = async (size) => {
  pagination.pageSize = size
  pagination.pageNum = 1
  await loadUsers()
}

const openVipDialog = (row) => {
  vipForm.userId = row.id
  vipForm.role = Number(row.role || 0)
  vipForm.durationDays = 365
  vipDialogVisible.value = true
}

const handleSaveVip = async () => {
  if (!vipForm.userId && vipForm.userId !== 0) {
    ElMessage.warning('未选择目标用户')
    return
  }
  vipSaving.value = true
  try {
    await request.post('/admin/users/vip/update', {
      userId: vipForm.userId,
      role: vipForm.role,
      durationDays: vipForm.durationDays
    })
    ElMessage.success('VIP 等级已更新')
    vipDialogVisible.value = false
    await loadUsers()
  } finally {
    vipSaving.value = false
  }
}

const handleToggleStatus = async (row) => {
  const nextStatus = Number(row.status || 0) === 1 ? 0 : 1
  const actionText = nextStatus === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确认${actionText}账号「${row.username}」吗？`, '账号状态调整', {
      type: nextStatus === 1 ? 'success' : 'warning'
    })
  } catch (error) {
    return
  }

  statusLoadingId.value = row.id
  try {
    await request.post('/admin/users/status/update', {
      userId: row.id,
      status: nextStatus
    })
    ElMessage.success(`账号已${actionText}`)
    await loadUsers()
  } finally {
    statusLoadingId.value = null
  }
}

// ===== 添加用户 / 修改身份（仅超级管理员） =====
const addUserDialogVisible = ref(false)
const addUserSaving = ref(false)
const addUserForm = reactive({ username: '', password: '', email: '', vipRole: 0, isAdmin: 0 })

const openAddUser = () => {
  Object.assign(addUserForm, { username: '', password: '', email: '', vipRole: 0, isAdmin: 0 })
  addUserDialogVisible.value = true
}

const handleAddUser = async () => {
  if (!addUserForm.username.trim() || !addUserForm.password) {
    ElMessage.warning('请填写用户名和初始密码')
    return
  }
  addUserSaving.value = true
  try {
    await adminAddUser({ ...addUserForm, username: addUserForm.username.trim() })
    ElMessage.success('用户已创建')
    addUserDialogVisible.value = false
    loadUsers()
  } finally {
    addUserSaving.value = false
  }
}

const roleDialogVisible = ref(false)
const roleSaving = ref(false)
const roleForm = reactive({ userId: null, username: '', isAdmin: 0 })

const roleTargetLabel = computed(() => {
  const target = tableRows.value.find(item => item.id === roleForm.userId)
  return target ? `${target.username}（# ${target.id}）` : roleForm.username
})

const openRoleDialog = (row) => {
  Object.assign(roleForm, { userId: row.id, username: row.username, isAdmin: Number(row.isAdmin || 0) })
  roleDialogVisible.value = true
}

const handleSaveRole = async () => {
  roleSaving.value = true
  try {
    await adminUpdateUserRole({ userId: roleForm.userId, isAdmin: roleForm.isAdmin })
    ElMessage.success('身份已更新')
    roleDialogVisible.value = false
    loadUsers()
  } finally {
    roleSaving.value = false
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
@import './admin-shared.css';
</style>
