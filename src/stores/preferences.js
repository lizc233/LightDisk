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

  const isDark = computed(() => theme.value === 'dark')

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      enableChunkUpload: enableChunkUpload.value
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

  watch([theme, enableChunkUpload], () => {
    applyTheme()
    persist()
  })

  return {
    theme,
    isDark,
    enableChunkUpload,
    initialize,
    setTheme,
    setEnableChunkUpload
  }
})
