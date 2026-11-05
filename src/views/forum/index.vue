<template>
  <div class="forum-page">
    <PageHeader eyebrow="Community" title="资料社区" sub="同学分享的课件、笔记与复习资料，收藏即自动存入你的网盘，零拷贝不占额外空间。">
      <template #actions>
        <el-button type="primary" class="publish-btn" @click="openCreate()">
          <el-icon><EditPen /></el-icon>
          <span>发帖分享</span>
        </el-button>
      </template>
    </PageHeader>

    <div class="forum-toolbar">
      <el-tabs v-model="activeTab" class="forum-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="推荐" name="recommend" />
        <el-tab-pane label="课程资料" name="course" />
        <el-tab-pane label="考研" name="exam" />
        <el-tab-pane label="竞赛" name="contest" />
        <el-tab-pane label="求助" name="help" />
        <el-tab-pane label="我的帖子" name="mine" />
      </el-tabs>
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索标题或正文"
        clearable
        @keyup.enter="reload"
        @clear="reload"
      >
        <template #append>
          <el-button @click="reload"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
    </div>

    <div v-loading="loading" class="post-list">
      <article
        v-for="post in posts"
        :key="post.id"
        class="post-card"
        @click="goDetail(post.id)"
      >
        <div class="post-card-head">
          <div class="post-title-row">
            <el-tag v-if="post.postType === 1" type="warning" size="small" effect="light" round>求助</el-tag>
            <el-tag v-else-if="post.postType === 2" type="info" size="small" effect="plain" round>转发</el-tag>
            <span class="post-title">{{ post.title }}</span>
          </div>
          <el-tag class="cat-tag" size="small" effect="plain" round>{{ post.category }}</el-tag>
        </div>

        <p v-if="post.summary" class="post-summary">{{ post.summary }}</p>

        <div v-if="post.quoteTitle" class="quote-line">引用：{{ post.quoteTitle }}</div>

        <div class="post-meta">
          <span class="author">{{ post.authorName }}</span>
          <span class="dot">·</span>
          <span>{{ formatRelativeTime(post.createdAt) }}</span>
          <span v-if="post.courseCode" class="course-code">{{ post.courseCode }}</span>
          <span class="meta-right">
            <span v-if="post.attachmentCount" class="meta-item">
              <el-icon><Paperclip /></el-icon>{{ post.attachmentCount }}
            </span>
            <span class="meta-item"><el-icon><Star /></el-icon>{{ post.favoriteCount }}</span>
            <span class="meta-item"><el-icon><ChatDotSquare /></el-icon>{{ post.commentCount }}</span>
            <span class="meta-item"><el-icon><View /></el-icon>{{ post.viewCount }}</span>
          </span>
        </div>
      </article>

      <el-empty v-if="!loading && posts.length === 0" description="这里还没有帖子，来发第一条吧" />
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        @current-change="loadFeed"
      />
    </div>

    <el-dialog v-model="createVisible" title="发帖分享资料" width="660px" destroy-on-close>
      <el-form :model="form" label-width="72px" class="post-form">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="120" show-word-limit placeholder="一句话说清这份资料是什么" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="选择分类" style="width: 180px">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
          <el-input v-model="form.courseCode" placeholder="课程码（选填，如 CS101）" style="width: 220px; margin-left: 12px" />
        </el-form-item>
        <el-form-item label="正文">
          <el-input v-model="form.content" type="textarea" :rows="6" maxlength="20000" placeholder="补充说明、适用课程、使用方法……" />
        </el-form-item>
        <el-form-item label="附件">
          <div class="attach-box">
            <div v-if="form.fileIds.length" class="attach-chips">
              <el-tag
                v-for="fid in form.fileIds"
                :key="fid"
                closable
                class="attach-chip"
                @close="removeFile(fid)"
              >{{ fileNameOf(fid) }}</el-tag>
            </div>
            <el-button plain size="small" @click="openPicker">
              <el-icon><FolderOpened /></el-icon>
              从我的网盘选择
            </el-button>
            <span class="attach-hint">资料会以引用方式挂到帖子上，不复制文件</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPost">发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pickerVisible" title="选择附件（来自我的网盘根目录）" width="560px">
      <div v-loading="fileLoading" class="picker-list">
        <el-checkbox-group v-model="pickedIds">
          <label v-for="f in myFiles" :key="f.id" class="picker-item">
            <el-checkbox :value="f.id" />
            <span class="picker-name">{{ f.name }}</span>
            <span class="picker-size">{{ formatBytes(f.size) }}</span>
          </label>
        </el-checkbox-group>
        <el-empty v-if="!fileLoading && myFiles.length === 0" description="网盘根目录还没有文件" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPick">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { createPost, getFeed, listMyFiles } from '@/api/forum'
import { formatRelativeTime } from '@/utils/datetime'
import { formatBytes } from '@/utils/format'

const router = useRouter()

const categories = ['课程资料', '考研', '竞赛', '求助', '其他']

const activeTab = ref('recommend')
const keyword = ref('')
const loading = ref(false)
const posts = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10

const createVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  title: '',
  category: '课程资料',
  courseCode: '',
  content: '',
  fileIds: []
})

const pickerVisible = ref(false)
const fileLoading = ref(false)
const myFiles = ref([])
const pickedIds = ref([])

const fileMap = computed(() => {
  const map = {}
  myFiles.value.forEach((f) => { map[f.id] = f })
  return map
})

function fileNameOf(id) {
  const f = fileMap.value[id]
  return f ? f.name : `文件#${id}`
}

function buildQuery() {
  const q = { pageNum: pageNum.value, pageSize }
  if (keyword.value.trim()) {
    q.keyword = keyword.value.trim()
  }
  if (activeTab.value === 'course') q.category = '课程资料'
  if (activeTab.value === 'exam') q.category = '考研'
  if (activeTab.value === 'contest') q.category = '竞赛'
  if (activeTab.value === 'help') q.postType = 1
  if (activeTab.value === 'mine') q.onlyMine = true
  return q
}

async function loadFeed() {
  loading.value = true
  try {
    const res = await getFeed(buildQuery())
    posts.value = res.data?.records || []
    total.value = Number(res.data?.total || 0)
  } finally {
    loading.value = false
  }
}

function reload() {
  pageNum.value = 1
  loadFeed()
}

function handleTabChange() {
  reload()
}

function goDetail(id) {
  router.push({ name: 'ForumDetail', params: { id } })
}

function openCreate(preset) {
  form.title = preset?.title || ''
  form.content = preset?.content || ''
  form.category = preset?.category || '课程资料'
  form.courseCode = ''
  form.fileIds = preset?.fileIds || []
  createVisible.value = true
}

function removeFile(id) {
  form.fileIds = form.fileIds.filter((x) => x !== id)
}

async function openPicker() {
  pickerVisible.value = true
  pickedIds.value = [...form.fileIds]
  if (myFiles.value.length) return
  fileLoading.value = true
  try {
    const res = await listMyFiles()
    myFiles.value = res.data?.records || []
  } finally {
    fileLoading.value = false
  }
}

function confirmPick() {
  form.fileIds = [...pickedIds.value]
  pickerVisible.value = false
}

async function submitPost() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  submitting.value = true
  try {
    await createPost({
      title: form.title.trim(),
      content: form.content,
      category: form.category,
      courseCode: form.courseCode || null,
      fileIds: form.fileIds
    })
    ElMessage.success('发布成功')
    createVisible.value = false
    reload()
  } finally {
    submitting.value = false
  }
}

onMounted(loadFeed)

defineExpose({ openCreate })
</script>

<style scoped>
.forum-page {
  padding: 4px;
}

.publish-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.forum-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.forum-tabs {
  flex: 1;
}

.search-input {
  width: 260px;
}

.post-list {
  min-height: 200px;
}

.post-card {
  padding: 16px 18px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-solid);
  cursor: pointer;
  transition: border-color .18s ease, transform .18s ease;
}

.post-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.post-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.post-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.post-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-tag {
  flex-shrink: 0;
}

.post-summary {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quote-line {
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: 6px;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
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
  align-items: center;
  gap: 14px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.attach-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.attach-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attach-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.picker-list {
  max-height: 320px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.picker-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-size {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
