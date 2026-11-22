<template>
  <div class="forum-page">
    <header class="forum-hero">
      <span class="hero-orbit orbit-a" aria-hidden="true"></span>
      <span class="hero-orbit orbit-b" aria-hidden="true"></span>
      <div class="hero-copy">
        <div class="hero-kicker">
          <span class="kicker-dot"></span>
          CAMPUS KNOWLEDGE COMMONS
        </div>
        <h1>把散落的资料，变成可以流动的知识</h1>
        <p>
          分享课件、笔记与备考经验，也可以向同学发起求助。附件直接来自个人网盘，
          <strong>收藏即可零拷贝转存</strong>。
        </p>
        <div class="hero-actions">
          <button class="primary-action" @click="openCreate('resource')">
            <el-icon><EditPen /></el-icon>
            分享一份资料
          </button>
          <button class="secondary-action" @click="openCreate('help')">
            <el-icon><QuestionFilled /></el-icon>
            发起求助
          </button>
        </div>
      </div>

      <div class="hero-proof" aria-label="社区数据概览">
        <div class="proof-item">
          <strong>{{ total }}</strong>
          <span>当前内容</span>
        </div>
        <div class="proof-item">
          <strong>{{ attachmentTotal }}</strong>
          <span>本页附件</span>
        </div>
        <div class="proof-item">
          <strong>{{ interactionTotal }}</strong>
          <span>本页互动</span>
        </div>
      </div>
    </header>

    <div class="forum-workspace">
      <main class="forum-main">
        <section class="feed-toolbar">
          <div class="toolbar-heading">
            <span class="toolbar-eyebrow">DISCOVER</span>
            <div>
              <h2>社区内容</h2>
              <p>推荐流会结合热度、新鲜度和你的阅读偏好排序</p>
            </div>
          </div>

          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索标题、正文或课程"
            clearable
            @keyup.enter="reload"
            @clear="reload"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>

          <el-tabs v-model="activeTab" class="forum-tabs" @tab-change="handleTabChange">
            <el-tab-pane label="为你推荐" name="recommend" />
            <el-tab-pane label="课程资料" name="course" />
            <el-tab-pane label="考研" name="exam" />
            <el-tab-pane label="竞赛" name="contest" />
            <el-tab-pane label="求助" name="help" />
            <el-tab-pane label="我的帖子" name="mine" />
          </el-tabs>
        </section>

        <div v-loading="loading" class="post-list">
          <article
            v-for="post in posts"
            :key="post.id"
            class="post-card"
            :class="catClass(post.category, post.postType)"
            @click="goDetail(post.id)"
          >
            <div class="author-avatar" :title="post.authorName">{{ authorInitial(post.authorName) }}</div>

            <div class="post-body">
              <div class="post-card-head">
                <div class="post-labels">
                  <span class="post-type" :class="typeClass(post.postType)">{{ typeLabel(post.postType) }}</span>
                  <span class="category-label">{{ post.category || '其他' }}</span>
                  <span v-if="post.courseCode" class="course-code">{{ post.courseCode }}</span>
                </div>
                <span class="post-time">{{ formatRelativeTime(post.createdAt) }}</span>
              </div>

              <h3 class="post-title">{{ post.title }}</h3>
              <p v-if="post.summary" class="post-summary">{{ post.summary }}</p>

              <div v-if="post.quoteTitle" class="quote-line">
                <el-icon><Link /></el-icon>
                <span>转发自「{{ post.quoteTitle }}」</span>
              </div>

              <div class="post-footer">
                <div class="post-author-line">
                  <span>{{ post.authorName }}</span>
                  <span v-if="post.attachmentCount" class="attachment-pill">
                    <el-icon><Paperclip /></el-icon>
                    {{ post.attachmentCount }} 个附件
                  </span>
                </div>
                <div class="post-metrics" aria-label="帖子互动数据">
                  <span><el-icon><Star /></el-icon>{{ post.favoriteCount }}</span>
                  <span><el-icon><ChatDotSquare /></el-icon>{{ post.commentCount }}</span>
                  <span><el-icon><View /></el-icon>{{ post.viewCount }}</span>
                  <el-icon class="open-icon"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>
          </article>

          <div v-if="!loading && posts.length === 0" class="empty-feed">
            <div class="empty-mark"><el-icon><Notebook /></el-icon></div>
            <h3>这里还没有内容</h3>
            <p>换个分类看看，或者成为第一个分享资料的人。</p>
            <el-button type="primary" @click="openCreate('resource')">发布第一条</el-button>
          </div>
        </div>

        <div v-if="total > pageSize" class="pager">
          <el-pagination
            v-model:current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            background
            @current-change="loadFeed"
          />
        </div>
      </main>

      <aside class="forum-rail">
        <section class="rail-card create-card">
          <span class="rail-eyebrow">QUICK START</span>
          <h3>今天想分享什么？</h3>
          <p>网盘里的文件可以直接挂到帖子上，不会重复占用存储空间。</p>
          <button @click="openCreate('resource')">
            <el-icon><FolderOpened /></el-icon>
            分享网盘资料
          </button>
          <button class="help-button" @click="openCreate('help')">
            <el-icon><ChatLineRound /></el-icon>
            向同学求助
          </button>
        </section>

        <section class="rail-card category-card">
          <div class="rail-title-row">
            <h3>浏览频道</h3>
            <span>{{ total }} 条</span>
          </div>
          <button
            v-for="item in categoryItems"
            :key="item.tab"
            class="category-row"
            :class="{ active: activeTab === item.tab }"
            @click="selectTab(item.tab)"
          >
            <span class="category-dot" :class="`dot-${item.tab}`"></span>
            <span>{{ item.label }}</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </section>

        <section class="rail-card feature-card">
          <span class="rail-eyebrow">WHY LIGHTDISK</span>
          <div v-for="item in featureItems" :key="item.title" class="feature-row">
            <div class="feature-icon"><el-icon><component :is="item.icon" /></el-icon></div>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.text }}</p>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog
      v-model="createVisible"
      class="create-dialog"
      width="min(720px, 92vw)"
      :title="createMode === 'help' ? '发起求助' : '分享资料'"
      destroy-on-close
    >
      <div class="mode-switch" aria-label="发帖类型">
        <button :class="{ active: createMode === 'resource' }" @click="changeCreateMode('resource')">
          <span class="mode-icon"><el-icon><Collection /></el-icon></span>
          <span>
            <strong>分享资料</strong>
            <small>课件、笔记、题库与经验整理</small>
          </span>
        </button>
        <button :class="{ active: createMode === 'help' }" @click="changeCreateMode('help')">
          <span class="mode-icon help"><el-icon><QuestionFilled /></el-icon></span>
          <span>
            <strong>发起求助</strong>
            <small>描述问题，让同学快速理解</small>
          </span>
        </button>
      </div>

      <div class="compose-tip">
        <el-icon><InfoFilled /></el-icon>
        <span v-if="createMode === 'help'">写清课程、问题背景和已经尝试过的方法，更容易获得有效回答。</span>
        <span v-else>标题说明资料用途，正文补充适用课程、版本和使用方式。</span>
      </div>

      <el-form :model="form" label-position="top" class="post-form">
        <el-form-item label="标题" required>
          <el-input
            v-model="form.title"
            maxlength="120"
            show-word-limit
            :placeholder="createMode === 'help' ? '例如：操作系统课程设计中的进程同步问题' : '例如：数据结构期末复习笔记与重点题型'"
          />
        </el-form-item>

        <div class="form-grid">
          <el-form-item label="分类">
            <el-select v-model="form.category" :disabled="createMode === 'help'" placeholder="选择分类">
              <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
            </el-select>
          </el-form-item>
          <el-form-item label="课程码（选填）">
            <el-input v-model="form.courseCode" placeholder="如 CS101、MATH204" />
          </el-form-item>
        </div>

        <el-form-item :label="createMode === 'help' ? '问题描述' : '资料说明'" :required="createMode === 'help'">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="7"
            maxlength="20000"
            show-word-limit
            :placeholder="createMode === 'help' ? '描述遇到的问题、相关环境以及你已经尝试过的方法……' : '补充资料来源、适用范围、使用方法和需要注意的地方……'"
          />
        </el-form-item>

        <el-form-item label="网盘附件">
          <div class="attach-box">
            <div v-if="form.fileIds.length" class="attach-chips">
              <span v-for="fid in form.fileIds" :key="fid" class="attach-chip">
                <span class="chip-ext">{{ extOf(fileNameOf(fid)) }}</span>
                <span class="chip-name">{{ fileNameOf(fid) }}</span>
                <button aria-label="移除附件" @click.prevent="removeFile(fid)"><el-icon><Close /></el-icon></button>
              </span>
            </div>
            <button class="attach-picker-button" type="button" @click="openPicker">
              <el-icon><FolderOpened /></el-icon>
              {{ form.fileIds.length ? '继续选择附件' : '从我的网盘选择' }}
            </button>
            <span class="attach-hint">
              <el-icon><Connection /></el-icon>
              附件以引用方式挂载，收藏时自动转存，不重复复制物理文件
            </span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <div class="draft-state">
            <el-icon><DocumentChecked /></el-icon>
            <span>{{ draftSavedAt || '内容会自动保存为本地草稿' }}</span>
            <button v-if="hasCurrentDraft" @click="discardDraft">清空草稿</button>
          </div>
          <div class="footer-actions">
            <el-button @click="createVisible = false">稍后再发</el-button>
            <el-button type="primary" :loading="submitting" @click="submitPost">
              {{ createMode === 'help' ? '发布求助' : '发布资料' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="pickerVisible" class="picker-dialog" title="从我的网盘选择附件" width="min(620px, 92vw)">
      <el-input
        v-model="fileKeyword"
        class="picker-search"
        placeholder="输入文件名，搜索网盘中的所有文件"
        clearable
        @keyup.enter="reloadPicker"
        @clear="reloadPicker"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="picker-hint">
        {{ fileKeyword.trim() ? `全盘搜索“${fileKeyword.trim()}”的结果` : '当前显示根目录文件，输入关键词可搜索所有文件夹' }}
      </div>
      <div v-loading="fileLoading" class="picker-list">
        <el-checkbox-group v-model="pickedIds" style="display: block; font-size: 12px !important; line-height: 1.4 !important">
          <label
            v-for="file in pickerFiles"
            :key="file.id"
            class="picker-item"
            :class="{ picked: pickedIds.includes(file.id) }"
            style="font-size: 12px !important; line-height: 1.4 !important"
          >
            <el-checkbox :value="file.id" />
            <span class="picker-ext">{{ fileExtOf(file) }}</span>
            <span class="picker-name" :title="fileNameOfItem(file)">{{ fileNameOfItem(file) }}</span>
            <span class="picker-size">{{ formatBytes(file.size) }}</span>
          </label>
        </el-checkbox-group>
        <el-empty
          v-if="!fileLoading && pickerFiles.length === 0"
          :description="fileKeyword.trim() ? '没有匹配的文件' : '网盘里还没有文件'"
          :image-size="60"
        />
      </div>
      <template #footer>
        <span class="picked-count">已选择 {{ pickedIds.length }} 个文件</span>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPick">确认选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createPost, getFeed, listMyFiles } from '@/api/forum'
import { formatRelativeTime } from '@/utils/datetime'
import { formatBytes } from '@/utils/format'

const router = useRouter()

const categories = ['课程资料', '考研', '竞赛', '其他']
const categoryItems = [
  { tab: 'course', label: '课程资料' },
  { tab: 'exam', label: '考研专区' },
  { tab: 'contest', label: '竞赛组队' },
  { tab: 'help', label: '同学求助' },
  { tab: 'mine', label: '我的帖子' }
]
const featureItems = [
  { icon: 'MagicStick', title: '个性化推荐', text: '结合内容热度与阅读偏好排序' },
  { icon: 'Connection', title: '零拷贝收藏', text: '附件转存不重复占用物理空间' },
  { icon: 'FolderOpened', title: '网盘直挂', text: '从个人网盘直接选择帖子附件' }
]

const activeTab = ref('recommend')
const keyword = ref('')
const loading = ref(false)
const posts = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10

const attachmentTotal = computed(() => posts.value.reduce((sum, post) => sum + Number(post.attachmentCount || 0), 0))
const interactionTotal = computed(() => posts.value.reduce((sum, post) => (
  sum + Number(post.favoriteCount || 0) + Number(post.commentCount || 0)
), 0))

const createVisible = ref(false)
const createMode = ref('resource')
const submitting = ref(false)
const draftSavedAt = ref('')
const hasCurrentDraft = ref(false)
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
const pickedNames = ref({})
let draftTimer = null

const pickerFiles = computed(() => myFiles.value.filter((file) => file.type === 'file'))
const fileMap = computed(() => {
  const map = {}
  myFiles.value.forEach((file) => { map[file.id] = file })
  return map
})

function typeLabel(postType) {
  if (postType === 1) return '求助'
  if (postType === 2) return '转发'
  return '资料'
}

function typeClass(postType) {
  if (postType === 1) return 'type-help'
  if (postType === 2) return 'type-quote'
  return 'type-resource'
}

function authorInitial(name) {
  const value = String(name || 'L').trim()
  return value.slice(0, 1).toUpperCase()
}

function fileNameOf(id) {
  if (pickedNames.value[id]) return pickedNames.value[id]
  const file = fileMap.value[id]
  return file ? fileNameOfItem(file) : `文件#${id}`
}

function fileNameOfItem(file) {
  return String(file?.name || file?.fileName || file?.filename || `文件#${file?.id ?? ''}`).trim()
}

function fileExtOf(file) {
  const ext = String(file?.ext || '').trim()
  return ext ? ext.slice(0, 4).toUpperCase() : extOf(fileNameOfItem(file))
}

function extOf(name) {
  if (!name) return 'FILE'
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1) : name
  return (ext.length > 4 ? ext.slice(0, 4) : ext).toUpperCase()
}

const CAT_CLASS = {
  '课程资料': 'cat-course',
  '考研': 'cat-exam',
  '竞赛': 'cat-contest',
  '求助': 'cat-help'
}

function catClass(category, postType) {
  if (postType === 1) return 'cat-help'
  return CAT_CLASS[category] || 'cat-other'
}

function buildQuery() {
  const query = { pageNum: pageNum.value, pageSize }
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  if (activeTab.value === 'course') query.category = '课程资料'
  if (activeTab.value === 'exam') query.category = '考研'
  if (activeTab.value === 'contest') query.category = '竞赛'
  if (activeTab.value === 'help') query.postType = 1
  if (activeTab.value === 'mine') query.onlyMine = true
  return query
}

async function loadFeed() {
  loading.value = true
  try {
    const response = await getFeed(buildQuery())
    posts.value = response.data?.records || []
    total.value = Number(response.data?.total || 0)
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

function selectTab(tab) {
  activeTab.value = tab
  reload()
}

function goDetail(id) {
  router.push({ name: 'ForumDetail', params: { id } })
}

function draftKey(mode = createMode.value) {
  return `lightdisk-forum-draft-${mode}`
}

function resetForm(mode = createMode.value) {
  form.title = ''
  form.category = mode === 'help' ? '求助' : '课程资料'
  form.courseCode = ''
  form.content = ''
  form.fileIds = []
  pickedNames.value = {}
  draftSavedAt.value = ''
}

function restoreDraft(mode) {
  const raw = localStorage.getItem(draftKey(mode))
  hasCurrentDraft.value = Boolean(raw)
  if (!raw) return false
  try {
    const draft = JSON.parse(raw)
    form.title = draft.title || ''
    form.category = mode === 'help' ? '求助' : (draft.category || '课程资料')
    form.courseCode = draft.courseCode || ''
    form.content = draft.content || ''
    form.fileIds = Array.isArray(draft.fileIds) ? draft.fileIds : []
    pickedNames.value = draft.pickedNames || {}
    draftSavedAt.value = '已恢复上次未发布的草稿'
    return true
  } catch (error) {
    localStorage.removeItem(draftKey(mode))
    hasCurrentDraft.value = false
    return false
  }
}

function saveDraft() {
  if (!createVisible.value) return
  const hasContent = form.title.trim() || form.content.trim() || form.fileIds.length
  if (!hasContent) {
    localStorage.removeItem(draftKey())
    hasCurrentDraft.value = false
    draftSavedAt.value = ''
    return
  }
  localStorage.setItem(draftKey(), JSON.stringify({
    title: form.title,
    category: form.category,
    courseCode: form.courseCode,
    content: form.content,
    fileIds: form.fileIds,
    pickedNames: pickedNames.value
  }))
  hasCurrentDraft.value = true
  draftSavedAt.value = '草稿已自动保存'
}

function openCreate(mode = 'resource') {
  createMode.value = mode
  if (!restoreDraft(mode)) resetForm(mode)
  createVisible.value = true
}

function changeCreateMode(mode) {
  if (mode === createMode.value) return
  saveDraft()
  createMode.value = mode
  if (!restoreDraft(mode)) resetForm(mode)
}

function discardDraft() {
  localStorage.removeItem(draftKey())
  hasCurrentDraft.value = false
  resetForm()
  ElMessage.success('草稿已清空')
}

function removeFile(id) {
  form.fileIds = form.fileIds.filter((fileId) => fileId !== id)
}

async function openPicker() {
  pickerVisible.value = true
  pickedIds.value = [...form.fileIds]
  await loadPickerFiles()
}

async function loadPickerFiles() {
  fileLoading.value = true
  try {
    const search = fileKeyword.value.trim()
    const response = await listMyFiles(search ? { keyword: search } : { folderId: 0 })
    myFiles.value = (response.data?.records || []).map((file) => ({
      ...file,
      name: fileNameOfItem(file)
    }))
  } finally {
    fileLoading.value = false
  }
}

function reloadPicker() {
  loadPickerFiles()
}

function confirmPick() {
  pickerFiles.value.forEach((file) => {
    if (pickedIds.value.includes(file.id)) pickedNames.value[file.id] = fileNameOfItem(file)
  })
  form.fileIds = [...pickedIds.value]
  pickerVisible.value = false
}

async function submitPost() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (createMode.value === 'help' && !form.content.trim()) {
    ElMessage.warning('请补充问题描述')
    return
  }
  if (createMode.value === 'resource' && !form.content.trim() && form.fileIds.length === 0) {
    ElMessage.warning('请填写资料说明或添加至少一个附件')
    return
  }

  submitting.value = true
  try {
    const response = await createPost({
      title: form.title.trim(),
      content: form.content.trim(),
      category: createMode.value === 'help' ? '求助' : form.category,
      courseCode: form.courseCode.trim() || null,
      postType: createMode.value === 'help' ? 1 : 0,
      fileIds: form.fileIds
    })
    localStorage.removeItem(draftKey())
    hasCurrentDraft.value = false
    createVisible.value = false
    ElMessage.success(createMode.value === 'help' ? '求助已发布' : '资料已发布')
    if (response.data) {
      router.push({ name: 'ForumDetail', params: { id: response.data } })
    } else {
      reload()
    }
  } finally {
    submitting.value = false
  }
}

watch(form, () => {
  if (!createVisible.value) return
  window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(saveDraft, 350)
}, { deep: true })

onMounted(loadFeed)
onBeforeUnmount(() => window.clearTimeout(draftTimer))

defineExpose({ openCreate })
</script>

<style scoped>
.forum-page {
  --forum-violet: #6d5ce7;
  --forum-violet-soft: rgba(109, 92, 231, 0.12);
  --forum-green: #35d07f;
  padding: 4px;
}

.forum-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 36px;
  min-height: 246px;
  margin-bottom: 18px;
  padding: 38px 42px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background:
    radial-gradient(circle at 84% 18%, rgba(117, 97, 240, 0.36), transparent 28%),
    radial-gradient(circle at 75% 118%, rgba(53, 208, 127, 0.16), transparent 32%),
    #111119;
  color: #fff;
}

.hero-orbit {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  pointer-events: none;
}

.orbit-a { width: 320px; height: 320px; right: -80px; top: -150px; }
.orbit-b { width: 190px; height: 190px; right: 105px; bottom: -130px; }

.hero-copy,
.hero-proof { position: relative; z-index: 1; }
.hero-copy { max-width: 690px; }

.hero-kicker,
.rail-eyebrow,
.toolbar-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-kicker { color: rgba(255, 255, 255, 0.48); }

.kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--forum-green);
  box-shadow: 0 0 0 5px rgba(53, 208, 127, 0.12);
}

.hero-copy h1 {
  max-width: 650px;
  margin: 18px 0 12px;
  font-size: clamp(28px, 3vw, 42px);
  font-weight: 650;
  line-height: 1.18;
  letter-spacing: -0.04em;
}

.hero-copy p {
  max-width: 620px;
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 14px;
  line-height: 1.8;
}

.hero-copy p strong { color: #fff; font-weight: 600; }
.hero-actions { display: flex; gap: 10px; margin-top: 24px; }

.hero-actions button,
.create-card button,
.category-row,
.mode-switch button,
.attach-picker-button,
.attach-chip button,
.draft-state button { font: inherit; cursor: pointer; }

.hero-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.primary-action { border: 1px solid #fff; background: #fff; color: #17171c; }
.secondary-action { border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.82); }
.hero-actions button:hover { transform: translateY(-2px); }
.secondary-action:hover { border-color: rgba(255, 255, 255, 0.42); background: rgba(255, 255, 255, 0.12); }

.hero-proof {
  align-self: end;
  display: grid;
  gap: 1px;
  min-width: 168px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
}

.proof-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 13px 15px;
  background: rgba(13, 13, 20, 0.56);
}

.proof-item strong { font-size: 18px; font-weight: 650; }
.proof-item span { color: rgba(255, 255, 255, 0.46); font-size: 11px; }

.forum-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 278px;
  gap: 18px;
  align-items: start;
}

.forum-main { min-width: 0; }
.feed-toolbar, .rail-card { border: 1px solid var(--border-color); background: var(--surface-solid); }

.feed-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 16px 24px;
  margin-bottom: 12px;
  padding: 18px 20px 0;
  border-radius: 16px;
}

.toolbar-heading { display: flex; align-items: flex-start; gap: 12px; }
.toolbar-eyebrow { margin-top: 5px; color: var(--forum-violet); writing-mode: vertical-rl; }
.toolbar-heading h2 { margin: 0; color: var(--text-primary); font-size: 18px; font-weight: 650; }
.toolbar-heading p { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; }
.search-input { align-self: center; }
.search-input :deep(.el-input__wrapper) { border-radius: 10px; box-shadow: 0 0 0 1px var(--border-color) inset; }
.forum-tabs { grid-column: 1 / -1; min-width: 0; }
.forum-tabs :deep(.el-tabs__header) { margin: 0; }
.forum-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: var(--border-color); }
.forum-tabs :deep(.el-tabs__item) { height: 42px; color: var(--text-secondary); font-size: 13px; }
.forum-tabs :deep(.el-tabs__item.is-active), .forum-tabs :deep(.el-tabs__item:hover) { color: var(--forum-violet); }
.forum-tabs :deep(.el-tabs__active-bar) { background: var(--forum-violet); }

.post-list { min-height: 280px; }

.post-card {
  --cat-color: #95a0b2;
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 10px;
  padding: 18px 20px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 15px;
  background: var(--surface-solid);
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.post-card::before { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--cat-color); content: ''; }
.post-card:hover { border-color: color-mix(in srgb, var(--cat-color) 55%, var(--border-color)); transform: translateY(-2px); }
.post-card:hover .open-icon { color: var(--cat-color); transform: translateX(3px); }
.post-card.cat-course { --cat-color: #5c7cfa; }
.post-card.cat-exam { --cat-color: #8b5cf6; }
.post-card.cat-contest { --cat-color: #f59e0b; }
.post-card.cat-help { --cat-color: #ef5b5b; }
.post-card.cat-other { --cat-color: #8492a6; }

.author-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid color-mix(in srgb, var(--cat-color) 30%, var(--border-color));
  border-radius: 13px;
  background: color-mix(in srgb, var(--cat-color) 12%, var(--surface-muted));
  color: var(--cat-color);
  font-size: 15px;
  font-weight: 700;
}

.post-body { min-width: 0; }
.post-card-head, .post-footer, .post-author-line, .post-metrics { display: flex; align-items: center; }
.post-card-head, .post-footer { justify-content: space-between; gap: 14px; }
.post-labels { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }

.post-type, .category-label, .course-code, .attachment-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
}

.post-type { padding: 5px 8px; font-weight: 700; }
.type-resource { background: rgba(92, 124, 250, 0.12); color: #5c7cfa; }
.type-help { background: rgba(239, 91, 91, 0.12); color: #e74b4b; }
.type-quote { background: var(--surface-muted); color: var(--text-secondary); }
.category-label { color: var(--text-secondary); }
.course-code { padding: 4px 7px; background: var(--forum-violet-soft); color: var(--forum-violet); }
.post-time { flex-shrink: 0; color: var(--text-secondary); font-size: 11px; }

.post-title {
  margin: 10px 0 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-summary {
  display: -webkit-box;
  margin: 7px 0 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.quote-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  overflow: hidden;
  border-left: 2px solid var(--cat-color);
  border-radius: 0 8px 8px 0;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-footer { margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--border-color); }
.post-author-line { gap: 8px; min-width: 0; color: var(--text-secondary); font-size: 12px; }
.attachment-pill { gap: 4px; padding: 4px 7px; background: var(--surface-muted); color: var(--text-secondary); }
.post-metrics { flex-shrink: 0; gap: 14px; color: var(--text-secondary); font-size: 12px; }
.post-metrics span { display: inline-flex; align-items: center; gap: 4px; }
.open-icon { margin-left: 2px; transition: color 0.18s ease, transform 0.18s ease; }

.empty-feed {
  display: flex;
  min-height: 310px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 16px;
  background: var(--surface-solid);
  text-align: center;
}

.empty-mark { display: flex; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 18px; background: var(--forum-violet-soft); color: var(--forum-violet); font-size: 24px; }
.empty-feed h3 { margin: 14px 0 0; color: var(--text-primary); font-size: 16px; }
.empty-feed p { margin: 7px 0 16px; color: var(--text-secondary); font-size: 12px; }
.pager { display: flex; justify-content: center; margin: 18px 0 6px; }

.forum-rail { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
.rail-card { padding: 18px; border-radius: 16px; }
.rail-eyebrow { color: var(--forum-violet); }
.rail-card h3 { margin: 8px 0 0; color: var(--text-primary); font-size: 15px; font-weight: 650; }

.create-card {
  overflow: hidden;
  background: radial-gradient(circle at 100% 0, rgba(109, 92, 231, 0.17), transparent 36%), var(--surface-solid);
}

.create-card > p { margin: 8px 0 15px; color: var(--text-secondary); font-size: 12px; line-height: 1.65; }

.create-card button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--forum-violet);
  border-radius: 10px;
  background: var(--forum-violet);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.create-card .help-button { margin-top: 8px; border-color: var(--border-color); background: var(--surface-muted); color: var(--text-primary); }
.rail-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rail-title-row h3 { margin: 0; }
.rail-title-row > span { color: var(--text-secondary); font-size: 11px; }

.category-row {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  gap: 9px;
  align-items: center;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: left;
}

.category-row:hover, .category-row.active { background: var(--surface-muted); color: var(--text-primary); }
.category-row.active { font-weight: 600; }
.category-dot { width: 7px; height: 7px; border-radius: 50%; background: #95a0b2; }
.dot-course { background: #5c7cfa; }
.dot-exam { background: #8b5cf6; }
.dot-contest { background: #f59e0b; }
.dot-help { background: #ef5b5b; }
.dot-mine { background: #35b77b; }

.feature-card { display: flex; flex-direction: column; gap: 15px; }
.feature-row { display: grid; grid-template-columns: 34px 1fr; gap: 10px; }
.feature-icon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: var(--forum-violet-soft); color: var(--forum-violet); }
.feature-row strong { display: block; color: var(--text-primary); font-size: 12px; }
.feature-row p { margin: 3px 0 0; color: var(--text-secondary); font-size: 11px; line-height: 1.5; }

.mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }

.mode-switch button {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 11px;
  align-items: center;
  padding: 13px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-solid);
  color: var(--text-primary);
  text-align: left;
}

.mode-switch button.active { border-color: var(--forum-violet); background: var(--forum-violet-soft); }
.mode-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 11px; background: rgba(92, 124, 250, 0.13); color: #5c7cfa; font-size: 18px; }
.mode-icon.help { background: rgba(239, 91, 91, 0.12); color: #e74b4b; }
.mode-switch strong, .mode-switch small { display: block; }
.mode-switch strong { font-size: 13px; }
.mode-switch small { margin-top: 4px; color: var(--text-secondary); font-size: 11px; }

.compose-tip { display: flex; align-items: flex-start; gap: 7px; margin-bottom: 16px; padding: 10px 12px; border-radius: 10px; background: var(--surface-muted); color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.compose-tip .el-icon { flex-shrink: 0; margin-top: 2px; color: var(--forum-violet); }
.post-form :deep(.el-form-item__label) { color: var(--text-primary); font-size: 12px; font-weight: 600; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid :deep(.el-select) { width: 100%; }
.attach-box { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: 9px; }
.attach-chips { display: flex; width: 100%; flex-wrap: wrap; gap: 8px; }

.attach-chip {
  display: inline-grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  max-width: 280px;
  padding: 7px 8px;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-size: 12px;
}

.chip-ext { padding: 3px 5px; border-radius: 5px; background: var(--forum-violet-soft); color: var(--forum-violet); font-size: 9px; font-weight: 700; }
.chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-chip button { display: flex; padding: 0; border: 0; background: transparent; color: var(--text-secondary); }

.attach-picker-button { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 13px; border: 1px solid var(--forum-violet); border-radius: 9px; background: var(--forum-violet-soft); color: var(--forum-violet); font-size: 12px; font-weight: 600; }
.attach-hint { display: flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: 11px; }
.dialog-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.draft-state { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 11px; }
.draft-state button { padding: 0; border: 0; background: transparent; color: var(--forum-violet); font-size: 11px; }
.footer-actions { display: flex; flex-shrink: 0; gap: 8px; }

.picker-search { margin-bottom: 8px; }
.picker-hint { margin-bottom: 10px; color: var(--text-secondary); font-size: 11px; }
.picker-list { max-height: 360px; overflow-y: auto; }
.picker-item {
  display: grid;
  grid-template-columns: auto 42px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  line-height: 1.4 !important;
  margin-bottom: 6px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
}

.picker-item:hover, .picker-item.picked { border-color: color-mix(in srgb, var(--forum-violet) 45%, var(--border-color)); background: var(--forum-violet-soft); }
.picker-ext { padding: 4px 6px; border-radius: 5px; background: var(--surface-muted); color: var(--text-secondary); font-size: 9px; font-weight: 700; text-align: center; }
.picker-name { min-width: 0; overflow: hidden; color: var(--text-primary, #172033); font-size: 12px; font-weight: 500; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.picker-size, .picked-count { color: var(--text-secondary); font-size: 11px; }

@media (max-width: 1120px) {
  .forum-workspace { grid-template-columns: minmax(0, 1fr); }
  .forum-rail { position: static; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 820px) {
  .forum-hero { grid-template-columns: 1fr; padding: 30px; }
  .hero-proof { grid-template-columns: repeat(3, 1fr); min-width: 0; }
  .proof-item { flex-direction: column; align-items: flex-start; gap: 2px; }
  .feed-toolbar { grid-template-columns: 1fr; }
  .search-input, .forum-tabs { grid-column: 1; }
  .forum-rail { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .forum-page { padding: 0; }
  .forum-hero { min-height: 0; padding: 24px 20px; border-radius: 16px; }
  .hero-copy h1 { font-size: 28px; }
  .hero-actions { flex-direction: column; }
  .hero-actions button { width: 100%; }
  .hero-proof { gap: 0; }
  .proof-item { padding: 10px; }
  .proof-item strong { font-size: 15px; }
  .feed-toolbar { padding: 16px 14px 0; }
  .toolbar-heading p { display: none; }
  .forum-tabs { overflow: hidden; }
  .post-card { grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 15px 13px 15px 16px; }
  .author-avatar { width: 34px; height: 34px; border-radius: 10px; }
  .post-time, .attachment-pill, .post-metrics span:first-child { display: none; }
  .post-footer { align-items: flex-end; }
  .mode-switch, .form-grid { grid-template-columns: 1fr; }
  .dialog-footer { align-items: flex-end; flex-direction: column; }
  .footer-actions { width: 100%; }
  .footer-actions .el-button { flex: 1; }
  .picker-item { grid-template-columns: auto 38px minmax(0, 1fr); }
  .picker-size { display: none; }
}
</style>
