<template>
  <div
    class="dropbox-container"
    @dragenter="onFileDragEnter"
    @dragover="onFileDragOver"
    @dragleave="onFileDragLeave"
    @drop="onFileDrop"
  >
    <!-- 全屏拖拽投放提示 -->
    <transition name="drop-fade">
      <div v-if="fileDragActive" class="drop-overlay">
        <div class="drop-overlay-card">
          <el-icon :size="40"><Upload /></el-icon>
          <p class="drop-title">松开即可上传</p>
          <p class="drop-sub">目标目录：{{ currentFolderName || '根目录' }}</p>
        </div>
      </div>
    </transition>
    <div class="sub-sidebar">
      <div class="sidebar-header">
        <h2 class="title">所有文件</h2>
      </div>
      <nav class="nav-group">
        <div class="nav-item" :class="{ active: currentCategory === 'all' && !isRecentMode && !activeFilterKey }" @click="switchCategory('all', false)">
          <el-icon><Folder /></el-icon>
          <span>全部文件</span>
        </div>
        <div class="nav-item" :class="{ active: isRecentMode && !activeFilterKey }" @click="switchCategory('all', true)">
          <el-icon><Clock /></el-icon>
          <span>最近使用</span>
        </div>
      </nav>

      <div class="nav-divider"></div>

      <div class="nav-section">
        <div class="nav-section-head">
          <h3 class="nav-label">快速筛选</h3>
          <button class="mini-btn" title="管理标签" @click="openTagManage">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
        <nav class="nav-group">
          <div
            v-for="entry in sidebarEntries"
            :key="entry.key"
            class="nav-item"
            :class="{ active: isEntryActive(entry), dragging: dragKey === entry.key }"
            draggable="true"
            @click="activateEntry(entry)"
            @dragstart="onDragStart(entry, $event)"
            @dragover.prevent
            @drop="onDrop(entry, $event)"
            @dragend="dragKey = null"
          >
            <el-icon v-if="entry.icon"><component :is="entry.icon" /></el-icon>
            <span v-else class="tag-dot" :style="{ background: entry.color }"></span>
            <span class="nav-text">{{ entry.label }}</span>
          </div>
        </nav>
      </div>
    </div>

    <div class="main-content">
      <header class="content-header">
        <div class="breadcrumb-wrap">
          <button
            v-for="item in breadcrumbs"
            :key="item.id"
            class="crumb-btn"
            :class="{ active: item.id === currentFolderId && !isRecentMode && currentCategory === 'all' }"
            @click="goToFolder(item.id)"
          >
            <span>{{ item.name }}</span>
            <el-icon v-if="item.id !== breadcrumbs[breadcrumbs.length - 1].id"><ArrowRight /></el-icon>
          </button>
        </div>

        <el-input
          v-model="searchQuery"
          placeholder="搜索当前列表..."
          class="search-input"
          :prefix-icon="Search"
          clearable
        />

        <el-select
          v-if="tags.length"
          v-model="uploadTagIds"
          multiple
          collapse-tags
          size="small"
          placeholder="上传后打标签"
          class="upload-tag-select"
        >
          <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </header>

      <div class="action-grid">
        <div class="action-tile light" @click="triggerUpload">
          <el-icon><Upload /></el-icon>
          <span>上传到当前目录</span>
        </div>
        <div class="action-tile light" @click="handleCreateFolder">
          <el-icon><FolderAdd /></el-icon>
          <span>新建文件夹</span>
        </div>
        <div class="action-tile light" :class="{ 'tile-active': batchMode }" @click="batchMode ? exitBatchMode() : enterBatchMode()">
          <el-icon><Select /></el-icon>
          <span>{{ batchMode ? '退出批量' : '批量下载' }}</span>
        </div>
        <!-- 一键入队：当前视图（文件夹 / 音频分类 / 搜索）下所有音频一次性加入播放列表 -->
        <div
          v-if="audioTracks.length"
          class="action-tile light"
          :title="`把当前列表里的 ${audioTracks.length} 个音频全部加入播放列表`"
          @click="playAllAudio"
        >
          <el-icon><Headset /></el-icon>
          <span>播放全部（{{ audioTracks.length }}）</span>
        </div>
      </div>

      <!-- 视图切换：仅在「图片」分类下出现 -->
      <div v-if="showViewToggle" class="list-toolbar">
        <span class="toolbar-label">展示方式</span>
        <div class="view-switch">
          <button class="view-btn" :class="{ on: listMode === 'grid' }" @click="setListMode('grid')">
            <el-icon><Grid /></el-icon>
            <span>缩略图</span>
          </button>
          <button class="view-btn" :class="{ on: listMode === 'detail' }" @click="setListMode('detail')">
            <el-icon><List /></el-icon>
            <span>详细列表</span>
          </button>
        </div>
      </div>

      <!-- 批量操作条 -->
      <div v-if="batchMode" class="batch-bar">
        <div class="batch-info">
          <el-icon><Select /></el-icon>
          <span>已选 <strong>{{ selected.length }}</strong> 项（星标位置已切换为多选框）</span>
        </div>
        <div class="batch-actions">
          <el-button size="small" @click="toggleSelectAllPage">
            {{ allPageSelected ? '取消全选' : '全选本页' }}
          </el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="!selected.length"
            @click="submitBatchDownload"
          >
            <el-icon><Download /></el-icon>&nbsp;批量下载
          </el-button>
          <el-button size="small" :disabled="!selected.length" @click="openBatchMoveDialog">批量移动</el-button>
          <el-button size="small" :disabled="!selected.length" @click="openBatchShareDialog">批量分享</el-button>
          <el-button size="small" type="danger" :disabled="!selected.length" @click="submitBatchDelete">批量删除</el-button>
          <el-button size="small" text @click="exitBatchMode">退出批量</el-button>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        multiple
        style="display: none"
        @change="handleFileUpload"
      />

      <div class="file-list-wrapper">
        <el-table
          v-if="listMode === 'detail'"
          :data="sortedTableData"
          class="custom-table"
          :default-sort="{ prop: 'name', order: nameSortOrder === 'desc' ? 'descending' : 'ascending' }"
          @sort-change="onNameSortChange"
          @row-click="handleRowClick"
        >
          <el-table-column prop="name" label="名称" min-width="280" sortable="custom">
            <template #header>
              <div class="name-header">
                <el-checkbox
                  v-if="batchMode"
                  :model-value="allPageSelected"
                  :indeterminate="somePageSelected"
                  @change="toggleSelectAllPage"
                />
                <span>名称</span>
              </div>
            </template>
            <template #default="{ row }">
              <div class="file-info-cell">
                <el-checkbox
                  v-if="batchMode"
                  class="select-checkbox"
                  :model-value="isSelected(row)"
                  @change="(checked) => toggleSelect(row, checked)"
                  @click.stop
                />
                <button
                  v-else-if="!row.isFolder"
                  class="star-btn"
                  :class="{ on: row.isFavorite }"
                  :title="row.isFavorite ? '取消收藏' : '收藏'"
                  @click.stop="toggleFavorite(row)"
                >
                  <el-icon><StarFilled v-if="row.isFavorite" /><Star v-else /></el-icon>
                </button>
                <img
                  v-if="isImageFile(row) && !failedThumbs[row.key]"
                  class="row-thumb"
                  :src="thumbUrl(row, 120)"
                  :alt="row.name"
                  @error="markThumbFailed(row.key)"
                  @click.stop="openGallery(row)"
                />
                <el-icon v-else class="file-icon" :size="24" :color="getIconColor(row)">
                  <component :is="getIconComponent(row)" />
                </el-icon>
                <span class="file-name">{{ row.name }}</span>
                <span
                  v-for="t in (row.tags || [])"
                  :key="t.id"
                  class="tag-chip"
                  :style="{ color: t.color, borderColor: t.color, background: t.color + '1A' }"
                >{{ t.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="date" label="修改时间" width="170" />

          <el-table-column
            prop="size"
            label="大小"
            width="120"
            align="right"
            sortable
            :sort-method="sizeSortMethod"
          >
            <template #default="{ row }">
              <span class="size-cell">{{ row.isFolder ? '—' : formatBytes(row.size) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="" width="300" align="right">
            <template #default="{ row }">
              <div class="premium-actions">
                <button class="action-btn" @click.stop="row.isFolder ? downloadFolder(row) : requestDownload(row, 'button')">
                  <el-icon><Download /></el-icon>
                  <span>下载</span>
                </button>

                <button
                  v-if="isAudioFile(row)"
                  class="action-btn"
                  title="加入播放列表（不打断当前播放）"
                  @click.stop="enqueueAudio(row)"
                >
                  <el-icon><Headset /></el-icon>
                  <span>加入列表</span>
                </button>

                <button class="action-btn" @click.stop="handleShare(row)">
                  <el-icon><Share /></el-icon>
                  <span>分享</span>
                </button>

                <button class="action-btn danger" @click.stop="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                  <span>删除</span>
                </button>

                <el-popover
                  placement="bottom-end"
                  trigger="hover"
                  :width="150"
                >
                  <template #reference>
                    <button class="action-btn more-btn" @click.stop>
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                  </template>

                  <button class="popover-action" @click.stop="openRenameDialog(row)">
                    <el-icon><EditPen /></el-icon>
                    <span>重命名</span>
                  </button>
                  <button class="popover-action" @click.stop="openMoveDialog(row)">
                    <el-icon><FolderOpened /></el-icon>
                    <span>移入文件夹</span>
                  </button>
                  <button v-if="!row.isFolder" class="popover-action" @click.stop="openTagPicker(row)">
                    <el-icon><CollectionTag /></el-icon>
                    <span>设置标签</span>
                  </button>
                </el-popover>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 缩略图（画廊）视图：图片分类专用，点击任意图片进入全屏画廊 -->
        <div v-else class="thumb-grid">
          <div
            v-for="row in displayTableData"
            :key="row.key"
            class="thumb-card"
            :class="{ selected: isSelected(row) }"
            @click="handleCardClick(row)"
          >
            <div class="thumb-media">
              <img
                v-if="isImageFile(row) && !failedThumbs[row.key]"
                :src="thumbUrl(row, 480)"
                :alt="row.name"
                loading="lazy"
                @error="markThumbFailed(row.key)"
              />
              <el-icon v-else :size="42" :color="getIconColor(row)">
                <component :is="getIconComponent(row)" />
              </el-icon>

              <el-checkbox
                v-if="batchMode"
                class="card-check"
                :model-value="isSelected(row)"
                @change="(checked) => toggleSelect(row, checked)"
                @click.stop
              />
              <button
                v-else
                class="card-star"
                :class="{ on: row.isFavorite }"
                :title="row.isFavorite ? '取消收藏' : '收藏'"
                @click.stop="toggleFavorite(row)"
              >
                <el-icon><StarFilled v-if="row.isFavorite" /><Star v-else /></el-icon>
              </button>
              <span v-if="isImageFile(row)" class="card-zoom">
                <el-icon><ZoomIn /></el-icon>
              </span>
            </div>
            <div class="thumb-name" :title="row.name">{{ row.name }}</div>
          </div>
          <div v-if="!displayTableData.length" class="thumb-empty">当前分类下还没有图片</div>
        </div>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :background="true"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>

    <!-- 在线文本编辑器 -->
    <TextEditorDialog v-model="editorVisible" :file-id="editorFileId" @saved="loadFileList" />
    <OfficePreviewDialog
      v-model="officeVisible"
      :file-id="officeFileId"
      :file-name="officeFileName"
      :kind="officeKind"
    />

    <el-dialog
      v-model="shareDialogVisible"
      title="分享文件"
      width="420px"
      class="custom-dialog"
      destroy-on-close
    >
      <div v-if="!shareResult" class="share-box">
        <p class="share-desc">链接有效期</p>
        <el-radio-group v-model="shareForm.expireDays" class="modern-radio">
          <el-radio-button :label="7">7天</el-radio-button>
          <el-radio-button :label="15">15天</el-radio-button>
          <el-radio-button :label="30">30天</el-radio-button>
        </el-radio-group>
      </div>

      <div v-else class="share-success">
        <el-result icon="success" title="分享链接已创建">
          <template #extra>
            <div class="copy-field">
              <el-input :model-value="shareResult.shareUrl" readonly>
                <template #append>
                  <el-button @click="copyText(shareResult.shareUrl)">复制链接</el-button>
                </template>
              </el-input>
            </div>
            <div class="extract-code-line">提取码：{{ shareResult.extractCode }}</div>
            <div class="share-copy-actions">
              <el-button text @click="copyShareMessage()">复制链接和提取码</el-button>
            </div>
          </template>
        </el-result>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="shareDialogVisible = false">关闭</el-button>
          <el-button v-if="!shareResult" type="primary" :loading="sharing" @click="createShareLink">创建分享</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重命名：只改用户视角的文件名，磁盘与存储位置完全不变 -->
    <el-dialog
      v-model="renameDialogVisible"
      :title="renameTarget?.isFolder ? '重命名文件夹' : '重命名文件'"
      width="440px"
      destroy-on-close
      @closed="onRenameDialogClosed"
    >
      <div class="rename-dialog-body">
        <p class="rename-tip">
          {{ renameTarget?.isFolder ? '仅修改文件夹名称，内部文件不受影响。' : '仅修改该文件在你网盘里的名称，存储位置与内容不变。' }}
        </p>
        <el-input
          ref="renameInputRef"
          v-model="renameValue"
          maxlength="255"
          show-word-limit
          placeholder="请输入新名称"
          @keyup.enter="submitRename"
        />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="renaming" :disabled="!renameValue.trim()" @click="submitRename">
            确认重命名
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="moveDialogVisible"
      :title="batchMoveMode ? '批量移动到文件夹' : '移入文件夹'"
      width="440px"
      destroy-on-close
    >
      <div class="move-dialog-body">
        <div class="move-current-file">
          <span class="move-label">{{ batchMoveMode ? '待移动' : '当前文件' }}</span>
          <strong>{{ batchMoveMode ? `已选 ${selected.length} 项` : (moveTargetFile?.name || '-') }}</strong>
        </div>

        <button
          class="root-folder-card"
          :class="{ active: moveTargetFolderId === 0 }"
          @click="selectMoveFolder(0)"
        >
          <el-icon><Folder /></el-icon>
          <span>全部文件</span>
        </button>

        <div v-if="folderTreeData.length" class="folder-tree-panel">
          <div class="move-label">已有文件夹</div>
          <el-tree
            ref="folderTreeRef"
            :data="folderTreeData"
            node-key="id"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            @node-click="handleFolderNodeClick"
          >
            <template #default="{ data }">
              <div class="folder-tree-node">
                <el-icon><Folder /></el-icon>
                <span>{{ data.label }}</span>
              </div>
            </template>
          </el-tree>
        </div>

        <el-empty v-else description="还没有可选文件夹，文件可以先留在全部文件中" :image-size="100" />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="moveDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="movingFile" @click="submitMoveFile">
            {{ batchMoveMode ? '确认批量移动' : '确认移入' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量分享：一次为多个文件生成链接，可一键复制全部 -->
    <el-dialog v-model="batchShareVisible" title="批量分享" width="560px" destroy-on-close>
      <div v-if="!batchShareResult" class="share-box">
        <p class="share-desc">将为选中的 {{ selectedFileIds.length }} 个文件各生成一条分享链接</p>
        <el-radio-group v-model="batchShareForm.expireDays" class="modern-radio">
          <el-radio-button :label="7">7天</el-radio-button>
          <el-radio-button :label="15">15天</el-radio-button>
          <el-radio-button :label="30">30天</el-radio-button>
        </el-radio-group>
      </div>

      <div v-else class="batch-share-result">
        <div class="batch-share-head">
          <span>已生成 {{ batchShareResult.length }} 条链接</span>
          <el-button size="small" text type="primary" @click="copyBatchShareMessage">复制全部</el-button>
        </div>
        <div class="batch-share-list">
          <div v-for="item in batchShareResult" :key="item.id" class="batch-share-row">
            <div class="batch-share-file" :title="item.fileName">{{ item.fileName }}</div>
            <div class="batch-share-link">
              <el-input :model-value="item.shareUrl" readonly size="small" />
              <span class="batch-share-code">提取码 {{ item.extractCode }}</span>
              <el-button size="small" text type="primary" @click="copyText(item.shareUrl)">复制</el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="batchShareVisible = false">关闭</el-button>
          <el-button v-if="!batchShareResult" type="primary" :loading="batchSharing" @click="submitBatchShare">
            生成链接
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 下载确认：点击文件行不再直接下载，先让用户确认 -->
    <el-dialog
      v-model="downloadConfirmVisible"
      title="下载确认"
      width="440px"
      destroy-on-close
      class="download-confirm-dialog"
    >
      <div class="download-confirm-body">
        <div class="download-file-card">
          <span class="download-file-icon">
            <el-icon :size="26" :color="getIconColor(downloadTarget || {})">
              <component :is="getIconComponent(downloadTarget || {})" />
            </el-icon>
          </span>
          <div class="download-file-meta">
            <div class="download-file-name" :title="downloadTarget?.name">{{ downloadTarget?.name }}</div>
            <div class="download-file-sub">
              <span>{{ formatBytes(downloadTarget?.size) }}</span>
              <span v-if="downloadExtText">·</span>
              <span v-if="downloadExtText">{{ downloadExtText }}</span>
            </div>
          </div>
        </div>

        <p class="download-tip">{{ downloadTipText }}</p>

        <el-checkbox v-model="downloadNoAskAgain" class="download-noask">
          以后点击文件直接下载，不再询问
        </el-checkbox>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="downloadConfirmVisible = false">取消</el-button>
          <el-button
            v-if="downloadCanPreview"
            text
            type="primary"
            @click="previewInsteadOfDownload"
          >
            改为在线预览
          </el-button>
          <el-button type="primary" @click="confirmDownload">确认下载</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 全屏图片画廊 -->
    <ImageGallery
      v-model="galleryVisible"
      :images="galleryImages"
      :start-index="galleryIndex"
    />

    <!-- 全屏视频播放器（Range 流式，可拖进度条 / 倍速 / 画中画 / 记忆续播） -->
    <VideoPlayer
      v-model="videoVisible"
      :file="videoFile"
      :playlist="videoPlaylist"
    />

    <!-- 标签管理（新建 / 改名 / 换色 / 删除） -->
    <el-dialog v-model="tagManageVisible" title="标签管理" width="520px" destroy-on-close>
      <div class="tag-manage-list">
        <div v-for="t in tags" :key="t.id" class="tag-manage-row">
          <el-color-picker v-model="t.color" size="small" :predefine="TAG_COLORS" @change="saveTag(t)" />
          <el-input v-model="t.name" size="small" maxlength="16" @keyup.enter="saveTag(t)" />
          <el-button size="small" text type="primary" @click="saveTag(t)">保存</el-button>
          <el-button size="small" text type="danger" @click="removeTag(t)">删除</el-button>
        </div>
        <div v-if="!tags.length" class="tag-empty">还没有标签，在下方创建第一个吧</div>
        <div class="tag-create-row">
          <el-color-picker v-model="newTagColor" size="small" :predefine="TAG_COLORS" />
          <el-input v-model="newTagName" size="small" maxlength="16" placeholder="新标签名称" @keyup.enter="createTag" />
          <el-button size="small" type="primary" :disabled="!newTagName.trim()" @click="createTag">创建</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 为文件设置标签 -->
    <el-dialog v-model="tagPickerVisible" :title="`设置标签：${tagPickerFile?.name || ''}`" width="420px" destroy-on-close>
      <div v-if="!tags.length" class="tag-empty">
        还没有标签，请先点侧边栏「快速筛选」旁的齿轮按钮创建。
      </div>
      <el-checkbox-group v-else v-model="tagPickerSelection">
        <div v-for="t in tags" :key="t.id" class="tag-picker-row">
          <el-checkbox :value="t.id">
            <span class="tag-chip" :style="{ color: t.color, borderColor: t.color, background: t.color + '1A' }">
              {{ t.name }}
            </span>
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="tagPickerVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagPickerSaving" @click="saveFileTags">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransferStore } from '@/stores/transfer'
import { CHUNK_THRESHOLD, ChunkUploader, isAbortError, uploadSmallFile } from '@/utils/uploader'
import { downloadWithProgress, pickSaveHandle, supportsFileSystemAccess } from '@/utils/downloader'
import TextEditorDialog from '@/components/TextEditorDialog.vue'
import OfficePreviewDialog from '@/components/OfficePreviewDialog.vue'
import ImageGallery from '@/components/ImageGallery.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { usePlayerStore, AUDIO_EXTS } from '@/stores/player'
import { buildAudioCoverUrl } from '@/api/audio'
import { formatBytes, fileExt } from '@/utils/format'
import { compareByName } from '@/utils/pinyinSort'
import {
  ArrowRight,
  Clock,
  CollectionTag,
  Delete,
  Document,
  Download,
  EditPen,
  Folder,
  FolderAdd,
  FolderOpened,
  Grid,
  Headset,
  List,
  MoreFilled,
  Picture,
  Search,
  Select,
  Setting,
  Share,
  Star,
  StarFilled,
  Upload,
  VideoCamera,
  ZoomIn
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const preferencesStore = usePreferencesStore()
const playerStore = usePlayerStore()
const transferStore = useTransferStore()

const searchQuery = ref('')
const tableData = ref([])
const allFolders = ref([])
const currentFolderId = ref(0)

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const currentCategory = ref('all')
const isRecentMode = ref(false)

// ===== 收藏 / 标签 / 快速筛选拖拽 =====
const TAG_COLORS = ['#0F6E56', '#2563eb', '#d85a30', '#993556', '#639922', '#ba7517', '#534AB7', '#888780']
const tags = ref([])                      // 我的标签 [{id,name,color,fileCount}]
const activeFilterKey = ref('')           // '' | 'fav' | 'tag:{id}'
const sidebarOrder = ref([])              // 快速筛选条目顺序 key 列表
const dragKey = ref('')
const tagManageVisible = ref(false)
const newTagName = ref('')
const newTagColor = ref(TAG_COLORS[0])
const tagPickerVisible = ref(false)
const tagPickerFile = ref(null)
const tagPickerSelection = ref([])
const tagPickerSaving = ref(false)
const uploadTagIds = ref([])

/** 快速筛选条目：内置类型 + 收藏 + 各标签，按用户拖拽顺序排列 */
const sidebarEntries = computed(() => {
  const entries = [
    { key: 'type:doc', type: 'type', label: '文档', icon: Document },
    { key: 'type:image', type: 'type', label: '图片', icon: Picture },
    { key: 'type:video', type: 'type', label: '视频', icon: VideoCamera },
    { key: 'type:audio', type: 'type', label: '音频', icon: Headset },
    { key: 'fav', type: 'fav', label: '收藏', icon: StarFilled },
    ...tags.value.map(t => ({ key: `tag:${t.id}`, type: 'tag', label: t.name, color: t.color, tagId: t.id }))
  ]
  const order = sidebarOrder.value
  const known = new Set(entries.map(e => e.key))
  const sorted = [
    ...order.filter(k => known.has(k)).map(k => entries.find(e => e.key === k)),
    ...entries.filter(e => !order.includes(e.key))
  ]
  return sorted
})

const isEntryActive = (entry) => {
  if (entry.type === 'type') {
    return currentCategory.value === entry.key.slice(5) && activeFilterKey.value === ''
  }
  return activeFilterKey.value === entry.key
}

const activateEntry = async (entry) => {
  if (entry.type === 'type') {
    activeFilterKey.value = ''
    await switchCategory(entry.key.slice(5), false)
    return
  }
  activeFilterKey.value = entry.key
  currentCategory.value = 'all'
  isRecentMode.value = true
  currentPage.value = 1
  listMode.value = 'detail'
  await goToFolder(0, { preserveFilters: true })
}

const onDragStart = (entry, event) => {
  dragKey.value = entry.key
  event.dataTransfer.effectAllowed = 'move'
  try {
    event.dataTransfer.setData('text/plain', entry.key)
  } catch (e) { /* IE 兼容忽略 */ }
}

const onDrop = async (targetEntry, event) => {
  event.preventDefault()
  const from = dragKey.value
  dragKey.value = null
  if (!from || from === targetEntry.key) return

  const keys = sidebarEntries.value.map(e => e.key)
  const fromIdx = keys.indexOf(from)
  const toIdx = keys.indexOf(targetEntry.key)
  if (fromIdx < 0 || toIdx < 0) return

  keys.splice(toIdx, 0, keys.splice(fromIdx, 1)[0])
  sidebarOrder.value = keys
  try {
    await request.post('/user/settings', { sidebarOrder: JSON.stringify(keys) })
  } catch (e) {
    /* 顺序保存失败不影响本地使用 */
  }
}

const loadTags = async () => {
  try {
    const res = await request.get('/file/tags')
    tags.value = res.data || []
  } catch (e) {
    tags.value = []
  }
}

const loadSidebarOrder = async () => {
  try {
    const res = await request.get('/user/settings')
    const raw = res.data?.sidebarOrder
    if (raw) sidebarOrder.value = JSON.parse(raw)
  } catch (e) {
    sidebarOrder.value = []
  }
}

const toggleFavorite = async (row) => {
  try {
    const res = await request.put(`/file/${row.id}/favorite`)
    row.isFavorite = res.data ? 1 : 0
    if (activeFilterKey.value === 'fav' && !row.isFavorite) {
      // 收藏视图里取消收藏 → 从列表中移除
      tableData.value = tableData.value.filter(item => item.id !== row.id)
      total.value = Math.max(total.value - 1, 0)
    }
  } catch (e) {
    /* 失败提示由全局拦截器处理 */
  }
}

const openTagManage = () => {
  newTagName.value = ''
  newTagColor.value = TAG_COLORS[0]
  tagManageVisible.value = true
}

const createTag = async () => {
  const name = newTagName.value.trim()
  if (!name) return
  try {
    const res = await request.post('/file/tags', { name, color: newTagColor.value })
    tags.value.push(res.data)
    newTagName.value = ''
    ElMessage.success('标签已创建')
  } catch (e) { /* 同名等错误由全局拦截器提示 */ }
}

const saveTag = async (t) => {
  if (!t.name.trim()) return
  try {
    await request.put(`/file/tags/${t.id}`, { name: t.name.trim(), color: t.color })
    ElMessage.success('标签已更新')
  } catch (e) { /* 同名等错误由全局拦截器提示 */ }
}

const removeTag = async (t) => {
  try {
    await ElMessageBox.confirm(`删除标签「${t.name}」？文件本身不受影响。`, '删除标签', { type: 'warning' })
  } catch { return }
  await request.delete(`/file/tags/${t.id}`)
  tags.value = tags.value.filter(item => item.id !== t.id)
  sidebarOrder.value = sidebarOrder.value.filter(k => k !== `tag:${t.id}`)
  if (activeFilterKey.value === `tag:${t.id}`) {
    activeFilterKey.value = ''
    await loadFileList()
  }
}

const openTagPicker = (row) => {
  tagPickerFile.value = row
  tagPickerSelection.value = (row.tags || []).map(t => t.id)
  tagPickerVisible.value = true
}

const saveFileTags = async () => {
  if (!tagPickerFile.value) return
  tagPickerSaving.value = true
  try {
    await request.post(`/file/${tagPickerFile.value.id}/tags`, { tagIds: tagPickerSelection.value })
    tagPickerFile.value.tags = tags.value
      .filter(t => tagPickerSelection.value.includes(t.id))
      .map(t => ({ id: t.id, name: t.name, color: t.color }))
    tagPickerVisible.value = false
    ElMessage.success('标签已更新')
  } finally {
    tagPickerSaving.value = false
  }
}

// ===== 图片画廊 + 缩略图视图 =====
const LIST_MODE_KEY = 'lightdisk.disk.listMode'
const listMode = ref(localStorage.getItem(LIST_MODE_KEY) || 'detail')      // detail | grid
const failedThumbs = reactive({})                                          // 缩略图 404 → 回落成图标
const galleryVisible = ref(false)
const galleryIndex = ref(0)

/** 「图片」分类下（或已切到缩略图视图时）才显示视图切换，避免无路可退 */
const showViewToggle = computed(() => currentCategory.value === 'image' || listMode.value === 'grid')

const setListMode = (mode) => {
  listMode.value = mode
  localStorage.setItem(LIST_MODE_KEY, mode)
}

const isImageFile = (row) => !row.isFolder && resolveFileCategory(row) === 'image'

const thumbUrl = (row, size = 240) => `/api/file/thumbnail/${row.id}?token=${getToken()}&size=${size}`

const markThumbFailed = (key) => {
  failedThumbs[key] = true
}

/** 当前列表里的所有图片 → 画廊数据源（左右切换只在图片之间进行） */
const galleryImages = computed(() => displayTableData.value
  .filter(row => isImageFile(row))
  .map(row => ({
    key: row.key,
    id: row.id,
    name: row.name,
    url: `/api/file/preview/${row.id}?token=${getToken()}`,
    thumbUrl: thumbUrl(row, 160)
  })))

const openGallery = (row) => {
  const list = galleryImages.value
  if (!list.length) return
  const idx = list.findIndex(item => item.key === row.key)
  galleryIndex.value = idx < 0 ? 0 : idx
  galleryVisible.value = true
}

const handleCardClick = (row) => {
  if (batchMode.value) {
    toggleSelect(row, !isSelected(row))
    return
  }
  if (isImageFile(row)) {
    openGallery(row)
    return
  }
  handleRowClick(row)
}

// ===== 视频播放器 / 音频播放条 =====
const videoVisible = ref(false)
const videoFile = ref(null)

const isVideoFile = (row) => !row.isFolder && resolveFileCategory(row) === 'video'
const isAudioFile = (row) => !row.isFolder && resolveFileCategory(row) === 'audio'

/** 列表行 → 播放器可消费的媒体项（带 token 的流式地址 + 可选内嵌封面） */
const toMediaItem = (row) => ({
  key: row.key,
  id: row.id,
  name: row.name,
  size: row.size,
  url: `/api/file/preview/${row.id}?token=${getToken()}`,
  // 音频内嵌封面（ID3 APIC）；无封面后端返回 404，前端 <img> 自动回落到音符图标
  coverUrl: isAudioFile(row) ? buildAudioCoverUrl(row.id) : ''
})

/**
 * 当前列表里的音频 → 播放条队列（决定「上一首 / 下一首」的范围）。
 * 直接采样 sortedTableData，与列表显示顺序（默认按名称拼音混排）保持一致。
 */
const audioTracks = computed(() => sortedTableData.value
  .filter(row => isAudioFile(row))
  .map(row => toMediaItem(row)))

/** 当前列表里的视频 → 播放器内可左右切换 */
const videoPlaylist = computed(() => sortedTableData.value
  .filter(row => isVideoFile(row))
  .map(row => toMediaItem(row)))

const playAudio = (row) => {
  const list = audioTracks.value
  const track = list.find(item => item.key === row.key) || toMediaItem(row)
  playerStore.playTrack(track, list.length ? list : [track])
}

/**
 * 一键入队：把当前视图里的音频整体加入播放列表并从第一首开始播放。
 * 范围由 audioTracks 决定 —— 即「当前文件夹 / 当前音频分类 / 当前搜索结果」。
 */
const playAllAudio = () => {
  const list = audioTracks.value
  if (!list.length) {
    ElMessage.info('当前列表没有音频文件')
    return
  }
  playerStore.playFromList(list, 0)
  ElMessage.success(`已加入播放列表 ${list.length} 首`)
}

/** 单首入队（不打断当前播放）：右键菜单用 */
const enqueueAudio = (row) => {
  playerStore.enqueue(toMediaItem(row))
  ElMessage.success('已加入播放列表')
}

const openVideo = (row) => {
  videoFile.value = toMediaItem(row)
  videoVisible.value = true
}

// ===== 批量操作 =====
const batchMode = ref(false)
const selected = ref([])
const batchMoveMode = ref(false)
const batchShareVisible = ref(false)
const batchSharing = ref(false)
const batchShareResult = ref(null)
const batchShareForm = reactive({ expireDays: 15 })

const selectedFileIds = computed(() => selected.value.filter(row => !row.isFolder).map(row => row.id))
const selectedFolderIds = computed(() => selected.value.filter(row => row.isFolder).map(row => row.id))
const isSelected = (row) => selected.value.some(item => item.key === row.key)
const allPageSelected = computed(() => displayTableData.value.length > 0
  && displayTableData.value.every(row => isSelected(row)))
const somePageSelected = computed(() => !allPageSelected.value
  && displayTableData.value.some(row => isSelected(row)))

const enterBatchMode = () => {
  batchMode.value = true
  selected.value = []
  ElMessage.info('已进入批量模式，勾选文件后可批量下载/移动/分享/删除')
}

const exitBatchMode = () => {
  batchMode.value = false
  selected.value = []
}

const toggleSelect = (row, checked) => {
  if (checked) {
    if (!isSelected(row)) selected.value = [...selected.value, row]
  } else {
    selected.value = selected.value.filter(item => item.key !== row.key)
  }
}

const toggleSelectAllPage = () => {
  selected.value = allPageSelected.value ? [] : [...displayTableData.value]
}

const stamp = () => {
  const d = new Date()
  const p = (n) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
// saveBlob 供后续可能的「导出」类需求复用（下载已改走传输列表，可显示进度）

const submitBatchDownload = async () => {
  if (!selected.value.length) {
    ElMessage.warning('请先勾选要下载的文件')
    return
  }
  if (preferencesStore.confirmBeforeDownload) {
    try {
      await ElMessageBox.confirm(
        `即将把选中的 ${selected.value.length} 项打包为 zip 下载，是否继续？`,
        '下载确认',
        { confirmButtonText: '确认下载', cancelButtonText: '取消', type: 'info' }
      )
    } catch (e) {
      return
    }
  }
  startDownload({
    url: '/api/file/batch-download',
    method: 'POST',
    body: JSON.stringify({
      fileIds: selectedFileIds.value,
      folderIds: selectedFolderIds.value
    }),
    headers: { 'Content-Type': 'application/json' },
    filename: `LightDisk_批量下载_${stamp()}.zip`
  })
}

/**
 * 文件夹一键下载：复用批量下载接口，由服务端递归展开目录并打包成 zip。
 * 相比逐文件下载，只建立一次连接且保留目录层级。
 */
const downloadFolder = async (row) => {
  if (preferencesStore.confirmBeforeDownload) {
    try {
      await ElMessageBox.confirm(
        `即将把文件夹「${row.name}」打包为 zip 下载，是否继续？`,
        '下载确认',
        { confirmButtonText: '确认下载', cancelButtonText: '取消', type: 'info' }
      )
    } catch (e) {
      return
    }
  }
  startDownload({
    url: '/api/file/batch-download',
    method: 'POST',
    body: JSON.stringify({ folderIds: [row.id] }),
    headers: { 'Content-Type': 'application/json' },
    filename: `${row.name}_${stamp()}.zip`
  })
}

const submitBatchDelete = async () => {
  if (!selected.value.length) return
  try {
    await ElMessageBox.confirm(
      `确认把选中的 ${selected.value.length} 项移入回收站吗？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '移入回收站', cancelButtonText: '取消' }
    )
  } catch { return }

  await request.put('/file/recycle/trash', {
    fileIds: selectedFileIds.value,
    folderIds: selectedFolderIds.value
  })
  ElMessage.success('已移入回收站')
  selected.value = []
  await loadFolderCatalog()
  await loadFileList()
}

const openBatchShareDialog = () => {
  if (!selectedFileIds.value.length) {
    ElMessage.warning('文件夹暂不支持分享，请勾选文件')
    return
  }
  batchShareResult.value = null
  batchShareForm.expireDays = Number(userStore.userInfo?.defaultShareExpireDays || 15)
  batchShareVisible.value = true
}

const submitBatchShare = async () => {
  batchSharing.value = true
  try {
    const res = await request.post('/share/batch-create', {
      fileIds: selectedFileIds.value,
      expireDays: batchShareForm.expireDays
    })
    batchShareResult.value = res.data || []
    ElMessage.success(`已生成 ${(res.data || []).length} 条分享链接`)
  } finally {
    batchSharing.value = false
  }
}

const copyBatchShareMessage = async () => {
  if (!batchShareResult.value?.length) return
  const text = batchShareResult.value
    .map(item => `${item.fileName}\n链接：${item.shareUrl}\n提取码：${item.extractCode}`)
    .join('\n\n')
  await copyText(text)
}

const shareDialogVisible = ref(false)
const sharing = ref(false)
const currentFile = ref(null)
const shareResult = ref(null)
const shareForm = reactive({ expireDays: 15 })

const fileInput = ref(null)
const moveDialogVisible = ref(false)
const movingFile = ref(false)
const moveTargetFile = ref(null)
const moveTargetFolderId = ref(0)
const folderTreeRef = ref(null)

const folderMap = computed(() => {
  const map = new Map()
  allFolders.value.forEach(folder => {
    map.set(folder.id, folder)
  })
  return map
})

const breadcrumbs = computed(() => {
  const items = [{ id: 0, name: '全部文件' }]
  let current = folderMap.value.get(currentFolderId.value)
  let guard = 0

  while (current && guard < 20) {
    items.splice(1, 0, { id: current.id, name: current.folderName })
    current = folderMap.value.get(current.parentId)
    guard++
  }

  return items
})

const displayTableData = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) {
    return tableData.value
  }
  return tableData.value.filter(item => item.name.toLowerCase().includes(keyword))
})

/** 大小列排序：按原始字节数比较（文件夹无 size，视为 0） */
const sizeSortMethod = (a, b) => Number(a.size || 0) - Number(b.size || 0)

/**
 * 名称列排序：Windows 风格「英文与汉字按拼音统一字母序混排」。
 * 文件夹恒排在文件之前（与默认列表习惯一致），组内再按拼音键比较。
 */
const nameSortMethod = (a, b) => {
  const fa = a?.isFolder ? 0 : 1
  const fb = b?.isFolder ? 0 : 1
  if (fa !== fb) return fa - fb
  return compareByName(a, b)
}

/**
 * 名称排序偏好（持久化）。
 * 音频列表默认按名称拼音升序排列（与 Windows 文件夹一致，方便找歌），
 * 用户点击表头切换升/降序后记住选择；其它分类默认跟随后端顺序（更新时间倒序）。
 */
const SORT_KEY = 'lightdisk.disk.sort'
const readSortPref = () => {
  try {
    const p = JSON.parse(localStorage.getItem(SORT_KEY) || '{}')
    return {
      audio: p.audio === 'desc' ? 'desc' : 'asc',
      other: p.other === 'asc' ? 'asc' : (p.other === 'desc' ? 'desc' : '')
    }
  } catch (e) {
    return { audio: 'asc', other: '' }
  }
}
const sortPref = reactive(readSortPref())

const useNameSort = computed(() =>
  currentCategory.value === 'audio' ? sortPref.audio !== '' : sortPref.other !== '')
const nameSortOrder = computed(() =>
  currentCategory.value === 'audio' ? (sortPref.audio || 'asc') : (sortPref.other || 'asc'))

/** 表头点击：在「升序 / 降序 / 取消」间切换并持久化 */
const onNameSortChange = ({ order }) => {
  const key = currentCategory.value === 'audio' ? 'audio' : 'other'
  if (order === 'ascending') sortPref[key] = 'asc'
  else if (order === 'descending') sortPref[key] = 'desc'
  else sortPref[key] = currentCategory.value === 'audio' ? 'asc' : ''
  try { localStorage.setItem(SORT_KEY, JSON.stringify(sortPref)) } catch (e) { /* 忽略 */ }
}

/** 数据源：按偏好决定是否本地按名称排序（叠加搜索过滤） */
const sortedTableData = computed(() => {
  const list = displayTableData.value
  if (!useNameSort.value) return list
  const dir = nameSortOrder.value === 'desc' ? -1 : 1
  return list.slice().sort((a, b) => nameSortMethod(a, b) * dir)
})

const folderTreeData = computed(() => buildFolderTree(allFolders.value))

const parseFolderId = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

const syncCurrentFolderFromRoute = () => {
  currentFolderId.value = parseFolderId(route.query.folderId)
}

const formatTime = (value) => {
  if (!value) return '未知时间'
  if (typeof value === 'string') {
    return value.replace('T', ' ').substring(0, 19)
  }
  if (Array.isArray(value)) {
    const [y, m, d, h, min] = value
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(min || 0).padStart(2, '0')}`
  }
  return new Date(value).toLocaleString()
}

const buildFolderTree = (folders) => {
  const nodes = folders.map(folder => ({
    id: folder.id,
    label: folder.folderName,
    parentId: folder.parentId,
    children: []
  }))
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const roots = []

  nodes.forEach(node => {
    const parent = nodeMap.get(node.parentId)
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

const loadFolderCatalog = async () => {
  const res = await request.get('/folder/all')
  allFolders.value = res.data || []

  if (currentFolderId.value !== 0 && !folderMap.value.has(currentFolderId.value)) {
    ElMessage.warning('目标文件夹不存在，已返回全部文件')
    await goToFolder(0)
  }
}

const loadFileList = async () => {
  try {
    const tagFilterKey = activeFilterKey.value.startsWith('tag:') ? activeFilterKey.value : ''
    const res = await request.post('/file/list', {
      folderId: currentFolderId.value,
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      category: currentCategory.value,
      isRecent: isRecentMode.value,
      favorite: activeFilterKey.value === 'fav' || undefined,
      tagId: tagFilterKey ? Number(tagFilterKey.slice(4)) : undefined
    })

    total.value = res.data.total
    tableData.value = (res.data.records || []).map(item => ({
      id: item.id,
      // 文件与文件夹可能同 id，用前缀拼出稳定且唯一的选择键
      key: (item.type === 'folder' ? 'd' : 'f') + item.id,
      name: item.name,
      type: item.type,
      size: item.size,
      ext: item.ext,
      date: formatTime(item.updateTime),
      isFavorite: item.isFavorite === 1,
      tags: item.tags || [],
      isFolder: item.type === 'folder'
    }))
  } catch (error) {
    console.error('加载文件列表失败:', error)
  }
}

const goToFolder = async (folderId, options = {}) => {
  const { preserveFilters = false } = options
  if (!preserveFilters) {
    currentCategory.value = 'all'
    isRecentMode.value = false
    activeFilterKey.value = ''
  }

  const targetQuery = folderId ? { folderId: String(folderId) } : {}
  if (String(route.query.folderId || '') === String(targetQuery.folderId || '')) {
    currentFolderId.value = folderId
    currentPage.value = 1
    await loadFileList()
    return
  }

  await router.push({
    name: 'Disk',
    query: targetQuery
  })
}

const switchCategory = async (category, recent) => {
  currentCategory.value = category
  isRecentMode.value = recent
  activeFilterKey.value = ''
  currentPage.value = 1
  // 缩略图视图只在「图片」分类下有意义，切走时回到详细列表
  if (category !== 'image' || recent) {
    listMode.value = 'detail'
  }

  if (category !== 'all' || recent) {
    await goToFolder(0, { preserveFilters: true })
    return
  }

  await goToFolder(0, { preserveFilters: true })
}

const handleSizeChange = async (value) => {
  pageSize.value = value
  currentPage.value = 1
  await loadFileList()
}

const handleCurrentChange = async (value) => {
  currentPage.value = value
  await loadFileList()
}

const getToken = () => localStorage.getItem('token') || localStorage.getItem('satoken') || ''

const handleRowClick = async (row) => {
  if (batchMode.value) {
    toggleSelect(row, !isSelected(row))
    return
  }

  if (row.isFolder) {
    currentCategory.value = 'all'
    isRecentMode.value = false
    await goToFolder(row.id)
    return
  }

  // 图片 → 全屏画廊（跟随用户设置的图片打开方式）
  if (isImageFile(row) && resolveOpenAction(row) === 'preview') {
    openGallery(row)
    return
  }

  // 音频 → 底部常驻播放条（流式播放，不下载）
  if (isAudioFile(row) && resolveOpenAction(row) === 'preview') {
    playAudio(row)
    return
  }

  // 视频 → 全屏播放器（支持 Range，可拖进度条）
  if (isVideoFile(row) && resolveOpenAction(row) === 'preview') {
    openVideo(row)
    return
  }

  // 文本类文件 → 在线编辑器（txt/md/json/csv 等，后端白名单 + 2MB 限制）
  if (isTextEditable(row)) {
    editorFileId.value = row.id
    editorVisible.value = true
    return
  }

  const action = resolveOpenAction(row)
  if (action === 'download') {
    requestDownload(row, 'row')
    return
  }

  // docx → 前端 docx-preview 在线预览；doc → 后端 POI 解析后在线预览
  const ext = (row.name || '').split('.').pop().toLowerCase()
  if (ext === 'docx' || ext === 'doc') {
    officeFileId.value = row.id
    officeFileName.value = row.name
    officeKind.value = ext
    officeVisible.value = true
    return
  }

  ElMessage.info('正在加载预览...')
  if (!isBrowserPreviewable(row)) {
    ElMessage.warning('当前浏览器无法直接预览该文档，已切换为下载')
    requestDownload(row, 'unpreviewable')
    return
  }

  const token = getToken()
  window.open(`/api/file/preview/${row.id}?token=${token}`, '_blank')
}

const handleDownload = (row) => {
  if (row.isFolder) {
    ElMessage.warning('文件夹暂不支持直接下载')
    return
  }
  startDownload({
    url: `/api/file/download/${row.id}`,
    filename: row.name,
    size: row.size || 0
  })
}

// ===== 下载确认窗口 =====
// 场景：点击文件行 / 点下载按钮 / 无法在线预览回退时，都不再静默下载，
// 先弹窗告知将要下载的文件并让用户确认；用户勾选「不再询问」后走直连下载。
const downloadConfirmVisible = ref(false)
const downloadTarget = ref(null)
const downloadReason = ref('row')       // row | button | unpreviewable
const downloadNoAskAgain = ref(false)

const downloadExtText = computed(() => {
  const row = downloadTarget.value
  if (!row) return ''
  const ext = (row.ext || fileExt(row.name) || '').toUpperCase()
  return ext ? `${ext} 文件` : '未知类型'
})

const downloadTipText = computed(() => {
  const name = downloadTarget.value?.name || '该文件'
  if (downloadReason.value === 'unpreviewable') {
    return `[${name}] 无法在当前浏览器中在线预览，是否下载到本地查看？`
  }
  if (downloadReason.value === 'row') {
    return `即将开始下载 [${name}]。若不是你想打开的文件，可以取消。`
  }
  return `即将开始下载 [${name}]。`
})

const downloadCanPreview = computed(() => {
  const row = downloadTarget.value
  return !!row && isBrowserPreviewable(row)
})

/** 统一的下载入口：按用户偏好决定是直接下载还是先弹确认 */
const requestDownload = (row, reason = 'row') => {
  if (!row || row.isFolder) {
    ElMessage.warning('文件夹暂不支持直接下载')
    return
  }
  if (!preferencesStore.confirmBeforeDownload) {
    handleDownload(row)
    return
  }
  downloadTarget.value = row
  downloadReason.value = reason
  downloadNoAskAgain.value = false
  downloadConfirmVisible.value = true
}

const confirmDownload = () => {
  const row = downloadTarget.value
  if (downloadNoAskAgain.value) {
    preferencesStore.setConfirmBeforeDownload(false)
    ElMessage.info('已关闭下载询问，可在「设置 → 文件打开偏好」中重新开启')
  }
  downloadConfirmVisible.value = false
  if (row) handleDownload(row)
}

const previewInsteadOfDownload = () => {
  const row = downloadTarget.value
  downloadConfirmVisible.value = false
  if (!row) return
  if (isImageFile(row)) {
    openGallery(row)
    return
  }
  const token = getToken()
  window.open(`/api/file/preview/${row.id}?token=${token}`, '_blank')
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要把 [${row.name}] 移入回收站吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await request.put('/file/recycle/trash', {
      fileIds: row.isFolder ? [] : [row.id],
      folderIds: row.isFolder ? [row.id] : []
    })
    ElMessage.success('已移入回收站')
    await loadFolderCatalog()
    await loadFileList()
  }).catch(() => {})
}

const handleShare = (row) => {
  if (row.isFolder) {
    ElMessage.warning('文件夹暂不支持分享')
    return
  }
  currentFile.value = row
  shareResult.value = null
  shareForm.expireDays = Number(userStore.userInfo?.defaultShareExpireDays || 15)
  shareDialogVisible.value = true
}

const createShareLink = async () => {
  sharing.value = true
  try {
    const res = await request.post('/share/create', {
      fileId: currentFile.value.id,
      expireDays: shareForm.expireDays
    })
    shareResult.value = res.data
    ElMessage.success('分享创建成功')
  } finally {
    sharing.value = false
  }
}

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    ElMessage.success('复制成功')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const copyShareMessage = async () => {
  if (!shareResult.value) return
  const text = `分享文件：${currentFile.value?.name || shareResult.value.fileName}\n链接：${shareResult.value.shareUrl}\n提取码：${shareResult.value.extractCode}`
  await copyText(text)
}

const getIconComponent = (row) => {
  if (row.isFolder) return Folder
  if (!row.name) return Document
  const ext = row.name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return Picture
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return VideoCamera
  if (AUDIO_EXTS.includes(ext)) return Headset
  return Document
}

const resolveFileCategory = (row) => {
  if (row.isFolder || !row.name) return 'other'
  const ext = row.name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video'
  if (AUDIO_EXTS.includes(ext)) return 'audio'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) return 'doc'
  return 'other'
}

// ===== 在线文本编辑器 =====
const editorVisible = ref(false)
const editorFileId = ref(null)

// ===== Word 预览（docx 前端渲染 / doc 后端解析）=====
const officeVisible = ref(false)
const officeFileId = ref(null)
const officeFileName = ref('')
const officeKind = ref('docx')
const TEXT_EDITABLE_EXTS = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'ini', 'conf', 'properties', 'html', 'css', 'js', 'sql', 'bat', 'sh']

const isTextEditable = (row) => {
  if (row.isFolder || !row.name) return false
  const ext = row.name.split('.').pop().toLowerCase()
  return TEXT_EDITABLE_EXTS.includes(ext)
}

const resolveOpenAction = (row) => {
  const category = resolveFileCategory(row)
  const info = userStore.userInfo || {}
  if (category === 'image') return info.imageOpenAction || 'preview'
  if (category === 'video') return info.videoOpenAction || 'preview'
  if (category === 'audio') return info.audioOpenAction || 'preview'
  if (category === 'doc') return info.docOpenAction || 'download'
  return info.otherOpenAction || 'download'
}

const isBrowserPreviewable = (row) => {
  if (row.isFolder || !row.name) return false
  const ext = row.name.split('.').pop().toLowerCase()
  return [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    'mp4', 'avi', 'mov', 'mkv', 'webm',
    ...AUDIO_EXTS,
    'pdf', 'txt', 'md'
  ].includes(ext)
}

const getIconColor = (row) => {
  if (row.isFolder) return '#FFCA28'
  if (!row.name) return '#909399'
  const ext = row.name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '#F56C6C'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return '#409EFF'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return '#67C23A'
  if (AUDIO_EXTS.includes(ext)) return '#8E44AD'
  return '#909399'
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleCreateFolder = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '文件夹名称不能为空'
    })

    await request.post('/folder/create', {
      name: value.trim(),
      parentId: currentFolderId.value
    })

    ElMessage.success('文件夹创建成功')
    await loadFolderCatalog()
    await loadFileList()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error('创建文件夹失败:', error)
    }
  }
}

// ===== 上传：拖拽 / 多选，大文件自动走分片 =====
const fileDragActive = ref(false)
let dragDepth = 0

const hasDraggedFiles = (event) => {
  const types = event.dataTransfer && event.dataTransfer.types
  return !!types && Array.from(types).indexOf('Files') >= 0
}

const onFileDragEnter = (event) => {
  if (!hasDraggedFiles(event)) return
  dragDepth += 1
  fileDragActive.value = true
}

const onFileDragOver = (event) => {
  if (!hasDraggedFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

const onFileDragLeave = (event) => {
  if (!hasDraggedFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) fileDragActive.value = false
}

const onFileDrop = (event) => {
  dragDepth = 0
  fileDragActive.value = false
  if (!hasDraggedFiles(event)) return
  event.preventDefault()
  const files = Array.from((event.dataTransfer && event.dataTransfer.files) || [])
  if (files.length) uploadFiles(files)
}

const currentFolderName = computed(() => {
  if (!currentFolderId.value) return '根目录'
  const list = breadcrumbs.value || []
  const last = list[list.length - 1]
  return (last && last.name) || '当前目录'
})

const uploaderOwnerId = () =>
  userStore.userInfo?.id || userStore.userInfo?.userId || userStore.userInfo?.uid || 'anon'

/** 多个任务几乎同时完成时，合并成一次列表刷新 */
let listRefreshTimer = null
const scheduleListRefresh = () => {
  clearTimeout(listRefreshTimer)
  listRefreshTimer = setTimeout(() => {
    loadFileList()
  }, 450)
}

const handleFileUpload = (event) => {
  const input = event.target
  const files = Array.from(input.files || [])
  if (!files.length) return
  uploadFiles(files)
  // 上传流程仍在引用这些 File 对象，稍后再重置 input，避免底层数据被过早释放
  setTimeout(() => {
    try { input.value = '' } catch (e) { /* 忽略 */ }
  }, 3000)
}

/**
 * 上传入口：每个文件建一条传输任务，并立刻把浮层打开让用户看到进度。
 * 小文件直传，大文件走「分片 + 断点续传 + 秒传」链路。
 */
const uploadFiles = (files) => {
  const owner = uploaderOwnerId()
  if (owner === 'anon') {
    ElMessage.warning('登录信息异常，请重新登录后再上传')
    return
  }
  files.forEach((file) => {
    const chunky = file.size >= CHUNK_THRESHOLD && preferencesStore.enableChunkUpload
    const task = transferStore.addTask({
      kind: 'upload',
      name: file.name,
      size: file.size,
      pausable: chunky
    })
    runUpload(file, task.id)
  })
  transferStore.panelVisible = true
  if (files.length > 1) {
    ElMessage.info(`已加入上传队列：${files.length} 个文件`)
  }
}

const runUpload = async (file, taskId) => {
  const useChunk = file.size >= CHUNK_THRESHOLD && preferencesStore.enableChunkUpload
  transferStore.patchTask(taskId, { status: 'running', loaded: 0, error: '', phase: '', speed: 0, finishedAt: null })
  const onProgress = (loaded) => transferStore.reportProgress(taskId, loaded)

  try {
    let result
    if (!useChunk) {
      transferStore.setPhase(taskId, '直传')
      const { promise, abort } = uploadSmallFile(file, {
        folderId: currentFolderId.value,
        onProgress
      })
      transferStore.registerControl(taskId, {
        cancel: () => abort(),
        retry: () => runUpload(file, taskId)
      })
      result = await promise
    } else {
      transferStore.setPhase(taskId, '准备中')
      const uploader = new ChunkUploader({
        file,
        folderId: currentFolderId.value,
        userId: uploaderOwnerId(),
        onProgress,
        onPhase: (phase, ratio) => {
          if (phase === 'hashing') {
            transferStore.setPhase(taskId, `计算校验值 ${Math.round((ratio || 0) * 100)}%`)
          } else if (phase === 'init') {
            transferStore.setPhase(taskId, '建立上传会话')
          } else if (phase === 'uploading') {
            transferStore.setPhase(taskId, '并发上传分片')
          } else if (phase === 'merging') {
            transferStore.setPhase(taskId, '服务端合并校验')
          }
        }
      })
      transferStore.registerControl(taskId, {
        pause: () => uploader.pause(),
        resume: () => uploader.resume(),
        cancel: () => uploader.cancel(),
        retry: () => runUpload(file, taskId)
      })
      result = await uploader.start()
    }

    // 上传后自动打上工具栏选择的标签
    if (uploadTagIds.value.length && result && result.fileId) {
      try {
        await request.post(`/file/${result.fileId}/tags`, { tagIds: uploadTagIds.value })
      } catch (e) { /* 打标失败不阻断上传流程 */ }
    }
    transferStore.finishTask(taskId, { fileId: result && result.fileId, instant: !!(result && result.instant) })
    scheduleListRefresh()
  } catch (error) {
    if (isAbortError(error)) return
    console.error('上传失败:', error)
    transferStore.failTask(taskId, (error && error.message) || '上传失败')
  }
}

// ===== 下载：走传输列表，可看进度、可取消 =====
/** 大文件改用 File System Access API 边下边写盘，避免整体读进内存 */
const STREAM_WRITE_THRESHOLD = 512 * 1024 * 1024

const authHeaderValue = () => {
  const token = getToken()
  if (!token) return ''
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const startDownload = (options) => {
  const task = transferStore.addTask({
    kind: 'download',
    name: options.filename,
    size: options.size || 0
  })
  transferStore.panelVisible = true
  runDownload(options, task.id)
}

const runDownload = async (options, taskId) => {
  const controller = new AbortController()
  transferStore.patchTask(taskId, { status: 'running', loaded: 0, error: '', phase: '', speed: 0, finishedAt: null })
  transferStore.registerControl(taskId, {
    cancel: () => controller.abort(),
    retry: () => runDownload(options, taskId)
  })
  try {
    let handle = null
    if ((options.size || 0) >= STREAM_WRITE_THRESHOLD && supportsFileSystemAccess()) {
      handle = await pickSaveHandle(options.filename)
      if (!handle) {
        // 用户取消选择保存位置 → 放弃本次下载
        transferStore.cancelTask(taskId)
        return
      }
    }
    await downloadWithProgress({
      url: options.url,
      method: options.method || 'GET',
      body: options.body || null,
      filename: options.filename,
      total: options.size || 0,
      handle,
      headers: { ...(options.headers || {}), Authorization: authHeaderValue() },
      signal: controller.signal,
      onProgress: (loaded) => transferStore.reportProgress(taskId, loaded)
    })
    transferStore.finishTask(taskId)
    ElMessage.success(`「${options.filename}」下载完成`)
  } catch (error) {
    if (isAbortError(error)) return
    console.error('下载失败:', error)
    transferStore.failTask(taskId, (error && error.message) || '下载失败')
  }
}

const openMoveDialog = async (row) => {
  batchMoveMode.value = false
  moveTargetFile.value = row
  moveTargetFolderId.value = currentFolderId.value
  moveDialogVisible.value = true
  await loadFolderCatalog()
  await nextTick()
  folderTreeRef.value?.setCurrentKey(moveTargetFolderId.value)
}

// ===== 重命名（只改用户视角的名称，不碰磁盘与存储位置）=====
const renameDialogVisible = ref(false)
const renameTarget = ref(null)
const renameValue = ref('')
const renaming = ref(false)
const renameInputRef = ref(null)

const openRenameDialog = (row) => {
  renameTarget.value = row
  renameValue.value = row.name || ''
  renameDialogVisible.value = true
  nextTick(() => {
    renameInputRef.value?.focus()
    nextTick(() => renameInputRef.value?.select?.())
  })
}

const onRenameDialogClosed = () => {
  renameTarget.value = null
  renameValue.value = ''
}

const submitRename = async () => {
  const row = renameTarget.value
  if (!row) return
  const name = renameValue.value.trim()
  if (!name) {
    ElMessage.warning('名称不能为空')
    return
  }
  if (name === row.name) {
    renameDialogVisible.value = false
    return
  }
  renaming.value = true
  try {
    if (row.isFolder) {
      await request.put(`/folder/${row.id}/rename`, { name })
    } else {
      await request.put(`/file/${row.id}/rename`, { name })
    }
    ElMessage.success('重命名成功')
    renameDialogVisible.value = false
    scheduleListRefresh()
  } catch (e) {
    // 后端已给出明确原因（重名 / 含非法字符等），直接透出
    ElMessage.error((e && e.message) || '重命名失败')
  } finally {
    renaming.value = false
  }
}

const openBatchMoveDialog = async () => {
  if (!selected.value.length) return
  batchMoveMode.value = true
  moveTargetFile.value = null
  moveTargetFolderId.value = currentFolderId.value
  moveDialogVisible.value = true
  await loadFolderCatalog()
  await nextTick()
  folderTreeRef.value?.setCurrentKey(currentFolderId.value || null)
}

const selectMoveFolder = (folderId) => {
  moveTargetFolderId.value = folderId
  if (folderId === 0) {
    folderTreeRef.value?.setCurrentKey(null)
  } else {
    folderTreeRef.value?.setCurrentKey(folderId)
  }
}

const handleFolderNodeClick = (data) => {
  moveTargetFolderId.value = data.id
}

const submitMoveFile = async () => {
  if (batchMoveMode.value) {
    if (!selected.value.length) return
    movingFile.value = true
    try {
      const res = await request.put('/file/batch/move', {
        fileIds: selectedFileIds.value,
        folderIds: selectedFolderIds.value,
        folderId: moveTargetFolderId.value
      })
      ElMessage.success(`已移动 ${res.data || 0} 项`)
      moveDialogVisible.value = false
      selected.value = []
      await loadFolderCatalog()
      await loadFileList()
    } finally {
      movingFile.value = false
    }
    return
  }

  if (!moveTargetFile.value) return

  movingFile.value = true
  try {
    await request.put(`/file/${moveTargetFile.value.id}/move`, null, {
      params: {
        folderId: moveTargetFolderId.value
      }
    })
    ElMessage.success('文件已移入目标文件夹')
    moveDialogVisible.value = false
    await loadFileList()
  } finally {
    movingFile.value = false
  }
}

watch(() => route.query.folderId, async () => {
  syncCurrentFolderFromRoute()
  currentPage.value = 1
  await loadFileList()
}, { immediate: true })

onMounted(async () => {
  syncCurrentFolderFromRoute()
  await loadFolderCatalog()
  loadTags()
  loadSidebarOrder()
})
</script>

<style scoped>
.dropbox-container {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--surface-solid);
}

/* ===== 拖拽上传提示层 ===== */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 163, 127, 0.08);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.drop-overlay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 54px;
  border-radius: 18px;
  border: 2px dashed var(--accent);
  background: var(--surface-solid);
  color: var(--accent);
  box-shadow: var(--shadow-soft);
}

.drop-title {
  font-size: 16px;
  font-weight: 600;
}

.drop-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.drop-fade-enter-active,
.drop-fade-leave-active {
  transition: opacity 0.16s ease;
}

.drop-fade-enter-from,
.drop-fade-leave-to {
  opacity: 0;
}

.sub-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface-muted);
  border-right: 1px solid var(--border-color);
  padding: 32px 16px;
  overflow-y: auto;
}

.title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 24px;
  padding-left: 12px;
}

.nav-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 24px 0 12px 12px;
  text-transform: uppercase;
}

.nav-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 4px;
}

.nav-section-head .nav-label {
  flex: 1;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.mini-btn:hover {
  background: var(--surface-strong);
  color: var(--accent);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s;
}

.nav-item[draggable='true'] {
  cursor: grab;
}

.nav-item.dragging {
  opacity: 0.45;
}

.tag-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 4px;
}

.nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--surface-strong);
}

.nav-item.active {
  background: #0061fe;
  color: #fff;
}

.nav-divider {
  height: 1px;
  background: var(--border-color);
  margin: 20px 12px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 36px 16px;
  overflow: hidden;
  min-height: 0;
}

/* 面包屑 / 搜索 / 上传按钮固定不动，只有文件列表区域滚动 */
.content-header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.breadcrumb-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.crumb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s ease;
}

.crumb-btn:hover {
  background: var(--accent-soft);
  color: #0061fe;
}

.crumb-btn.active {
  background: var(--accent-soft);
  color: #0061fe;
  font-weight: 600;
}

.search-input {
  max-width: 560px;
}

:deep(.search-input .el-input__wrapper) {
  background: var(--surface-muted);
  border-radius: 24px;
  box-shadow: none !important;
  border: 1px solid transparent;
}

:deep(.search-input .el-input__wrapper:hover) {
  border-color: #0061fe;
}

.action-grid {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.action-tile {
  width: 160px;
  height: 92px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  cursor: pointer;
  transition: 0.2s;
}

.action-tile.light {
  border: 1px solid #e6e9eb;
}

.action-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.file-list-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--surface-solid);
  padding: 4px 18px 0;
}

.file-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.file-name {
  line-height: 1.4;
}

/* 收藏星标 */
.star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.star-btn:hover {
  background: var(--surface-strong);
  color: #f7b955;
  transform: scale(1.1);
}

.star-btn.on {
  color: #f7b955;
}

/* 文件标签 chip */
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.6;
  white-space: nowrap;
}

/* 上传后打标签选择器 */
.upload-tag-select {
  width: 170px;
  flex-shrink: 0;
}

/* 标签管理弹窗 */
.tag-manage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tag-manage-row,
.tag-create-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-manage-row .el-input {
  flex: 1;
}

.tag-create-row {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.tag-create-row .el-input {
  flex: 1;
}

.tag-empty {
  padding: 12px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.tag-picker-row {
  padding: 2px 0;
}

.custom-table {
  --el-table-header-text-color: var(--text-secondary);
}

.premium-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

:deep(.el-table__row:hover .premium-actions) {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(0, 97, 254, 0.08);
  color: #0061fe;
}

.action-btn.danger:hover {
  background: rgba(250, 75, 75, 0.08);
  color: #fa4b4b;
}

.more-btn {
  padding: 6px 8px;
}

.popover-action {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  border: none;
  background: transparent;
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.popover-action:hover {
  background: #eef4ff;
  color: #0061fe;
}

:deep(.el-table td.el-table__cell),
:deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: var(--surface-muted);
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  /* 负外边距把遮盖面撑满列表容器整个宽度与底边，行内容不会从边缘漏出 */
  margin: 6px -18px 0;
  padding: 18px 18px 16px;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: var(--surface-solid);
  border-radius: 0 0 13px 13px;
}

/* 分页条上方的渐隐遮罩：让被盖住的前一行以淡出方式收尾，而不是硬切 */
.pagination-container::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -28px;
  height: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--surface-solid) 78%);
  pointer-events: none;
}

.extract-code-line {
  margin-top: 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.share-copy-actions {
  margin-top: 8px;
}

:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background-color: #0061fe;
}

.move-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rename-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rename-tip {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.move-current-file {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-muted);
}

.move-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.root-folder-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: 0.2s ease;
}

.root-folder-card:hover,
.root-folder-card.active {
  border-color: #0061fe;
  background: #eef4ff;
  color: #0061fe;
}

.folder-tree-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
}

.folder-tree-node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* ===== 批量模式 / 视图切换 / 缩略图 ===== */

.action-tile.tile-active {
  border-color: #0061fe;
  background: #eef4ff;
  color: #0061fe;
}

.list-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.toolbar-label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.view-switch {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border-radius: 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.view-btn:hover {
  color: #0061fe;
}

.view-btn.on {
  background: var(--surface-solid);
  color: #0061fe;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 97, 254, 0.28);
  background: linear-gradient(90deg, rgba(0, 97, 254, 0.08), rgba(0, 97, 254, 0.02));
  flex-shrink: 0;
}

.batch-info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.batch-info strong {
  color: #0061fe;
}

.batch-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.name-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.select-checkbox {
  width: 26px;
  margin-right: 2px;
  flex-shrink: 0;
}

.row-thumb {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  cursor: zoom-in;
  background: var(--surface-muted);
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 16px;
  padding: 16px 2px 8px;
}

.thumb-card {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--surface-solid);
  cursor: pointer;
  transition: all 0.2s ease;
}

.thumb-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 97, 254, 0.42);
}

.thumb-card.selected {
  border-color: #0061fe;
  box-shadow: 0 0 0 2px rgba(0, 97, 254, 0.18);
}

.thumb-media {
  position: relative;
  height: 136px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-muted);
  overflow: hidden;
}

.thumb-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-star,
.card-check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
}

.card-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  color: #c8ccd4;
  cursor: pointer;
  transition: all 0.18s ease;
}

.card-star:hover,
.card-star.on {
  color: #f7b955;
}

.card-check {
  padding: 4px 6px;
}

.card-zoom {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.thumb-card:hover .card-zoom {
  opacity: 1;
}

.thumb-name {
  padding: 9px 11px;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-empty {
  grid-column: 1 / -1;
  padding: 60px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* 下载确认弹窗 */
.download-confirm-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.download-file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.download-file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--surface-solid);
}

.download-file-meta {
  min-width: 0;
}

.download-file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-file-sub {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.download-tip {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.download-noask {
  align-self: flex-start;
}

/* 列表：文件大小列 */
.size-cell {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 批量分享结果 */
.batch-share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.batch-share-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-share-row {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.batch-share-file {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-share-link {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-share-code {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
