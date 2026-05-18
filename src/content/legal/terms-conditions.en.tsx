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

const TERMS_TEXT = readLegalText('terms-conditions.en.txt')

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 'rental-contract',
    title: '1. Rental Contract',
    start: '1\n Rental Contract',
    end: '2\n Rental Period',
  },
  {
    id: 'rental-period',
    title: '2. Rental Period',
    start: '2\n Rental Period',
    end: '3\n Costs, charges & payment',
  },
  {
    id: 'costs-charges-payment',
    title: '3. Costs, Charges & Payment',
    start: '3\n Costs, charges & payment',
    end: '4\n Infringement offences',
  },
  {
    id: 'infringement-offences',
    title: '4. Infringement Offences',
    start: '4\n Infringement offences',
    end: '5\n Damage Cover and payment of the Damage Liability Fee (DLF or excess fee)',
  },
  {
    id: 'damage-cover-dlf',
    title: '5. Damage Cover and Payment of the Damage Liability Fee (DLF or Excess Fee)',
    start: '5\n Damage Cover and payment of the Damage Liability Fee (DLF or excess fee)',
    end: '6\n Exclusions to Damage Cover (e.g. YITU Super Cover)',
  },
  {
    id: 'damage-cover-exclusions',
    title: '6. Exclusions to Damage Cover (e.g. YITU Super Cover)',
    start: '6\n Exclusions to Damage Cover (e.g. YITU Super Cover)',
    end: '7\n Customer Own Insurance',
  },
  {
    id: 'customer-own-insurance',
    title: '7. Customer Own Insurance',
    start: '7\n Customer Own Insurance',
    end: '8\n Your responsibilities',
  },
  {
    id: 'your-responsibilities',
    title: '8. Your Responsibilities',
    start: '8\n Your responsibilities',
    end: '9\n Our responsibilities',
  },
  {
    id: 'our-responsibilities',
    title: '9. Our Responsibilities',
    start: '9\n Our responsibilities',
    end: '10\n Roadside Assistance, breakdown, accident & repair',
  },
  {
    id: 'roadside-assistance',
    title: '10. Roadside Assistance, Breakdown, Accident & Repair',
    start: '10\n Roadside Assistance, breakdown, accident & repair',
    end: '11\n End of the Rental Contract',
  },
  {
    id: 'end-of-rental-contract',
    title: '11. End of the Rental Contract',
    start: '11\n End of the Rental Contract',
    end: '12\n Termination of the Rental Contract',
  },
  {
    id: 'termination',
    title: '12. Termination of the Rental Contract',
    start: '12\n Termination of the Rental Contract',
    end: '13\n Applicable law',
  },
  {
    id: 'applicable-law',
    title: '13. Applicable Law',
    start: '13\n Applicable law',
    end: '14\n Dispute Resolution',
  },
  {
    id: 'dispute-resolution',
    title: '14. Dispute Resolution',
    start: '14\n Dispute Resolution',
    end: '15\n Privacy Policy',
  },
  {
    id: 'privacy-policy',
    title: '15. Privacy Policy',
    start: '15\n Privacy Policy',
    end: '16\n General',
  },
  {
    id: 'general',
    title: '16. General',
    start: '16\n General',
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

function normalizeParagraph(lines: string[]) {
  return lines
    .join(' ')
    .replace(/-\s+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function isClauseNumber(line: string) {
  return /^\d+\.\d+$/.test(line)
}

function isSectionNumber(line: string) {
  return /^\d+$/.test(line)
}

function isBulletMarker(line: string) {
  return /^\([a-zivx]+\)$/i.test(line)
}

function isDefinitionTerm(line: string, nextLine?: string) {
  return (
    Boolean(nextLine?.startsWith('means')) &&
    !isClauseNumber(line) &&
    !isSectionNumber(line) &&
    !isBulletMarker(line)
  )
}

function shouldStopParagraph(line: string, nextLine?: string) {
  return (
    !line ||
    isClauseNumber(line) ||
    isBulletMarker(line) ||
    isDefinitionTerm(line, nextLine) ||
    (isSectionNumber(line) && Boolean(nextLine))
  )
}

function EnglishLegalText({text}: {text: string}) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())

  const nodes: React.ReactNode[] = []
  let index = 0
  let pendingClause: string | null = null

  while (index < lines.length) {
    const line = lines[index]
    const nextLine = lines[index + 1]

    if (!line || line === 'YOUR RENTAL CONTRACT & TERMS AND CONDITION') {
      index += 1
      continue
    }

    if (isSectionNumber(line) && nextLine) {
      index += 2
      continue
    }

    if (isClauseNumber(line)) {
      pendingClause = line
      index += 1
      continue
    }

    if (isDefinitionTerm(line, nextLine)) {
      const term = line
      const definitionLines: string[] = []
      index += 1

      while (
        index < lines.length &&
        !shouldStopParagraph(lines[index], lines[index + 1])
      ) {
        definitionLines.push(lines[index])
        index += 1
      }

      nodes.push(
        <p key={`definition-${index}`} className="text-[14.5px] text-muted leading-[1.8] mb-4">
          <strong className="font-semibold text-navy">{term} </strong>
          {normalizeParagraph(definitionLines)}
        </p>
      )
      continue
    }

    if (isBulletMarker(line)) {
      const items: string[] = []

      while (index < lines.length && isBulletMarker(lines[index])) {
        const marker = lines[index]
        const itemLines: string[] = []
        index += 1

        while (
          index < lines.length &&
          !shouldStopParagraph(lines[index], lines[index + 1])
        ) {
          itemLines.push(lines[index])
          index += 1
        }

        items.push(`${marker} ${normalizeParagraph(itemLines)}`.trim())
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

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      !shouldStopParagraph(lines[index], lines[index + 1])
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }

    const paragraph = normalizeParagraph(paragraphLines)
    if (!paragraph) {
      continue
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="text-[14.5px] text-muted leading-[1.8] mb-4">
        {pendingClause && <strong className="font-semibold text-navy">{pendingClause} </strong>}
        {paragraph}
      </p>
    )
    pendingClause = null
  }

  return <>{nodes}</>
}

export const enTermsToc: LegalTocLink[] = SECTION_DEFINITIONS.map(({id, title}) => ({
  id,
  label: title,
}))

export const enTermsSections: LegalSection[] = SECTION_DEFINITIONS.map((definition) => ({
  id: definition.id,
  title: definition.title,
  content: <EnglishLegalText text={extractTextSection(TERMS_TEXT, definition.start, definition.end)} />,
}))
