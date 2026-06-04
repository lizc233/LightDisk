<template>
  <router-view />
</template>

<script setup>
</script>

<style>
:root {
  color-scheme: light;
  --app-bg: #f3f5f9;
  --surface: rgba(255, 255, 255, 0.92);
  --surface-solid: #ffffff;
  --surface-muted: #f7f8fb;
  --surface-strong: #eef2ff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border-color: rgba(148, 163, 184, 0.22);
  --shadow-soft: 0 12px 40px rgba(15, 23, 42, 0.08);
  --accent: #10a37f;
  --accent-soft: rgba(16, 163, 127, 0.12);
}

html.dark {
  color-scheme: dark;
  --app-bg: #141414;
  --surface: rgba(33, 33, 33, 0.9);
  --surface-solid: #212121;
  --surface-muted: #171717;
  --surface-strong: #2a2a2a;
  --text-primary: #ececec;
  --text-secondary: #b4b4b4;
  --text-muted: #8a8a8a;
  --border-color: rgba(255, 255, 255, 0.08);
  --shadow-soft: 0 18px 46px rgba(0, 0, 0, 0.42);
  --accent: #10a37f;
  --accent-soft: rgba(16, 163, 127, 0.18);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--app-bg);
  color: var(--text-primary);
  overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

a {
  color: inherit;
}

.dark .layout-container,
.dark .dropbox-container,
.dark .recycle-container,
.dark .profile-container,
.dark .settings-container {
  color: var(--text-primary);
}

.dark .el-dialog,
.dark .el-drawer,
.dark .el-popover {
  box-shadow: var(--shadow-soft);
}
</style>
