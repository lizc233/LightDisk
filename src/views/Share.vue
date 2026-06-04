<template>
  <div class="public-share-container">
    <div class="glass-card" v-loading="loading">
      <div v-if="errorMsg || (shareInfo && shareInfo.expired)" class="status-box error">
        <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
        <h2>啊哦，来晚了一步</h2>
        <p>{{ errorMsg || '该分享链接已失效或被取消' }}</p>
      </div>

      <div v-else-if="shareInfo" class="content-box">
        <div class="user-avatar">
          <el-avatar :size="64" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
        </div>
        <h2 class="share-title">LightDisk 用户向你分享了文件</h2>

        <div class="file-preview">
          <el-icon class="file-icon" :size="32"><Document /></el-icon>
          <span class="file-name">{{ shareInfo.fileName }}</span>
        </div>

        <div class="extract-area">
          <el-input
              v-model="extractCode"
              placeholder="请输入 4 位提取码"
              maxlength="4"
              class="extract-input"
              @keyup.enter="handleExtract"
          />
          <el-button type="primary" class="extract-btn" @click="handleExtract" :loading="extracting">
            提取文件
          </el-button>
        </div>
        <p class="expire-tips" v-if="shareInfo.expireTime">失效时间：{{ shareInfo.expireTime }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCloseFilled, Document } from '@element-plus/icons-vue'
import request from '@/utils/request'

const route = useRoute()
const shareCode = ref(route.params.shareCode || '') // 假设路由配成了 /share/:shareCode

const loading = ref(true)
const shareInfo = ref(null)
const errorMsg = ref('')

const extractCode = ref('')
const extracting = ref(false)

// 页面加载时获取分享基础信息
const fetchShareInfo = async () => {
  if (!shareCode.value) {
    errorMsg.value = '无效的分享链接'
    loading.value = false
    return
  }

  try {
    const res = await request.get(`/share/public/${shareCode.value}`)
    // 假设成功返回数据
    shareInfo.value = res.data
  } catch (error) {
    errorMsg.value = error.response?.data?.message || '分享链接不存在或已取消'
  } finally {
    loading.value = false
  }
}

// 处理文件提取逻辑
const handleExtract = async () => {
  if (extractCode.value.length !== 4) {
    ElMessage.warning('请输入完整的4位提取码')
    return
  }

  extracting.value = true
  try {
    // 【注意】这里需要你后端配合增加一个校验提取码的接口
    // 比如：/api/share/verify，验证通过后返回真实的文件下载链接或触发下载
    /*
    const verifyRes = await request.post('/api/share/verify', {
      shareCode: shareCode.value,
      extractCode: extractCode.value
    })
    ElMessage.success('提取成功！即将开始下载...')
    window.location.href = verifyRes.data.downloadUrl
    */

    // 暂时的模拟逻辑
    if (extractCode.value === shareInfo.value.extractCode) {
      ElMessage.success('提取码正确！(在此对接下载逻辑)')
    } else {
      ElMessage.error('提取码错误，请重试')
    }
  } catch (error) {
    ElMessage.error('提取失败')
  } finally {
    extracting.value = false
  }
}

onMounted(() => {
  fetchShareInfo()
})
</script>

<style scoped>
.public-share-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.glass-card {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 20px;
  padding: 40px 32px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.status-box.error h2 {
  color: #1e1919;
  margin-top: 16px;
  font-size: 22px;
}
.status-box.error p {
  color: #8a94a5;
  margin-top: 8px;
}

.content-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e1919;
  margin: 16px 0 24px;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 16px 24px;
  border-radius: 12px;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 32px;
}
.file-name {
  font-weight: 500;
  color: #334155;
  word-break: break-all;
  text-align: left;
}

.extract-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.extract-input {
  --el-input-border-radius: 12px;
  height: 48px;
  font-size: 16px;
}
.extract-input :deep(input) {
  text-align: center;
  letter-spacing: 4px;
  font-weight: 600;
}
.extract-btn {
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  width: 100%;
}

.expire-tips {
  margin-top: 24px;
  font-size: 13px;
  color: #94a3b8;
}
</style>