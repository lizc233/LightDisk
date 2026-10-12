import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import router from '@/router'

const request = axios.create({
    baseURL: '/api', // 开发环境代理
    timeout: 60000,
})

request.interceptors.request.use(
    (config) => {
        const userStore = useUserStore()
        if (userStore.token) {
            config.headers.Authorization = userStore.token.startsWith('Bearer ')
                ? userStore.token
                : `Bearer ${userStore.token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

request.interceptors.response.use(
    (response) => {
        // 二进制响应（zip / 文件流）没有业务状态码，直接返回原始数据
        const responseType = response.config?.responseType
        if (responseType === 'blob' || responseType === 'arraybuffer') {
            return response.data
        }
        // 统一处理业务状态码
        const res = response.data
        if (res.code !== 200 && res.code !== 1) {
            ElMessage.error(res.msg || '请求失败')
            return Promise.reject(new Error(res.msg || 'Error'))
        }
        return res
    },
    async (error) => {
        // 静默请求（如轮询）：不弹全局错误提示，但仍会处理 401
        const silent = error.config?.silent === true
        if (error.config?.skipAuthRedirect) {
            return Promise.reject(error)
        }
        // 流式接口出错时后端回的是 JSON Blob，取出里面的友好提示
        if (error.response?.data instanceof Blob) {
            try {
                const parsed = JSON.parse(await error.response.data.text())
                if (parsed?.msg) error.message = parsed.msg
            } catch (e) {
                /* 解析失败则沿用默认提示 */
            }
        }
        if (error.response?.status === 401) {
            const userStore = useUserStore()
            userStore.logout()
            router.push('/login')
            ElMessage.error('登录已过期，请重新登录')
        } else if (!silent) {
            ElMessage.error(error.message || '网络错误')
        }
        return Promise.reject(error)
    }
)

export default request
