<template>
  <div class="forum-page">
    <header class="forum-hero">
      <span class="shard shard-a" aria-hidden="true"></span>
      <span class="shard shard-b" aria-hidden="true"></span>
      <span class="shard shard-c" aria-hidden="true"></span>
      <div class="hero-body">
        <p class="hero-eyebrow">CAMPUS MATERIAL HUB</p>
        <h2 class="hero-title">资料社区</h2>
        <p class="hero-sub">
          同学分享的课件、笔记与复习资料。收藏即自动存入你的网盘，
          <span class="hero-strong">零拷贝、不占额外空间</span>。
        </p>
        <div class="hero-actions">
          <button class="hero-publish" @click="openCreate()">
            <el-icon><EditPen /></el-icon>
            <span>发帖分享</span>
          </button>
          <span class="hero-stat">已有 {{ total }} 帖在流传</span>
        </div>
      </div>
    </header>

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
        :class="catClass(post.category, post.postType)"
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

    <el-dialog v-model="pickerVisible" title="选择附件（来自我的网盘）" width="600px">
      <el-input
        v-model="fileKeyword"
        class="picker-search"
        placeholder="输入文件名，搜索我网盘中的所有文件"
        clearable
        @keyup.enter="reloadPicker"
        @clear="reloadPicker"
      >
        <template #append>
          <el-button @click="reloadPicker"><el-icon><Search /></el-icon></el-button>
        </template>
      </el-input>
      <div class="picker-hint">
        {{ fileKeyword.trim() ? `全盘搜索“${fileKeyword.trim()}”的结果` : '当前显示根目录文件，输入关键词可搜索所有文件夹' }}
      </div>
      <div v-loading="fileLoading" class="picker-list">
        <el-checkbox-group v-model="pickedIds">
          <label v-for="f in pickerFiles" :key="f.id" class="picker-item" :class="{ picked: pickedIds.includes(f.id) }">
            <el-checkbox :value="f.id" />
            <span class="picker-ext">{{ extOf(f.name) }}</span>
            <span class="picker-name">{{ f.name }}</span>
            <span class="picker-size">{{ formatBytes(f.size) }}</span>
          </label>
        </el-checkbox-group>
        <el-empty
          v-if="!fileLoading && pickerFiles.length === 0"
          :description="fileKeyword.trim() ? '没有匹配的文件' : '网盘里还没有文件'"
          :image-size="60"
        />
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
const fileKeyword = ref('')

const pickerFiles = computed(() => myFiles.value.filter((f) => f.type === 'file'))

const fileMap = computed(() => {
  const map = {}
  myFiles.value.forEach((f) => { map[f.id] = f })
  return map
})

const pickedNames = ref({})

function fileNameOf(id) {
  if (pickedNames.value[id]) return pickedNames.value[id]
  const f = fileMap.value[id]
  return f ? f.name : `文件#${id}`
}

function extOf(name) {
  if (!name) return '?'
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1) : name
  return (ext.length > 4 ? ext.slice(0, 4) : ext).toUpperCase()
}

const CAT_CLASS = {
  '课程资料': 'cat-course',
  '考研': 'cat-exam',
  '竞赛': 'cat-contest',
  '求助': 'cat-help',
}

function catClass(category, postType) {
  if (postType === 1) return 'cat-help'
  return CAT_CLASS[category] || 'cat-other'
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
  await loadPickerFiles()
}

async function loadPickerFiles() {
  fileLoading.value = true
  try {
    const kw = fileKeyword.value.trim()
    // 有关键词走全盘文件名搜索（忽略 folderId）；否则列出根目录
    const res = await listMyFiles(kw ? { keyword: kw } : { folderId: 0 })
    myFiles.value = res.data?.records || []
  } finally {
    fileLoading.value = false
  }
}

function reloadPicker() {
  loadPickerFiles()
}

function confirmPick() {
  // 记录已选文件名，避免后续搜索替换列表后 chip 显示成「文件#id」
  pickerFiles.value.forEach((f) => {
    if (pickedIds.value.includes(f.id)) pickedNames.value[f.id] = f.name
  })
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

/* ===== 深色玻璃 hero ===== */
.forum-hero {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  padding: 34px 38px;
  border-radius: 18px;
  background:
    radial-gradient(560px 240px at 88% -30%, rgba(103, 90, 210, .38), transparent 65%),
    radial-gradient(420px 200px at 70% 120%, rgba(54, 214, 126, .12), transparent 60%),
    linear-gradient(135deg, #101014 0%, #17171f 58%, #1c1c28 100%);
  color: #fff;
}

/* 悬浮玻璃碎片装饰 */
.shard {
  position: absolute;
  background: linear-gradient(150deg, rgba(255, 255, 255, .14), rgba(255, 255, 255, .03));
  border: 1px solid rgba(255, 255, 255, .16);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .18);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.shard-a {
  width: 150px;
  height: 110px;
  right: 150px;
  top: -34px;
  clip-path: polygon(18% 0, 100% 12%, 82% 100%, 0 72%);
  transform: rotate(14deg);
  animation: shard-float 9s ease-in-out infinite;
}

.shard-b {
  width: 96px;
  height: 84px;
  right: 46px;
  bottom: -26px;
  clip-path: polygon(0 22%, 88% 0, 100% 78%, 12% 100%);
  transform: rotate(-10deg);
  animation: shard-float 12s ease-in-out 1.2s infinite;
}

.shard-c {
  width: 56px;
  height: 50px;
  right: 320px;
  bottom: 12px;
  clip-path: polygon(12% 6%, 96% 20%, 70% 96%, 0 64%);
  transform: rotate(24deg);
  opacity: .65;
  animation: shard-float 10s ease-in-out 2.1s infinite;
}

@keyframes shard-float {
  0%, 100% { translate: 0 0; rotate: 0deg; }
  50% { translate: 0 -9px; rotate: 2.5deg; }
}

.hero-body {
  position: relative;
  z-index: 1;
}

.hero-eyebrow {
  margin: 0 0 10px;
  font-size: 11px;
  letter-spacing: .22em;
  color: rgba(255, 255, 255, .42);
}

.hero-title {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -.02em;
  background: linear-gradient(180deg, #e6e6ec, #b9b9c4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-sub {
  margin: 10px 0 0;
  max-width: 560px;
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(255, 255, 255, .62);
}

.hero-strong {
  color: rgba(255, 255, 255, .92);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}

.hero-publish {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 22px;
  border: none;
  border-radius: 999px;
  background: #f2f2f5;
  color: #17171b;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}

.hero-publish:hover {
  background: #36d67e;
  color: #04140b;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(54, 214, 126, .35);
}

.hero-stat {
  font-size: 12px;
  color: rgba(255, 255, 255, .4);
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
  position: relative;
  padding: 16px 18px 16px 21px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-solid);
  cursor: pointer;
  overflow: hidden;
  transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease;
}

/* 分类色条 */
.post-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--cat-color, transparent);
}

.post-card.cat-course { --cat-color: #4f7cf0; }
.post-card.cat-exam { --cat-color: #8b5cf6; }
.post-card.cat-contest { --cat-color: #f59e0b; }
.post-card.cat-help { --cat-color: #ef5350; }
.post-card.cat-other { --cat-color: #90a4ae; }

.post-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(79, 124, 240, .10);
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

.picker-search {
  margin-bottom: 8px;
}

.picker-hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.picker-list {
  max-height: 340px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 8px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background .15s ease;
}

.picker-item:hover {
  background: var(--surface-muted);
}

.picker-item.picked {
  background: var(--accent-soft);
}

.picker-ext {
  flex-shrink: 0;
  min-width: 40px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--text-secondary);
  text-align: center;
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
