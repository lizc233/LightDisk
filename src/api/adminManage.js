import request from '@/utils/request'

/**
 * 管理员专用接口（后端 /api/admin/** 已有拦截器二次鉴权）
 */

// 按用户名/邮箱模糊搜索用户（发通知选人等场景，最多10条）
export function adminSearchUsers(keyword) {
  return request.get('/admin/users/search', { params: { keyword } })
}

// VIP 等级选项（level / levelName / maxSpace）
export function getAdminVipOptions() {
  return request.get('/admin/vip-options')
}

// 仅超级管理员：添加用户
export function adminAddUser(data) {
  return request.post('/admin/users/add', data)
}

// 仅超级管理员：修改用户身份 0-用户 1-管理员 2-超级管理员
export function adminUpdateUserRole(data) {
  return request.post('/admin/users/role/update', data)
}

// ==================== 批量操作 ====================

/** 批量启用/禁用：{ userIds, status } */
export function adminBatchUserStatus(data) {
  return request.post('/admin/users/batch/status', data)
}

/** 批量调整会员等级：{ userIds, role, durationDays } */
export function adminBatchUserVip(data) {
  return request.post('/admin/users/batch/vip', data)
}

/** 仅超级管理员：批量添加用户：{ users: [{username,password,email,vipRole,isAdmin}] } */
export function adminBatchAddUsers(data) {
  return request.post('/admin/users/batch/add', data)
}

/** 仅超级管理员：批量注销用户（级联清理其网盘数据） */
export function adminBatchDeleteUsers(data) {
  return request.post('/admin/users/batch/delete', data)
}

// ==================== 分享审核 ====================

/** 全站分享分页（分享审核）：{ username, keyword, status, onlyExpired, page, pageSize } */
export function getAdminSharePage(data) {
  return request.post('/admin/audit/shares', data)
}

/** 批量驳回分享：{ shareIds, reason } */
export function rejectAdminShares(data) {
  return request.post('/admin/audit/shares/batch-reject', data)
}

/** 审计日志导出地址（浏览器直接另存，token 走查询参数） */
export function buildAuditExportUrl(params, format) {
  const query = new URLSearchParams()
  Object.keys(params || {}).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') query.append(key, value)
  })
  query.append('format', format)
  query.append('token', localStorage.getItem('token') || localStorage.getItem('satoken') || '')
  return `/api/admin/audit/export?${query.toString()}`
}

/** 我的操作记录导出地址 */
export function buildOperationLogExportUrl(params, format) {
  const query = new URLSearchParams()
  Object.keys(params || {}).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') query.append(key, value)
  })
  query.append('format', format)
  query.append('token', localStorage.getItem('token') || localStorage.getItem('satoken') || '')
  return `/api/operation-log/export?${query.toString()}`
}
