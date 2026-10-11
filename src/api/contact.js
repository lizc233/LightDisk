import request from '@/utils/request'

// ==================== 用户搜索 ====================

/** 按 ID 或用户名搜索用户（最多 10 条，排除自己） */
export function searchUsers(keyword) {
  return request.get('/users/search', { params: { keyword }, silent: true })
}

// ==================== 联系人（单向） ====================

/** 我的联系人列表 */
export function getContacts() {
  return request.get('/contacts')
}

/** 添加联系人（幂等） */
export function addContact(data) {
  return request.post('/contacts', data)
}

/** 修改联系人备注 */
export function updateContactRemark(contactId, remark) {
  return request.put(`/contacts/${contactId}/remark`, { remark })
}

/** 移除联系人 */
export function removeContact(contactId) {
  return request.delete(`/contacts/${contactId}`)
}

// ==================== 黑名单 ====================

/** 我的黑名单 */
export function getBlocks() {
  return request.get('/contacts/blocks')
}

/** 拉黑某人（幂等） */
export function blockUser(userId) {
  return request.post(`/contacts/blocks/${userId}`)
}

/** 取消拉黑 */
export function unblockUser(userId) {
  return request.delete(`/contacts/blocks/${userId}`)
}
