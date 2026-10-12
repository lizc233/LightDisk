<template>
  <div class="activity-page">
    <PageHeader
      eyebrow="Activity Log"
      title="我的操作记录"
      sub="仅自己可见：登录、文件、分享、私信等操作流水；管理员审计不包含私人文件与私信明细。"
    >
      <template #actions>
        <el-button size="small" text :icon="Refresh" @click="loadActivity()">刷新</el-button>
      </template>
    </PageHeader>

    <div class="content-card-box">
      <div class="toolbar">
        <el-select v-model="activityModule" size="small" style="width: 132px" @change="loadActivity(1)">
          <el-option label="全部模块" value="" />
          <el-option v-for="m in activityModules" :key="m" :label="m" :value="m" />
        </el-select>
        <span class="total-hint">共 {{ activityTotal }} 条</span>
      </div>

      <div v-loading="activityLoading" class="activity-timeline">
        <div v-for="log in activityList" :key="log.id" class="activity-row">
          <div class="activity-dot" :class="moduleClass(log.module)"></div>
          <div class="activity-body">
            <div class="activity-content">
              <span class="activity-module">{{ log.module }}</span>
              {{ log.content }}
            </div>
            <div class="activity-meta">
              {{ formatRelativeTime(log.createdAt) }}
              <span class="activity-absolute">{{ formatDateTime(log.createdAt) }}</span>
              <span v-if="log.ip" class="activity-ip">· {{ log.ip }}</span>
            </div>
          </div>
        </div>
        <div v-if="!activityLoading && !activityList.length" class="activity-empty">暂无操作记录</div>
      </div>

      <div class="activity-pager">
        <el-pagination
          v-model:current-page="activityPage"
          :page-size="activityPageSize"
          :total="activityTotal"
          layout="prev, pager, next"
          small
          @current-change="loadActivity()"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import request from '@/utils/request'
import PageHeader from '@/components/PageHeader.vue'
import { parseDateValue } from '@/utils/datetime'

const activityModules = ['账号', '文件', '回收站', '分享', '私信', '会员', '管理']
const activityModule = ref('')
const activityLoading = ref(false)
const activityList = ref([])
const activityTotal = ref(0)
const activityPage = ref(1)
const activityPageSize = 20

const formatDateTime = (value) => {
  const d = parseDateValue(value)
  if (!d) return ''
  const p = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const formatRelativeTime = (value) => {
  const date = parseDateValue(value)
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return formatDateTime(value)
}

const moduleClass = (module) => {
  const map = {
    账号: 'is-account',
    文件: 'is-file',
    回收站: 'is-recycle',
    分享: 'is-share',
    私信: 'is-message',
    会员: 'is-vip',
    管理: 'is-admin',
    审计: 'is-admin'
  }
  return map[module] || 'is-file'
}

const loadActivity = async (page) => {
  if (page) activityPage.value = page
  activityLoading.value = true
  try {
    const params = { page: activityPage.value, pageSize: activityPageSize }
    if (activityModule.value) params.module = activityModule.value
    const res = await request.get('/operation-log/mine', { params })
    activityList.value = res.data?.records || []
    activityTotal.value = Number(res.data?.total || 0)
  } catch (e) {
    /* 静默失败 */
  } finally {
    activityLoading.value = false
  }
}

onMounted(() => {
  loadActivity()
})
</script>

<style scoped>
.activity-page {
  max-width: 880px;
  margin: 0 auto;
}

.content-card-box {
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: var(--shadow-soft);
  padding: 20px 24px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.total-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.activity-timeline {
  position: relative;
  margin-top: 10px;
  padding-left: 18px;
  min-height: 200px;
}

.activity-timeline::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--border-color);
}

.activity-row {
  display: flex;
  gap: 12px;
  padding: 9px 0;
}

.activity-dot {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-top: 6px;
  background: var(--accent);
  position: relative;
  z-index: 1;
}

.activity-dot.is-account { background: #2563eb; }
.activity-dot.is-file { background: #14b8a6; }
.activity-dot.is-recycle { background: #f59e0b; }
.activity-dot.is-share { background: #8b5cf6; }
.activity-dot.is-message { background: #ec4899; }
.activity-dot.is-vip { background: #f7b955; }
.activity-dot.is-admin { background: #ef4444; }

.activity-body {
  min-width: 0;
}

.activity-content {
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-all;
}

.activity-module {
  display: inline-block;
  margin-right: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.activity-meta {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
}

.activity-absolute {
  margin-left: 8px;
  opacity: 0.75;
}

.activity-ip {
  margin-left: 6px;
}

.activity-empty {
  padding: 36px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.activity-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}
</style>
