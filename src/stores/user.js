import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const PREFERENCES_KEY = 'lightdisk_preferences'
  
  let savedInfo = {}
  try {
    const raw = localStorage.getItem('userInfo')
    if (raw) savedInfo = JSON.parse(raw)
  } catch (e) {}
  const userInfo = ref(savedInfo)

  const setToken = (newToken) => {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    try {
      const rawPreferences = localStorage.getItem(PREFERENCES_KEY)
      const nextPreferences = rawPreferences ? JSON.parse(rawPreferences) : {}
      nextPreferences.theme = 'light'
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences))
    } catch (e) {}
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }

  return { token, userInfo, setToken, setUserInfo, logout }
})
