import { pinyin } from 'pinyin-pro'

/**
 * 名称排序键（Windows 资源管理器风格：英文与汉字按拼音统一字母序混排）。
 *
 * 生成规则：
 *   1. 汉字 → 拼音（无声调、小写），如「第一天」→ "di yi tian"
 *   2. 其余字符（拉丁字母、数字、符号）原样小写保留
 *   3. 去掉空格后拼接，得到可直接参与字符串比较的键
 *
 * 因此 "Dance with me" → "dancewithme"，"第一天" → "diyitian"，
 * 排序结果：Dance... < 第一天 < Euphoria，符合用户要求的混排顺序。
 *
 * 纯数字/纯符号等无法转拼音的内容原样返回，且排在汉字与英文之前，
 * 与 Windows 的默认行为保持一致。
 */
export const nameSortKey = (name) => {
  const raw = String(name ?? '')
  if (!raw) return ''
  try {
    const py = pinyin(raw, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    // pinyin-pro 会把非中文片段原样保留在数组中，直接拼接即可
    return py.join('').replace(/\s+/g, '').toLowerCase()
  } catch (e) {
    return raw.toLowerCase()
  }
}

/**
 * 名称比较器：先按拼音键，键相同再按原始名称做稳定兜底，
 * 保证大小写/重名时排序结果稳定可预期。
 */
export const compareByName = (a, b) => {
  const ka = nameSortKey(a?.name)
  const kb = nameSortKey(b?.name)
  if (ka < kb) return -1
  if (ka > kb) return 1
  return String(a?.name || '').localeCompare(String(b?.name || ''))
}
