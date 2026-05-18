import {
  readLegalText,
  type LegalSection,
  type LegalTocLink,
} from './longform'

interface SectionDefinition {
  id: string
  title: string
  start: string
  end?: string
}

const TERMS_TEXT = readLegalText('terms-conditions.zh.txt')

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 'rental-contract',
    title: '1. 租赁合同',
    start: '1 租赁合同',
    end: '2 租赁期',
  },
  {
    id: 'rental-period',
    title: '2. 租赁期',
    start: '2 租赁期',
    end: '3 费用、收费与付款',
  },
  {
    id: 'costs-charges-payment',
    title: '3. 费用、收费与付款',
    start: '3 费用、收费与付款',
    end: '4 违规事项',
  },
  {
    id: 'infringement-offences',
    title: '4. 违规事项',
    start: '4 违规事项',
    end: '5 损坏保障与损坏责任费（DLF）的支付',
  },
  {
    id: 'damage-cover-dlf',
    title: '5. 损坏保障与损坏责任费（DLF）的支付',
    start: '5 损坏保障与损坏责任费（DLF）的支付',
    end: '6 损坏保障排除事项',
  },
  {
    id: 'damage-cover-exclusions',
    title: '6. 损坏保障排除事项',
    start: '6 损坏保障排除事项',
    end: '7 客户自有保险',
  },
  {
    id: 'customer-own-insurance',
    title: '7. 客户自有保险',
    start: '7 客户自有保险',
    end: '8 您的责任',
  },
  {
    id: 'your-responsibilities',
    title: '8. 您的责任',
    start: '8 您的责任',
    end: '9 本公司的责任',
  },
  {
    id: 'our-responsibilities',
    title: '9. 本公司的责任',
    start: '9 本公司的责任',
    end: '10 道路救援、故障、事故与维修',
  },
  {
    id: 'roadside-assistance',
    title: '10. 道路救援、故障、事故与维修',
    start: '10 道路救援、故障、事故与维修',
    end: '11 租赁合同结束',
  },
  {
    id: 'end-of-rental-contract',
    title: '11. 租赁合同结束',
    start: '11 租赁合同结束',
    end: '12 租赁合同终止',
  },
  {
    id: 'termination',
    title: '12. 租赁合同终止',
    start: '12 租赁合同终止',
    end: '13 适用法律',
  },
  {
    id: 'applicable-law',
    title: '13. 适用法律',
    start: '13 适用法律',
    end: '14 争议解决',
  },
  {
    id: 'dispute-resolution',
    title: '14. 争议解决',
    start: '14 争议解决',
    end: '15 隐私政策',
  },
  {
    id: 'privacy-policy',
    title: '15. 隐私政策',
    start: '15 隐私政策',
    end: '16 一般条款',
  },
  {
    id: 'general',
    title: '16. 一般条款',
    start: '16 一般条款',
  },
]

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

function normalizeParagraph(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function ChineseLegalText({text}: {text: string}) {
  const nodes = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || !/^\d+\s/.test(line))
    .map((line, index) => {
      const match = line.match(/^(\d+\.\d+)\s+(.+)$/)
      if (match) {
        return (
          <p key={index} className="text-[14.5px] text-muted leading-[1.8] mb-4">
            <strong className="font-semibold text-navy">{match[1]} </strong>
            {normalizeParagraph(match[2])}
          </p>
        )
      }

      return (
        <p key={index} className="text-[14.5px] text-muted leading-[1.8] mb-4">
          {normalizeParagraph(line)}
        </p>
      )
    })

  return <>{nodes}</>
}

export const zhTermsToc: LegalTocLink[] = SECTION_DEFINITIONS.map(({id, title}) => ({
  id,
  label: title,
}))

export const zhTermsSections: LegalSection[] = SECTION_DEFINITIONS.map((definition) => ({
  id: definition.id,
  title: definition.title,
  content: <ChineseLegalText text={extractTextSection(TERMS_TEXT, definition.start, definition.end)} />,
}))
