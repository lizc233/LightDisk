<template>
  <div class="admin-page">
    <section class="hero-card">
      <div>
        <p class="hero-eyebrow">Admin Console</p>
        <h1>数据大屏</h1>
        <p class="hero-desc">全站运营总览：用户增长、VIP 结构、存储占用。具体管理操作请使用左侧「后台管理」子菜单。</p>
      </div>
      <div class="hero-actions">
        <el-tag type="warning" effect="dark">管理员入口</el-tag>
        <el-button :loading="dashboardLoading" @click="loadDashboard">刷新数据</el-button>
      </div>
    </section>

    <section class="overview-grid">
      <article v-for="card in overviewCards" :key="card.key" class="metric-card">
        <p class="metric-label">{{ card.label }}</p>
        <div class="metric-value">{{ card.value }}</div>
        <p class="metric-hint">{{ card.hint }}</p>
      </article>
    </section>

    <section class="visual-grid">
      <article class="visual-card">
        <div class="card-head">
          <div>
            <h3>最近 7 天注册趋势</h3>
            <p>观察用户增长节奏，先看新增是不是稳定。</p>
          </div>
          <span class="head-tag">{{ registerTrendTotal }} 人</span>
        </div>

        <div class="trend-chart">
          <div
            v-for="item in registerTrend"
            :key="item.fullDate"
            class="trend-column"
          >
            <span class="trend-count">{{ item.count }}</span>
            <div class="trend-bar-shell">
              <div class="trend-bar" :style="{ height: `${calcTrendHeight(item.count)}%` }"></div>
            </div>
            <span class="trend-date">{{ item.date }}</span>
          </div>
        </div>
      </article>

      <article class="visual-card">
        <div class="card-head">
          <div>
            <h3>VIP 等级分布</h3>
            <p>先看普通用户、各级 VIP 的结构占比。</p>
          </div>
          <span class="head-tag">{{ vipUserTotal }} 人</span>
        </div>

        <div class="distribution-list">
          <div v-for="item in vipDistribution" :key="item.level" class="distribution-row">
            <div class="distribution-meta">
              <span>{{ item.levelName }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="distribution-bar-shell">
              <div class="distribution-bar" :style="{ width: `${calcVipPercent(item.count)}%` }"></div>
            </div>
          </div>
        </div>
      </article>

      <article class="visual-card full">
        <div class="card-head">
          <div>
            <h3>存储占用 Top 10</h3>
            <p>快速发现空间大户和异常占用账号。</p>
          </div>
          <span class="head-tag">按已用空间排序</span>
        </div>

        <div class="storage-list">
          <div v-for="item in storageTopUsers" :key="item.id" class="storage-row">
            <div class="storage-main">
              <div class="storage-user">
                <strong>{{ item.username }}</strong>
                <span>{{ item.levelName }}</span>
              </div>
              <div class="storage-values">{{ formatBytes(item.usedSpace) }} / {{ formatBytes(item.totalSpace) }}</div>
            </div>
            <div class="storage-bar-shell">
              <div class="storage-bar" :style="{ width: `${Math.min(Number(item.usageRate || 0), 100)}%` }"></div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import request from '@/utils/request'

const dashboardLoading = ref(false)

const overview = reactive({
  totalUsers: 0,
  newUsersToday: 0,
  activeVipUsers: 0,
  totalUsedSpace: 0,
  activeShareCount: 0,
  recycleExpiringCount: 0
})

const registerTrend = ref([])
const vipDistribution = ref([])
const storageTopUsers = ref([])

const registerTrendMax = computed(() => {
  const values = registerTrend.value.map(item => Number(item.count || 0))
  return Math.max(...values, 1)
})

const registerTrendTotal = computed(() => {
  return registerTrend.value.reduce((sum, item) => sum + Number(item.count || 0), 0)
})

const vipUserTotal = computed(() => {
  return vipDistribution.value.reduce((sum, item) => sum + Number(item.count || 0), 0)
})

const overviewCards = computed(() => [
  {
    key: 'totalUsers',
    label: '总用户数',
    value: overview.totalUsers,
    hint: '当前库中全部账号'
  },
  {
    key: 'newUsersToday',
    label: '今日新增',
    value: overview.newUsersToday,
    hint: '以注册时间按天统计'
  },
  {
    key: 'activeVipUsers',
    label: '有效 VIP',
    value: overview.activeVipUsers,
    hint: '只统计当前仍在有效期内'
  },
  {
    key: 'totalUsedSpace',
    label: '总已用存储',
    value: formatBytes(overview.totalUsedSpace),
    hint: '来自用户 used_space 汇总'
  },
  {
    key: 'activeShareCount',
    label: '有效分享数',
    value: overview.activeShareCount,
    hint: '状态正常且未过期'
  },
  {
    key: 'recycleExpiringCount',
    label: '回收站临期项',
    value: overview.recycleExpiringCount,
    hint: '3 天内将自动过期'
  }
])

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

const calcTrendHeight = (count) => {
  return Math.max((Number(count || 0) / registerTrendMax.value) * 100, Number(count || 0) > 0 ? 12 : 6)
}

const calcVipPercent = (count) => {
  return vipUserTotal.value > 0 ? (Number(count || 0) / vipUserTotal.value) * 100 : 0
}

const loadDashboard = async () => {
  dashboardLoading.value = true
  try {
    const res = await request.get('/admin/dashboard')
    const data = res.data || {}
    Object.assign(overview, data.overview || {})
    registerTrend.value = Array.isArray(data.registerTrend) ? data.registerTrend : []
    vipDistribution.value = Array.isArray(data.vipDistribution) ? data.vipDistribution : []
    storageTopUsers.value = Array.isArray(data.storageTopUsers) ? data.storageTopUsers : []
  } finally {
    dashboardLoading.value = false
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<style scoped>
@import './admin-shared.css';
</style>
