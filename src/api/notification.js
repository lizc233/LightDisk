import request from '@/utils/request'

// ==================== 管理员：公告管理 ====================

/** 分页查询公告列表 */
export function getAdminAnnouncementList(data) {
  return request.post('/admin/announcements/page', data)
}

/** 创建公告 */
export function createAnnouncement(data) {
  return request.post('/admin/announcements', data)
}

/** 编辑公告 */
export function updateAnnouncement(data) {
  return request.put('/admin/announcements', data)
}

/** 删除公告 */
export function deleteAnnouncement(id) {
  return request.delete(`/admin/announcements/${id}`)
}

/** 置顶/取消置顶 */
export function toggleAnnouncementTop(id) {
  return request.put(`/admin/announcements/${id}/top`)
}

// ==================== 用户端：侧边栏公告 ====================

/** 获取侧边栏轮播公告（后台接口，失败静默） */
export function getSidebarAnnouncements() {
  return request.get('/announcements/sidebar', { silent: true })
}

/** 获取最近公告+系统通知（混合，置顶优先，默认3条，失败静默） */
export function getRecentAnnouncements(limit = 3) {
  return request.get('/announcements/recent', { params: { limit }, silent: true })
}

// ==================== 用户端：通知中心（铃铛） ====================

/** 获取未读统计（30s 轮询，失败静默） */
export function getUnreadCount() {
  return request.get('/notifications/unread-count', { silent: true })
}

/** 获取合并通知列表 */
export function getNotificationList(params) {
  return request.get('/notifications', { params })
}

/** 标记系统通知为已读 */
export function markAnnouncementRead(announcementId) {
  return request.put(`/notifications/${announcementId}/read`)
}

/** 标记个人消息为已读 */
export function markMessageRead(messageId) {
  return request.put(`/notifications/message/${messageId}/read`)
}

/** 一键全部已读 */
export function markAllRead() {
  return request.put('/notifications/read-all')
}

// ==================== 个人消息 ====================

/**
 * 获取个人消息列表
 * @param {{pageNum?:number,pageSize?:number,group?:'all'|'contact'|'stranger'}} params
 */
export function getMessageList(params) {
  return request.get('/messages', { params })
}

/**
 * 发送私信（管理员与普通用户通用）
 * @param {{receiverIds:string,title:string,content:string,autoAddContact?:boolean,attachments?:string}} data
 * attachments: JSON 数组字符串 [{fileId,name,size,type}]
 */
export function sendPersonalMessage(data) {
  return request.post('/messages/send', data)
}

/** 删除个人消息 */
export function deleteMessage(messageId) {
  return request.delete(`/messages/${messageId}`)
}
