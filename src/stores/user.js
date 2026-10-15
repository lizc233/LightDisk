import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { usePreferencesStore } from '@/stores/preferences'
import { clearUploadQueue } from '@/utils/uploadQueue'

/** 播放器持久化键前缀（实际键为 lightdisk.player.state.<userId>） */
const PLAYER_STATE_PREFIX = 'lightdisk.player.state'

/**
 * 丢弃播放器状态（内存 + 本地存储）。
 *
 * 必须做：换账号后残留的歌单属于上一个用户，<audio>/<img> 会带着新 token 去请求别人的
 * fileId，后端返回「无权访问此文件」，播放器就会一直报错。实测新账号登录后日志里反复出现该异常。
 */
const resetPlayerState = () => {
  try {
    usePlayerStore().clearList()
  } catch (e) {}
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PLAYER_STATE_PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch (e) {}
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')

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
    // 换了账号 → 音乐库、播放列表都属于上一个用户，必须清掉
    const prevId = userInfo.value?.id
    if (prevId != null && info?.id != null && String(prevId) !== String(info.id)) {
      resetPlayerState()
    }
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const logout = () => {
    resetPlayerState()
    // 排队中的上传属于上一个登录态，登出后继续跑只会拿到 401
    try { clearUploadQueue() } catch (e) {}
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    // 主题是全局偏好，但属于「上一个账号的选择」——登出后重置为明亮，并同步内存 store，
    // 否则换账号登录后顶栏仍读着上个账号的 isDark，出现「B 是明亮主题却显示黑暗主题」。
    try {
      usePreferencesStore().setTheme('light')
    } catch (e) {}
  }

  return { token, userInfo, setToken, setUserInfo, logout }
})
