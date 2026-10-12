import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'lightdisk_preferences'

const loadPreferences = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    return {}
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = loadPreferences()

  const theme = ref(saved.theme === 'dark' ? 'dark' : 'light')
  const enableChunkUpload = ref(saved.enableChunkUpload !== false)
  // 下载前是否弹确认框（默认开启，避免"点一下文件就静默下载"）
  const confirmBeforeDownload = ref(saved.confirmBeforeDownload !== false)

  const isDark = computed(() => theme.value === 'dark')

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      enableChunkUpload: enableChunkUpload.value,
      confirmBeforeDownload: confirmBeforeDownload.value
    }))
  }

  const applyTheme = () => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark.value)
    root.setAttribute('data-theme', theme.value)
  }

  const initialize = () => {
    applyTheme()
    persist()
  }

  const setTheme = (nextTheme) => {
    theme.value = nextTheme === 'dark' ? 'dark' : 'light'
  }

  const setEnableChunkUpload = (enabled) => {
    enableChunkUpload.value = !!enabled
  }

  const setConfirmBeforeDownload = (enabled) => {
    confirmBeforeDownload.value = !!enabled
  }

  watch([theme, enableChunkUpload, confirmBeforeDownload], () => {
    applyTheme()
    persist()
  })

  return {
    theme,
    isDark,
    enableChunkUpload,
    confirmBeforeDownload,
    initialize,
    setTheme,
    setEnableChunkUpload,
    setConfirmBeforeDownload
  }
})
