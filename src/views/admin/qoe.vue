<template>
  <div class="qoe-page">
    <div class="qoe-head">
      <div>
        <h2>播放质量看板</h2>
        <p>基于前端埋点的 QoE 指标：首帧耗时、卡顿率、码率与清晰度分布，用于定位播放体验问题。</p>
      </div>
      <div class="qoe-head-actions">
        <el-radio-group v-model="days" size="small" @change="loadAll()">
          <el-radio-button :value="1">今日</el-radio-button>
          <el-radio-button :value="7">近 7 天</el-radio-button>
          <el-radio-button :value="30">近 30 天</el-radio-button>
        </el-radio-group>
        <el-button size="small" :icon="Refresh" :loading="loading" @click="loadAll()">刷新</el-button>
      </div>
    </div>

    <!-- 转码队列概览 -->
    <div class="qoe-transcode" v-loading="overviewLoading">
      <div class="tc-item">
        <span class="tc-label">转码队列</span>
        <span class="tc-badge is-queue">{{ overview.queued || 0 }}</span>
      </div>
      <div class="tc-item">
        <span class="tc-label">进行中</span>
        <span class="tc-badge is-running">{{ overview.running || 0 }}</span>
      </div>
      <div class="tc-item">
        <span class="tc-label">已完成</span>
        <span class="tc-badge is-done">{{ overview.done || 0 }}</span>
      </div>
      <div class="tc-item">
        <span class="tc-label">失败</span>
        <span class="tc-badge is-failed">{{ overview.failed || 0 }}</span>
      </div>
      <div class="tc-item tc-spacer">
        <span class="tc-hint">并发上限 {{ overview.maxConcurrent || '-' }} · 转码{{ overview.enabled ? '已启用' : '已停用' }}</span>
      </div>
    </div>

    <!-- 核心指标卡 -->
    <div class="qoe-cards" v-loading="loading">
      <div class="qoe-card">
        <span class="qc-label">首帧耗时 P50</span>
        <span class="qc-value">{{ data.startupP50 || 0 }}<small>ms</small></span>
        <span class="qc-sub">P95 {{ data.startupP95 || 0 }}ms · 均值 {{ data.avgStartup || 0 }}ms</span>
      </div>
      <div class="qoe-card" :class="stallClass">
        <span class="qc-label">卡顿率</span>
        <span class="qc-value">{{ toPercent(data.stallRate) }}<small>%</small></span>
        <span class="qc-sub">平均卡顿占比 {{ toPercent(data.avgRebufferRatio) }}%</span>
      </div>
      <div class="qoe-card">
        <span class="qc-label">平均码率</span>
        <span class="qc-value">{{ formatMbps(data.avgBitrate) }}<small>Mbps</small></span>
        <span class="qc-sub">清晰度覆盖 {{ qualityCount }} 档</span>
      </div>
      <div class="qoe-card">
        <span class="qc-label">播放会话</span>
        <span class="qc-value">{{ data.totalSessions || 0 }}</span>
        <span class="qc-sub">{{ data.uniqueViewers || 0 }} 位用户 · 共 {{ data.totalWatchMinutes || 0 }} 分钟</span>
      </div>
    </div>

    <div class="qoe-grid">
      <!-- 每日趋势 -->
      <section class="qoe-panel">
        <h3>每日趋势</h3>
        <div v-if="!trend.length" class="qoe-empty">暂无数据</div>
        <div v-else class="trend-list">
          <div v-for="item in trend" :key="item.date" class="trend-row">
            <span class="trend-date">{{ item.date.slice(5) }}</span>
            <div class="trend-bar-box">
              <div
                class="trend-bar"
                :style="{ width: trendWidth(item.sessions) + '%' }"
                :title="`${item.sessions} 次播放`"
              ></div>
            </div>
            <span class="trend-val">{{ item.sessions }} 次</span>
            <span class="trend-meta">首帧 {{ item.avgStartup }}ms · 卡顿 {{ toPercent(item.stallRate) }}%</span>
          </div>
        </div>
      </section>

      <!-- 清晰度分布 -->
      <section class="qoe-panel">
        <h3>清晰度分布</h3>
        <div v-if="!qualityDist.length" class="qoe-empty">暂无数据</div>
        <div v-else class="dist-list">
          <div v-for="item in qualityDist" :key="item.name" class="dist-row">
            <span class="dist-name">{{ item.name }}</span>
            <div class="dist-bar-box">
              <div class="dist-bar" :style="{ width: item.percent + '%' }"></div>
            </div>
            <span class="dist-val">{{ item.count }}（{{ item.percent }}%）</span>
          </div>
        </div>
        <h3 class="mt">播放方式</h3>
        <div v-if="!typeDist.length" class="qoe-empty">暂无数据</div>
        <div v-else class="dist-list">
          <div v-for="item in typeDist" :key="item.name" class="dist-row">
            <span class="dist-name">{{ item.name === 'hls' ? '多清晰度(HLS)' : '原画质直连' }}</span>
            <div class="dist-bar-box">
              <div class="dist-bar is-alt" :style="{ width: item.percent + '%' }"></div>
            </div>
            <span class="dist-val">{{ item.count }}（{{ item.percent }}%）</span>
          </div>
        </div>
      </section>

      <!-- Top 问题视频 -->
      <section class="qoe-panel">
        <h3>卡顿最多的视频</h3>
        <div v-if="!problemFiles.length" class="qoe-empty">暂无数据</div>
        <el-table v-else :data="problemFiles" size="small" class="qoe-table">
          <el-table-column prop="fileName" label="文件" show-overflow-tooltip />
          <el-table-column prop="sessions" label="播放" width="70" />
          <el-table-column prop="totalStalls" label="卡顿次数" width="90" />
          <el-table-column label="卡顿时长" width="100">
            <template #default="{ row }">{{ formatDurationMs(row.stallDurationMs) }}</template>
          </el-table-column>
        </el-table>
      </section>

      <!-- 首帧最差 -->
      <section class="qoe-panel">
        <h3>首帧最慢的视频</h3>
        <div v-if="!worstStartup.length" class="qoe-empty">暂无数据</div>
        <el-table v-else :data="worstStartup" size="small" class="qoe-table">
          <el-table-column prop="fileName" label="文件" show-overflow-tooltip />
          <el-table-column prop="sessions" label="播放" width="70" />
          <el-table-column label="平均首帧" width="100">
            <template #default="{ row }">{{ row.avgStartup }}ms</template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { fetchQoeDashboard, fetchTranscodeOverview } from '@/api/video'

const days = ref(7)
const loading = ref(false)
const overviewLoading = ref(false)
const data = ref({})
const overview = ref({})

const qualityDist = computed(() => data.value.qualityDistribution || [])
const typeDist = computed(() => data.value.playTypeDistribution || [])
const trend = computed(() => data.value.dailyTrend || [])
const problemFiles = computed(() => data.value.topProblemFiles || [])
const worstStartup = computed(() => data.value.worstStartupFiles || [])
const qualityCount = computed(() => qualityDist.value.length)

const stallClass = computed(() => {
  const rate = Number(data.value.stallRate || 0)
  if (rate >= 0.15) return 'is-bad'
  if (rate >= 0.05) return 'is-warn'
  return 'is-good'
})

const trendMax = computed(() => {
  let max = 1
  trend.value.forEach(item => { if (item.sessions > max) max = item.sessions })
  return max
})

const trendWidth = (v) => Math.max(4, Math.round((Number(v || 0) / trendMax.value) * 100))

const toPercent = (v) => (Number(v || 0) * 100).toFixed(2)

const formatMbps = (bps) => {
  const mbps = Number(bps || 0) / 1_000_000
  return mbps >= 1 ? mbps.toFixed(2) : mbps.toFixed(3)
}

const formatDurationMs = (ms) => {
  const total = Number(ms || 0)
  if (total < 1000) return `${total}ms`
  const sec = total / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  return `${Math.floor(sec / 60)}m${Math.round(sec % 60)}s`
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await fetchQoeDashboard(days.value)
    data.value = res?.data || {}
  } catch (e) {
    data.value = {}
  } finally {
    loading.value = false
  }
}

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const res = await fetchTranscodeOverview()
    overview.value = res?.data || {}
  } catch (e) {
    overview.value = {}
  } finally {
    overviewLoading.value = false
  }
}

const loadAll = () => {
  loadData()
  loadOverview()
}

onMounted(loadAll)
</script>

<style scoped>
.qoe-page {
  max-width: 1180px;
  margin: 0 auto;
}

.qoe-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.qoe-head h2 {
  font-size: 20px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.qoe-head p {
  font-size: 13px;
  color: var(--text-secondary);
}

.qoe-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.qoe-transcode {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 12px 20px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.tc-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.tc-label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.tc-badge {
  min-width: 26px;
  text-align: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.tc-badge.is-queue { background: rgba(148, 163, 184, 0.18); color: var(--text-secondary); }
.tc-badge.is-running { background: rgba(37, 99, 235, 0.14); color: #2563eb; }
.tc-badge.is-done { background: rgba(16, 163, 127, 0.14); color: #10a37f; }
.tc-badge.is-failed { background: rgba(239, 68, 68, 0.14); color: #ef4444; }

.tc-spacer { margin-left: auto; }

.tc-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.qoe-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.qoe-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.qoe-card.is-bad { border-color: rgba(239, 68, 68, 0.4); }
.qoe-card.is-warn { border-color: rgba(245, 158, 11, 0.4); }
.qoe-card.is-good { border-color: rgba(16, 163, 127, 0.35); }

.qc-label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.qc-value {
  font-size: 26px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.1;
}

.qc-value small {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}

.qc-sub {
  font-size: 11.5px;
  color: var(--text-muted);
}

.qoe-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.qoe-panel {
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--surface-solid);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

.qoe-panel h3 {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.qoe-panel h3.mt {
  margin-top: 18px;
}

.qoe-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-muted);
}

.trend-row,
.dist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 12px;
}

.trend-date,
.dist-name {
  width: 52px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.dist-name { width: 92px; }

.trend-bar-box,
.dist-bar-box {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.trend-bar,
.dist-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #10a37f, #38bdf8);
  transition: width 0.3s ease;
}

.dist-bar.is-alt {
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
}

.trend-val,
.dist-val {
  width: 84px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.dist-val { width: 96px; }

.trend-meta {
  width: 168px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-muted);
  font-size: 11.5px;
}

.qoe-table {
  background: transparent;
}

@media (max-width: 1024px) {
  .qoe-cards { grid-template-columns: repeat(2, 1fr); }
  .qoe-grid { grid-template-columns: 1fr; }
}
</style>
