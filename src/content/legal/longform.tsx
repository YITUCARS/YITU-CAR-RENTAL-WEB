import fs from 'node:fs'
import path from 'node:path'

export interface LegalSection {
  id: string
  title: string
  content: React.ReactNode
}

export interface LegalTocLink {
  id: string
  label: string
}

interface SectionDefinition {
  id: string
  title: string
  start: string
  end?: string
}

const SUBHEADING_PATTERNS = [
  /^什么是/,
  /^谁/,
  /^何时/,
  /^签署/,
  /^简而言之/,
  /^租赁期是多久/,
  /^重要提示/,
  /^附加驾驶员/,
  /^您对附加驾驶员及乘客的责任/,
  /^增加额外驾驶员需要付费吗/,
  /^第三方中介/,
  /^会员计划/,
  /^企业客户/,
  /^费用与收费/,
  /^释义/,
  /^优先顺序/,
  /^授权驾驶员确认书/,
  /^其他未经授权的使用/,
  /^您的车辆保养义务/,
  /^车辆数据的传输/,
  /^路边援助/,
  /^清洁/,
  /^如何归还车辆/,
  /^提早归还/,
  /^延迟归还/,
  /^燃油服务费/,
  /^何时不需要支付燃油服务费/,
  /^您何时需要承担责任/,
  /^您何时无需承担责任/,
  /^免责条款何时适用/,
  /^免责条款不适用的情形/,
  /^在雪地驾驶/,
  /^发生事故时怎么办/,
  /^付款争议/,
  /^退款/,
  /^卡手续费/,
  /^终止/,
  /^车辆内财物/,
  /^争议解决/,
  /^适用法律与管辖权/,
  /^商品及服务税/,
  /^隐私/,
  /^入门指南$/,
  /^租车服务$/,
  /^常客租赁计划$/,
  /^承保产品$/,
  /^车辆数据$/,
  /^照片与视频$/,
  /^在线数据$/,
  /^在线广告$/,
  /^市场营销$/,
  /^分析工具$/,
  /^儿童$/,
  /^信息共享$/,
  /^您的选择$/,
  /^安全保障$/,
  /^信息保留$/,
  /^国际数据传输$/,
  /^您的隐私权$/,
  /^各国数据控制方及联系方式$/,
  /^主要联系方式$/,
]

function normalizeText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim()
}

function extractTextSection(text: string, start: string, end?: string) {
  const startIndex = text.indexOf(start)
  if (startIndex === -1) {
    return ''
  }

  const fromStart = text.slice(startIndex)
  if (!end) {
    return fromStart.trim()
  }

  const endIndex = fromStart.indexOf(end)
  if (endIndex === -1) {
    return fromStart.trim()
  }

  return fromStart.slice(0, endIndex).trim()
}

function isBulletLine(line: string) {
  return /^(?:[a-z]\.|[0-9]+\.)\s+/.test(line) || /^[•·-]\s+/.test(line)
}

function cleanBullet(line: string) {
  return line.replace(/^(?:[a-z]\.|[0-9]+\.)\s+/, '').replace(/^[•·-]\s+/, '').trim()
}

function isSubheading(line: string) {
  if (!line || /@|https?:\/\/|^\+?\d[\d\s]+$/.test(line)) {
    return false
  }

  return SUBHEADING_PATTERNS.some((pattern) => pattern.test(line)) || (line.length <= 22 && !/[。；：:]$/.test(line))
}

export function readLegalText(fileName: string) {
  return normalizeText(fs.readFileSync(path.join(process.cwd(), 'src/content/legal', fileName), 'utf8'))
}

export function buildLongformSections(text: string, definitions: SectionDefinition[]): LegalSection[] {
  return definitions.map((definition) => ({
    id: definition.id,
    title: definition.title,
    content: <LongformLegalText text={extractTextSection(text, definition.start, definition.end)} />,
  }))
}

export function buildTocLinks(definitions: SectionDefinition[]): LegalTocLink[] {
  return definitions.map(({id, title}) => ({id, label: title}))
}

export function LongformLegalText({text}: {text: string}) {
  const lines = normalizeText(text).split('\n')
  const nodes: React.ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    if (isBulletLine(line)) {
      const items: string[] = []
      while (index < lines.length) {
        const bulletLine = lines[index].trim()
        if (!bulletLine) {
          index += 1
          break
        }
        if (!isBulletLine(bulletLine)) {
          break
        }
        items.push(cleanBullet(bulletLine))
        index += 1
      }

      nodes.push(
        <ul key={`list-${index}`} className="list-disc pl-5 space-y-2 text-[14px] text-muted mb-4">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (isSubheading(line)) {
      nodes.push(
        <h3 key={`heading-${index}`} className="font-syne font-bold text-[15px] text-navy mt-6 mb-2">
          {line}
        </h3>
      )
      index += 1
      continue
    }

    const paragraphLines = [line]
    index += 1

    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (!nextLine || isBulletLine(nextLine) || isSubheading(nextLine)) {
        break
      }
      paragraphLines.push(nextLine)
      index += 1
    }

    const paragraphText = paragraphLines.join(' ')
    if (paragraphText.includes('\t')) {
      nodes.push(
        <pre
          key={`pre-${index}`}
          className="whitespace-pre-wrap break-words rounded-[10px] bg-off-white border border-black/10 p-4 text-[13px] text-muted mb-4"
        >
          {paragraphText}
        </pre>
      )
      continue
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="text-[14.5px] text-muted leading-[1.8] mb-4">
        {paragraphText}
      </p>
    )
  }

  return <>{nodes}</>
}
