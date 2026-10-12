<template>
  <!--
    统一页头：全站内页（我的分享 / 回收站 / AI 助手 / 私信中心）共用。
    设计意图：取代早期各页各自为政的大横幅——紧凑、克制、信息密度一致，
    左侧「眉题 + 标题 + 副标题」三层文字，右侧统一放主操作。
  -->
  <header class="page-header">
    <div class="ph-left">
      <p v-if="eyebrow" class="ph-eyebrow">{{ eyebrow }}</p>
      <div class="ph-title-row">
        <h1 class="ph-title">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="$slots.sub || sub" class="ph-sub">
        <slot name="sub">{{ sub }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="ph-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  sub: { type: String, default: '' }
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 16px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.ph-eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ph-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ph-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  line-height: 1.25;
}

.ph-sub {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.ph-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding-bottom: 2px;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
