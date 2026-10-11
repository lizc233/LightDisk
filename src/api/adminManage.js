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
