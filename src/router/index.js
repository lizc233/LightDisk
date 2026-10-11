import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasicLayout from '../layouts/BasicLayout.vue'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/Landing.vue'),
    meta: { requiresAuth: false, layout: 'empty' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue')
  },
  {
    path: '/share/:shareCode',
    name: 'PublicShare',
    component: () => import('@/views/Share.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/app',
    component: BasicLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'disk',
        name: 'Disk',
        component: () => import('@/views/Disk.vue')
      },
      {
        path: 'share',
        name: 'Share',
        component: () => import('@/views/share/index.vue')
      },
      {
        path: 'recycle',
        name: 'Recycle',
        component: () => import('@/views/recycle/index.vue')
      },
      {
        path: 'admin',
        name: 'Admin',
        component: () => import('@/views/admin/index.vue')
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue')
      },
      {
        path: 'ai',
        name: 'AiAssistant',
        component: () => import('@/views/ai/index.vue')
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('@/views/messages/index.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.matched.some(record => record.meta.requiresAuth) && !token) {
    next('/login')
    return
  }

  if (to.path === '/app/admin') {
    const userStore = useUserStore()
    const userInfo = userStore.userInfo || {}
    const hasAdminFlag = Object.prototype.hasOwnProperty.call(userInfo, 'isAdmin')
    if (hasAdminFlag && Number(userInfo.isAdmin || 0) < 1) {
      ElMessage.error('当前账号没有后台管理权限')
      next('/app/disk')
      return
    }
  }
  next()
})

export default router
