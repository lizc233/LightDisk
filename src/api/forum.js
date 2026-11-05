import request from '@/utils/request'

/** 发帖（含求助帖、转发） */
export function createPost(data) {
  return request.post('/forum/create', data)
}

/** 删除自己的帖子 */
export function deletePost(postId) {
  return request.post('/forum/delete', { postId })
}

/** 首页推荐流 */
export function getFeed(data) {
  return request.post('/forum/feed', data)
}

/** 帖子详情 */
export function getPostDetail(postId) {
  return request.post('/forum/detail', { postId })
}

/** 评论列表 */
export function getComments(data) {
  return request.post('/forum/comment/list', data)
}

/** 发表评论 / 回复 */
export function addComment(data) {
  return request.post('/forum/comment/add', data)
}

/** 点赞 / 取消点赞 */
export function toggleLike(postId) {
  return request.post('/forum/like', { postId })
}

/** 收藏（附件自动转存到我的网盘）/ 取消收藏 */
export function toggleFavorite(postId) {
  return request.post('/forum/favorite', { postId })
}

/** 我网盘根目录的文件，用于选择附件 */
export function listMyFiles() {
  return request.post('/file/list', { folderId: 0, pageNum: 1, pageSize: 100 })
}
