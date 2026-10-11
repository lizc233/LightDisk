/**
 * 轻量 Markdown 渲染（零依赖，编辑器 P3 用）
 *
 * 安全策略：先把整篇文本做 HTML 转义，再做 Markdown 语法替换，
 * 因此任何 <script> / onerror= 之类的内容都会被当成纯文本展示，不会被执行。
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMarkdown(text) {
  const src = escapeHtml(text).replace(/\r\n/g, '\n')

  // 先抽出代码块，避免块内内容被行内语法二次处理
  const codeBlocks = []
  let work = src.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(
      `<pre class="md-code"><code>${code.replace(/\n$/, '')}</code></pre>`
    )
    return `\u0000CODE${codeBlocks.length - 1}\u0000`
  })

  const lines = work.split('\n')
  const out = []
  let listType = null // 'ul' | 'ol'
  let inQuote = false

  const closeList = () => {
    if (listType) {
      out.push(listType === 'ul' ? '</ul>' : '</ol>')
      listType = null
    }
  }
  const closeQuote = () => {
    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }
  }

  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  for (const raw of lines) {
    const line = raw
    const codeMatch = line.match(/^\u0000CODE(\d+)\u0000$/)
    if (codeMatch) {
      closeList(); closeQuote()
      out.push(codeBlocks[Number(codeMatch[1])])
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList(); closeQuote()
      const level = heading[1].length
      out.push(`<h${level} class="md-h">${inline(heading[2])}</h${level}>`)
      continue
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      closeList(); closeQuote()
      out.push('<hr class="md-hr" />')
      continue
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul) {
      closeQuote()
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul' }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    if (ol) {
      closeQuote()
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol' }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    const quote = line.match(/^&gt;\s?(.*)$/)
    if (quote) {
      closeList()
      if (!inQuote) { out.push('<blockquote class="md-quote">'); inQuote = true }
      out.push(`<p>${inline(quote[1])}</p>`)
      continue
    }
    closeList(); closeQuote()
    if (line.trim() === '') {
      out.push('')
    } else {
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList(); closeQuote()

  return out
    .join('\n')
    .replace(/(\u0000CODE\d+\u0000)/g, '$1') // 兜底：未成对代码块占位符按原文展示
    .replace(/\u0000/g, '')
}
