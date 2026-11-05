<template>
  <div class="forum-detail" v-loading="loading">
    <div class="back-bar">
      <el-button link @click="$router.push({ name: 'Forum' })">
        <el-icon><ArrowLeft /></el-icon>
        返回社区
      </el-button>
    </div>

    <template v-if="post">
      <article class="detail-card">
        <div class="detail-head">
          <el-tag v-if="post.postType === 1" type="warning" size="small" effect="light" round>求助</el-tag>
          <el-tag v-else-if="post.postType === 2" type="info" size="small" effect="plain" round>转发</el-tag>
          <el-tag size="small" effect="plain" round>{{ post.category }}</el-tag>
          <h1 class="detail-title">{{ post.title }}</h1>
        </div>

        <div class="detail-meta">
          <span class="author">{{ post.authorName }}</span>
          <span class="dot">·</span>
          <span>{{ formatRelativeTime(post.createdAt) }}</span>
          <span v-if="post.courseCode" class="course-code">{{ post.courseCode }}</span>
          <span class="meta-right">
            <span class="meta-item"><el-icon><View /></el-icon>{{ post.viewCount }}</span>
          </span>
        </div>

        <div v-if="post.quoteTitle" class="quote-block">
          引用自：{{ post.quoteTitle }}
        </div>

        <div class="detail-content">{{ post.content }}</div>

        <div v-if="post.attachments && post.attachments.length" class="attachment-block">
          <div class="block-title">
            <el-icon><Paperclip /></el-icon>
            附件 {{ post.attachments.length }} 个
            <span class="block-hint">收藏本帖会自动转存到你的网盘</span>
          </div>
          <div v-for="att in post.attachments" :key="att.fileId" class="attachment-item">
            <el-icon class="file-icon"><Document /></el-icon>
            <span class="file-name">{{ att.fileName }}</span>
            <span class="file-size">{{ formatBytes(att.fileSize) }}</span>
            <el-button size="small" plain @click="download(att)">下载</el-button>
          </div>
        </div>

        <div class="action-bar">
          <el-button :type="post.liked ? 'primary' : 'default'" plain @click="onLike">
            <el-icon><Star /></el-icon>
            {{ post.liked ? '已赞' : '点赞' }} {{ post.likeCount }}
          </el-button>
          <el-button :type="post.favorited ? 'success' : 'default'" plain :loading="favLoading" @click="onFavorite">
            <el-icon><Download /></el-icon>
            {{ post.favorited ? '已收藏' : '收藏到网盘' }} {{ post.favoriteCount }}
          </el-button>
          <el-button plain @click="onQuote">
            <el-icon><Share /></el-icon>
            转发
          </el-button>
          <el-button v-if="post.mine" type="danger" plain @click="onDelete">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </article>

      <section class="comment-card">
        <h2 class="section-title">评论 {{ post.commentCount }}</h2>

        <div class="comment-editor">
          <div v-if="replyTo" class="reply-hint">
            回复 @{{ replyTo.authorName }}
            <el-button link type="primary" @click="replyTo = null">取消</el-button>
          </div>
          <el-input
            v-model="commentText"
            type="textarea"
            :rows="3"
            maxlength="1000"
            :placeholder="replyTo ? `回复 @${replyTo.authorName}` : '说点什么，或者帮同学解答一下'"
          />
          <div class="editor-actions">
            <el-button type="primary" :loading="commentLoading" @click="submitComment">发表</el-button>
          </div>
        </div>

        <div class="comment-list">
          <div v-for="c in comments" :key="c.id" class="comment-item" :class="{ child: c.parentId > 0 }">
            <div class="comment-head">
              <span class="comment-author">{{ c.authorName }}</span>
              <span v-if="c.replyToName" class="reply-to">回复 @{{ c.replyToName }}</span>
              <span class="comment-time">{{ formatRelativeTime(c.createdAt) }}</span>
            </div>
            <p class="comment-content">{{ c.content }}</p>
            <el-button link type="primary" size="small" @click="startReply(c)">回复</el-button>
          </div>
          <el-empty v-if="comments.length === 0" description="还没有评论" :image-size="60" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { addComment, createPost, deletePost, getComments, getPostDetail, toggleFavorite, toggleLike } from '@/api/forum'
import { formatRelativeTime } from '@/utils/datetime'
import { formatBytes } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const postId = Number(route.params.id)
const loading = ref(false)
const post = ref(null)

const comments = ref([])
const commentText = ref('')
const commentLoading = ref(false)
const replyTo = ref(null)
const favLoading = ref(false)

async function loadDetail() {
  loading.value = true
  try {
    const res = await getPostDetail(postId)
    post.value = res.data
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  const res = await getComments({ postId, pageNum: 1, pageSize: 100 })
  comments.value = res.data?.records || []
}

async function onLike() {
  const res = await toggleLike(postId)
  const liked = res.data === true
  post.value.liked = liked
  post.value.likeCount = Math.max(0, post.value.likeCount + (liked ? 1 : -1))
}

async function onFavorite() {
  favLoading.value = true
  try {
    const res = await toggleFavorite(postId)
    const nowFav = !post.value.favorited
    post.value.favorited = nowFav
    post.value.favoriteCount = Math.max(0, post.value.favoriteCount + (nowFav ? 1 : -1))
    if (nowFav) {
      ElMessage.success(res.data ? '已收藏，附件已存入你的网盘根目录' : '已收藏')
    } else {
      ElMessage.info('已取消收藏，已转存的文件仍保留在你的网盘')
    }
  } finally {
    favLoading.value = false
  }
}

async function onQuote() {
  try {
    const { value } = await ElMessageBox.prompt('转发理由（可留空）', '转发这条帖子', {
      inputPlaceholder: '为什么值得转发',
      confirmButtonText: '转发',
      cancelButtonText: '取消'
    })
    await createPost({
      title: `转发：${post.value.title}`.slice(0, 120),
      content: value || '',
      category: post.value.category,
      courseCode: post.value.courseCode,
      quotePostId: postId
    })
    ElMessage.success('已转发到社区')
    router.push({ name: 'Forum' })
  } catch (e) {
    // 用户取消
  }
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('删除后帖子不再展示，确定删除？', '删除帖子', { type: 'warning' })
  } catch (e) {
    return
  }
  await deletePost(postId)
  ElMessage.success('已删除')
  router.push({ name: 'Forum' })
}

function startReply(c) {
  replyTo.value = { id: c.id, authorName: c.authorName }
}

async function submitComment() {
  const content = commentText.value.trim()
  if (!content) {
    ElMessage.warning('评论内容不能为空')
    return
  }
  commentLoading.value = true
  try {
    await addComment({
      postId,
      content,
      parentId: replyTo.value ? replyTo.value.id : 0
    })
    commentText.value = ''
    replyTo.value = null
    await loadComments()
    post.value.commentCount += 1
  } finally {
    commentLoading.value = false
  }
}

async function download(att) {
  const blob = await request.get(`/file/download/${att.fileId}`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = att.fileName
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await loadDetail()
  await loadComments()
})
</script>

<style scoped>
.forum-detail {
  padding: 4px;
  max-width: 900px;
}

.back-bar {
  margin-bottom: 12px;
}

.detail-card,
.comment-card {
  padding: 20px 22px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-solid);
}

.comment-card {
  margin-top: 16px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-title {
  width: 100%;
  margin: 10px 0 0;
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.author {
  color: var(--text-primary);
}

.dot {
  opacity: .5;
}

.course-code {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}

.meta-right {
  margin-left: auto;
  display: flex;
  gap: 12px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.quote-block {
  margin-top: 14px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: 6px;
}

.detail-content {
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.attachment-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-color);
}

.block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.block-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--surface-muted);
}

.file-icon {
  color: var(--accent);
}

.file-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.section-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.comment-editor {
  margin-bottom: 20px;
}

.reply-hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.comment-item.child {
  padding-left: 28px;
}

.comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.comment-author {
  font-size: 13px;
  color: var(--text-primary);
}

.reply-to {
  color: var(--accent);
}

.comment-time {
  margin-left: auto;
}

.comment-content {
  margin: 6px 0 4px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
