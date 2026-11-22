<template>
  <div class="forum-detail" v-loading="loading">
    <nav class="detail-nav" aria-label="社区导航">
      <button @click="$router.push({ name: 'Forum' })">
        <el-icon><ArrowLeft /></el-icon>
        返回资料社区
      </button>
      <span v-if="post">{{ post.category }} / 帖子详情</span>
    </nav>

    <template v-if="post">
      <article class="detail-card">
        <header class="article-head">
          <div class="article-labels">
            <span class="post-type" :class="typeClass(post.postType)">{{ typeLabel(post.postType) }}</span>
            <span class="category-label">{{ post.category || '其他' }}</span>
            <span v-if="post.courseCode" class="course-code">{{ post.courseCode }}</span>
          </div>
          <h1>{{ post.title }}</h1>

          <div class="author-strip">
            <div class="author-avatar">{{ authorInitial(post.authorName) }}</div>
            <div class="author-copy">
              <strong>{{ post.authorName }}</strong>
              <span>{{ formatRelativeTime(post.createdAt) }} 发布</span>
            </div>
            <div class="view-count">
              <el-icon><View /></el-icon>
              {{ post.viewCount }} 次浏览
            </div>
          </div>
        </header>

        <div v-if="post.quoteTitle" class="quote-block">
          <span class="quote-mark"><el-icon><Link /></el-icon></span>
          <div>
            <small>转发自社区帖子</small>
            <strong>{{ post.quoteTitle }}</strong>
          </div>
        </div>

        <div v-if="post.content" class="detail-content">{{ post.content }}</div>
        <div v-else class="content-empty">作者没有补充正文，请查看附件或评论区。</div>

        <section v-if="post.attachments && post.attachments.length" class="attachment-block">
          <div class="block-heading">
            <div>
              <span class="heading-icon"><el-icon><Paperclip /></el-icon></span>
              <div>
                <h2>帖子附件</h2>
                <p>共 {{ post.attachments.length }} 个，收藏本帖后会自动转存到网盘根目录</p>
              </div>
            </div>
            <span class="zero-copy-tag"><el-icon><Connection /></el-icon>零拷贝转存</span>
          </div>

          <div class="attachment-list">
            <div v-for="att in post.attachments" :key="att.fileId" class="attachment-item">
              <span class="file-ext">{{ fileExt(att.fileName) }}</span>
              <div class="file-copy">
                <strong>{{ att.fileName }}</strong>
                <span>{{ formatBytes(att.fileSize) }}</span>
              </div>
              <el-button size="small" plain @click="download(att)">
                <el-icon><Download /></el-icon>
                下载
              </el-button>
            </div>
          </div>
        </section>

        <footer class="action-bar">
          <div class="action-primary">
            <el-button :type="post.liked ? 'primary' : 'default'" plain @click="onLike">
              <el-icon><Star /></el-icon>
              {{ post.liked ? '已点赞' : '点赞' }}
              <span class="action-count">{{ post.likeCount }}</span>
            </el-button>
            <el-button :type="post.favorited ? 'success' : 'default'" plain :loading="favLoading" @click="onFavorite">
              <el-icon><CollectionTag /></el-icon>
              {{ post.favorited ? '已收藏到网盘' : '收藏到网盘' }}
              <span class="action-count">{{ post.favoriteCount }}</span>
            </el-button>
            <el-button plain @click="onQuote">
              <el-icon><Share /></el-icon>
              转发
            </el-button>
          </div>
          <el-button v-if="post.mine" class="delete-button" link type="danger" @click="onDelete">
            <el-icon><Delete /></el-icon>
            删除帖子
          </el-button>
        </footer>
      </article>

      <section class="comment-card">
        <div class="comment-heading">
          <div>
            <span class="comment-kicker">DISCUSSION</span>
            <h2>评论与讨论 <span>{{ post.commentCount }}</span></h2>
          </div>
          <p>分享使用经验，或者帮同学解答问题</p>
        </div>

        <div class="comment-editor">
          <div class="editor-avatar">我</div>
          <div class="editor-body">
            <div v-if="replyTo" class="reply-hint">
              <span>正在回复 <strong>@{{ replyTo.authorName }}</strong></span>
              <button @click="replyTo = null">取消回复</button>
            </div>
            <el-input
              v-model="commentText"
              type="textarea"
              :rows="3"
              maxlength="1000"
              resize="none"
              :placeholder="replyTo ? `回复 @${replyTo.authorName}` : '写下你的看法、使用心得或解答……'"
            />
            <div class="editor-actions">
              <span>{{ commentText.length }}/1000</span>
              <el-button type="primary" :loading="commentLoading" @click="submitComment">发表评论</el-button>
            </div>
          </div>
        </div>

        <div v-if="comments.length" class="comment-list">
          <div v-for="comment in comments" :key="comment.id" class="comment-item" :class="{ child: comment.parentId > 0 }">
            <div class="comment-avatar">{{ authorInitial(comment.authorName) }}</div>
            <div class="comment-body">
              <div class="comment-head">
                <strong>{{ comment.authorName }}</strong>
                <span v-if="comment.replyToName" class="reply-to">回复 @{{ comment.replyToName }}</span>
                <time>{{ formatRelativeTime(comment.createdAt) }}</time>
              </div>
              <p>{{ comment.content }}</p>
              <button class="reply-button" @click="startReply(comment)">
                <el-icon><ChatLineRound /></el-icon>
                回复
              </button>
            </div>
          </div>
        </div>

        <div v-else class="comment-empty">
          <el-icon><ChatDotSquare /></el-icon>
          <strong>还没有评论</strong>
          <span>来留下第一条有帮助的讨论吧</span>
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

function typeLabel(postType) {
  if (postType === 1) return '求助'
  if (postType === 2) return '转发'
  return '资料分享'
}

function typeClass(postType) {
  if (postType === 1) return 'type-help'
  if (postType === 2) return 'type-quote'
  return 'type-resource'
}

function authorInitial(name) {
  return String(name || 'L').trim().slice(0, 1).toUpperCase()
}

function fileExt(name) {
  const value = String(name || '')
  const index = value.lastIndexOf('.')
  const extension = index >= 0 ? value.slice(index + 1) : 'FILE'
  return (extension.length > 4 ? extension.slice(0, 4) : extension).toUpperCase()
}

async function loadDetail() {
  loading.value = true
  try {
    const response = await getPostDetail(postId)
    post.value = response.data
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  const response = await getComments({ postId, pageNum: 1, pageSize: 100 })
  comments.value = response.data?.records || []
}

async function onLike() {
  const response = await toggleLike(postId)
  const liked = response.data === true
  post.value.liked = liked
  post.value.likeCount = Math.max(0, post.value.likeCount + (liked ? 1 : -1))
}

async function onFavorite() {
  favLoading.value = true
  try {
    const response = await toggleFavorite(postId)
    const favorited = !post.value.favorited
    post.value.favorited = favorited
    post.value.favoriteCount = Math.max(0, post.value.favoriteCount + (favorited ? 1 : -1))
    if (favorited) {
      ElMessage.success(response.data ? '收藏成功，附件已转存到网盘根目录' : '收藏成功')
    } else {
      ElMessage.info('已取消收藏，已转存的文件仍保留在网盘中')
    }
  } finally {
    favLoading.value = false
  }
}

async function onQuote() {
  try {
    const { value } = await ElMessageBox.prompt('可以补充一句推荐理由', '转发这条帖子', {
      inputPlaceholder: '为什么值得分享给更多同学？',
      confirmButtonText: '确认转发',
      cancelButtonText: '取消'
    })
    await createPost({
      title: `转发：${post.value.title}`.slice(0, 120),
      content: value || '',
      category: post.value.category,
      courseCode: post.value.courseCode,
      quotePostId: postId
    })
    ElMessage.success('已转发到资料社区')
    router.push({ name: 'Forum' })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error
  }
}

async function onDelete() {
  try {
    await ElMessageBox.confirm('删除后帖子将不再展示，确定继续吗？', '删除帖子', { type: 'warning' })
  } catch (error) {
    return
  }
  await deletePost(postId)
  ElMessage.success('帖子已删除')
  router.push({ name: 'Forum' })
}

function startReply(comment) {
  replyTo.value = { id: comment.id, authorName: comment.authorName }
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
    ElMessage.success('评论已发表')
  } finally {
    commentLoading.value = false
  }
}

async function download(attachment) {
  const blob = await request.get(`/file/download/${attachment.fileId}`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.fileName
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await loadDetail()
  await loadComments()
})
</script>

<style scoped>
.forum-detail {
  --forum-violet: #6d5ce7;
  --forum-violet-soft: rgba(109, 92, 231, 0.12);
  max-width: 980px;
  margin: 0 auto;
  padding: 4px;
}

.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 11px;
}

.detail-nav button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
}

.detail-nav button:hover { color: var(--forum-violet); }

.detail-card,
.comment-card {
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: var(--surface-solid);
}

.detail-card { padding: 32px 38px 24px; }
.article-head { padding-bottom: 23px; border-bottom: 1px solid var(--border-color); }
.article-labels { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }

.post-type,
.category-label,
.course-code {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
}

.post-type { padding: 6px 9px; font-weight: 700; }
.type-resource { background: rgba(92, 124, 250, 0.12); color: #5c7cfa; }
.type-help { background: rgba(239, 91, 91, 0.12); color: #e74b4b; }
.type-quote { background: var(--surface-muted); color: var(--text-secondary); }
.category-label { color: var(--text-secondary); }
.course-code { padding: 5px 8px; background: var(--forum-violet-soft); color: var(--forum-violet); }

.article-head h1 {
  max-width: 820px;
  margin: 17px 0 20px;
  color: var(--text-primary);
  font-size: clamp(24px, 3.2vw, 36px);
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.025em;
}

.author-strip { display: flex; align-items: center; }

.author-avatar,
.comment-avatar,
.editor-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--forum-violet-soft);
  color: var(--forum-violet);
  font-weight: 700;
}

.author-avatar { width: 42px; height: 42px; font-size: 15px; }
.author-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; margin-left: 11px; }
.author-copy strong { color: var(--text-primary); font-size: 13px; }
.author-copy span { color: var(--text-secondary); font-size: 11px; }

.view-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 11px;
}

.quote-block {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 11px;
  align-items: center;
  margin-top: 24px;
  padding: 13px 15px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-muted);
}

.quote-mark,
.heading-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--forum-violet-soft);
  color: var(--forum-violet);
}

.quote-mark { width: 38px; height: 38px; }
.quote-block small, .quote-block strong { display: block; }
.quote-block small { color: var(--text-secondary); font-size: 10px; }
.quote-block strong { margin-top: 3px; overflow: hidden; color: var(--text-primary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }

.detail-content {
  min-height: 110px;
  margin-top: 26px;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 2;
  white-space: pre-wrap;
  word-break: break-word;
}

.content-empty {
  margin-top: 24px;
  padding: 20px;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.attachment-block { margin-top: 30px; padding-top: 24px; border-top: 1px solid var(--border-color); }
.block-heading, .block-heading > div { display: flex; align-items: center; }
.block-heading { justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.block-heading > div { gap: 10px; }
.heading-icon { width: 38px; height: 38px; }
.block-heading h2 { margin: 0; color: var(--text-primary); font-size: 14px; }
.block-heading p { margin: 3px 0 0; color: var(--text-secondary); font-size: 11px; }

.zero-copy-tag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(53, 183, 123, 0.12);
  color: #28a66c;
  font-size: 10px;
  font-weight: 600;
}

.attachment-list { display: grid; gap: 8px; }

.attachment-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  padding: 11px 12px;
  border: 1px solid var(--border-color);
  border-radius: 11px;
  background: var(--surface-muted);
}

.file-ext {
  padding: 7px 5px;
  border-radius: 7px;
  background: var(--forum-violet-soft);
  color: var(--forum-violet);
  font-size: 9px;
  font-weight: 750;
  text-align: center;
}

.file-copy { min-width: 0; }
.file-copy strong, .file-copy span { display: block; }
.file-copy strong { overflow: hidden; color: var(--text-primary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.file-copy span { margin-top: 3px; color: var(--text-secondary); font-size: 10px; }

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.action-primary { display: flex; flex-wrap: wrap; gap: 8px; }
.action-count { margin-left: 3px; opacity: 0.72; }
.delete-button { flex-shrink: 0; }

.comment-card { margin-top: 16px; padding: 28px 32px 32px; }
.comment-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.comment-kicker { color: var(--forum-violet); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; }
.comment-heading h2 { margin: 5px 0 0; color: var(--text-primary); font-size: 18px; }
.comment-heading h2 span { color: var(--text-secondary); font-size: 13px; font-weight: 500; }
.comment-heading > p { margin: 0; color: var(--text-secondary); font-size: 11px; }

.comment-editor { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 11px; margin-top: 22px; padding-bottom: 22px; border-bottom: 1px solid var(--border-color); }
.editor-avatar, .comment-avatar { width: 36px; height: 36px; font-size: 12px; }
.editor-body { min-width: 0; }
.editor-body :deep(.el-textarea__inner) { border-radius: 10px; box-shadow: 0 0 0 1px var(--border-color) inset; }

.reply-hint { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: var(--text-secondary); font-size: 11px; }
.reply-hint strong { color: var(--forum-violet); }
.reply-hint button { padding: 0; border: 0; background: transparent; color: var(--forum-violet); font: inherit; cursor: pointer; }
.editor-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; }
.editor-actions > span { color: var(--text-secondary); font-size: 10px; }

.comment-list { margin-top: 4px; }
.comment-item { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 11px; padding: 18px 0; border-bottom: 1px solid var(--border-color); }
.comment-item.child { margin-left: 47px; }
.comment-item.child::before { position: absolute; left: -29px; top: 0; bottom: 0; width: 1px; background: var(--border-color); content: ''; }
.comment-body { min-width: 0; }
.comment-head { display: flex; align-items: center; gap: 8px; }
.comment-head strong { color: var(--text-primary); font-size: 12px; }
.reply-to { color: var(--forum-violet); font-size: 11px; }
.comment-head time { margin-left: auto; color: var(--text-secondary); font-size: 10px; }
.comment-body p { margin: 7px 0 6px; color: var(--text-primary); font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.reply-button { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--text-secondary); font: inherit; font-size: 10px; cursor: pointer; }
.reply-button:hover { color: var(--forum-violet); }

.comment-empty { display: flex; min-height: 170px; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); text-align: center; }
.comment-empty > .el-icon { margin-bottom: 10px; color: var(--forum-violet); font-size: 28px; }
.comment-empty strong { color: var(--text-primary); font-size: 13px; }
.comment-empty span { margin-top: 5px; font-size: 11px; }

@media (max-width: 720px) {
  .forum-detail { padding: 0; }
  .detail-card { padding: 24px 20px 20px; }
  .article-head h1 { font-size: 26px; }
  .block-heading, .action-bar, .comment-heading { align-items: flex-start; flex-direction: column; }
  .action-primary { width: 100%; }
  .action-primary .el-button { flex: 1; margin-left: 0; }
  .delete-button { align-self: flex-end; }
  .comment-card { padding: 23px 20px 26px; }
  .comment-heading > p { display: none; }
  .comment-item.child { margin-left: 20px; }
  .comment-item.child::before { left: -12px; }
}

@media (max-width: 480px) {
  .detail-nav > span, .view-count, .zero-copy-tag { display: none; }
  .detail-card, .comment-card { border-radius: 14px; }
  .article-head h1 { font-size: 22px; }
  .detail-content { font-size: 14px; line-height: 1.85; }
  .attachment-item { grid-template-columns: 38px minmax(0, 1fr); }
  .attachment-item .el-button { grid-column: 1 / -1; width: 100%; margin-left: 0; }
  .action-primary { flex-direction: column; }
  .action-primary .el-button { width: 100%; }
  .comment-editor { grid-template-columns: 1fr; }
  .editor-avatar { display: none; }
  .comment-item { grid-template-columns: 30px minmax(0, 1fr); gap: 9px; }
  .comment-avatar { width: 30px; height: 30px; border-radius: 9px; }
  .comment-head { flex-wrap: wrap; }
  .comment-head time { width: 100%; margin-left: 0; }
}
</style>
