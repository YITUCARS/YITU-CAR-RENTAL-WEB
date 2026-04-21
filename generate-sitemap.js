/**
 * generate-sitemap.js
 *
 * 自动从 src/data/blog-posts.json 读取所有博客 slug，
 * 扫描 src/app/blog/ 子目录（如果以后改为文件夹式路由），
 * 生成 public/sitemap.xml。
 *
 * 安装依赖（只需一次）:
 *   npm install sitemap
 *
 * 运行:
 *   node generate-sitemap.js
 *   npm run sitemap
 *
 * 新增博客文章的方式（二选一，推荐第一种）：
 *   1. 在 src/data/blog-posts.json 中加入一条记录
 *   2. 在 src/app/blog/<slug>/ 下新建 page.tsx（目录式路由）
 *   然后重新运行本脚本即可。
 */

const { SitemapStream, streamToPromise } = require('sitemap')
const { Readable } = require('stream')
const fs   = require('fs')
const path = require('path')

// ── 配置 ──────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.yiturentalcars.co.nz'
const LOCALES  = ['en', 'zh']

// 静态页面：path（无 locale）→ 优先级 + 更新频率
const STATIC_PAGES = [
  { path: '/',                changefreq: 'weekly',  priority: 1.0 },
  { path: '/fleet',           changefreq: 'weekly',  priority: 0.8 },
  { path: '/gallery',         changefreq: 'monthly', priority: 0.6 },
  { path: '/about',           changefreq: 'monthly', priority: 0.7 },
  { path: '/blog',            changefreq: 'weekly',  priority: 0.8 },
  { path: '/terms-conditions',changefreq: 'yearly',  priority: 0.3 },
  { path: '/privacy-policy',  changefreq: 'yearly',  priority: 0.3 },
  { path: '/wear-and-tear',   changefreq: 'yearly',  priority: 0.3 },
]

// ── 自动获取博客 slug ─────────────────────────────────────────────────────────
function scanBlogSlugs() {
  const slugSet = new Set()

  // 来源 1：src/data/blog-posts.json（主数据源）
  const jsonFile = path.join(__dirname, 'src', 'data', 'blog-posts.json')
  if (fs.existsSync(jsonFile)) {
    const posts = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
    posts.forEach(p => p.slug && slugSet.add(p.slug))
    console.log(`  [JSON] 读取 ${posts.length} 篇博客 from blog-posts.json`)
  }

  // 来源 2：src/app/blog/<slug>/page.tsx（目录式路由，未来扩展用）
  const blogAppDir = path.join(__dirname, 'src', 'app', 'blog')
  if (fs.existsSync(blogAppDir)) {
    const entries = fs.readdirSync(blogAppDir, { withFileTypes: true })
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('[') &&   // 排除 [slug] 动态路由文件夹本身
        !entry.name.startsWith('_') &&
        !entry.name.startsWith('.')
      ) {
        const hasPage = fs.existsSync(
          path.join(blogAppDir, entry.name, 'page.tsx')
        ) || fs.existsSync(
          path.join(blogAppDir, entry.name, 'page.jsx')
        )
        if (hasPage && !slugSet.has(entry.name)) {
          slugSet.add(entry.name)
          console.log(`  [目录] 发现新博客目录: /blog/${entry.name}`)
        }
      }
    }
  }

  return [...slugSet]
}

// ── 组装 URL 列表 ─────────────────────────────────────────────────────────────
function buildUrls(blogSlugs) {
  const urls = []

  // 根路径（不带 locale）
  urls.push({ url: '/', changefreq: 'weekly', priority: 1.0 })

  for (const locale of LOCALES) {
    for (const page of STATIC_PAGES) {
      urls.push({
        url: page.path === '/' ? `/${locale}` : `/${locale}${page.path}`,
        changefreq: page.changefreq,
        priority:   page.priority,
      })
    }

    for (const slug of blogSlugs) {
      urls.push({
        url:        `/${locale}/blog/${slug}`,
        changefreq: 'weekly',
        priority:   0.8,
      })
    }
  }

  return urls
}

// ── 生成 sitemap.xml ──────────────────────────────────────────────────────────
async function generate() {
  console.log('\n🗺  生成 sitemap.xml ...\n')

  const blogSlugs = scanBlogSlugs()
  console.log(`\n  共 ${blogSlugs.length} 篇博客 slug: ${blogSlugs.join(', ')}\n`)

  const urls = buildUrls(blogSlugs)

  const stream = new SitemapStream({ hostname: BASE_URL })
  const xml    = await streamToPromise(Readable.from(urls).pipe(stream))

  const outputPath = path.join(__dirname, 'public', 'sitemap.xml')
  fs.writeFileSync(outputPath, xml.toString())

  console.log(`✓ 输出: ${outputPath}`)
  console.log(`  共写入 ${urls.length} 个 URL\n`)
  urls.forEach(u => console.log(`    ${BASE_URL}${u.url}`))
  console.log('\n完成。将 sitemap 提交到 Google Search Console:')
  console.log(`  ${BASE_URL}/sitemap.xml\n`)
}

generate().catch(err => {
  console.error('生成失败:', err.message)
  process.exit(1)
})
