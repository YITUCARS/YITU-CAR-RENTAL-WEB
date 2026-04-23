import LegalPageLayout from '@/components/ui/LegalPageLayout'
import { getLocale } from 'next-intl/server'
import { zhWearAndTearSections, zhWearAndTearToc } from '@/content/legal/wear-and-tear.zh'

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[14.5px] text-muted leading-[1.8] mb-4">{children}</p>
)
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-2 text-[14px] text-muted mb-4">{children}</ul>
)
const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="leading-relaxed">{children}</li>
)
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-syne font-bold text-[15px] text-navy mt-6 mb-2">{children}</h3>
)
const Highlight = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-orange/[0.06] border-l-[3px] border-orange rounded-r-lg px-4 py-3 mb-4 text-[13.5px] text-navy leading-relaxed">
    {children}
  </div>
)

const CompareTable = ({
  rows,
}: {
  rows: { item: string; fairWear: string; damage: string }[]
}) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-navy text-white">
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tl-lg">Area</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold text-green-300">Fair Wear &amp; Tear</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold text-orange rounded-tr-lg">Chargeable Damage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
            <td className="px-4 py-2.5 text-navy font-medium">{r.item}</td>
            <td className="px-4 py-2.5 text-muted">{r.fairWear}</td>
            <td className="px-4 py-2.5 text-muted">{r.damage}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const TOC = [
  { id: 'what-is', label: 'What is Fair Wear & Tear?' },
  { id: 'comparison', label: 'Wear & Tear vs Damage' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'interior', label: 'Interior' },
  { id: 'mechanical', label: 'Mechanical & Tyres' },
  { id: 'assessment', label: 'Assessment Process' },
  { id: 'dispute', label: 'Disputes' },
]

const SECTIONS = [
  {
    id: 'what-is',
    title: 'What is Fair Wear and Tear?',
    content: (
      <>
        <P>
          Fair wear and tear refers to the minor deterioration that naturally occurs through normal, everyday
          use of a vehicle. It is the gradual decline in a vehicle&apos;s condition over time that happens
          despite reasonable care being taken by the renter.
        </P>
        <P>
          YITU Car Rental understands that minor, unavoidable deterioration will occur during a rental period.
          We will never charge you for damage that falls within the definition of fair wear and tear.
        </P>
        <Highlight>
          <strong>Key principle:</strong> If the condition of the vehicle at return is consistent with what
          we would reasonably expect given normal use and the length of the rental, no charge applies.
        </Highlight>
        <P>
          Damage, by contrast, is any loss or deterioration to the vehicle that goes beyond what would
          be expected from normal use — including scratches, dents, stains, burns, or mechanical damage
          caused by misuse.
        </P>
      </>
    ),
  },
  {
    id: 'comparison',
    title: 'Wear & Tear vs Chargeable Damage — Overview',
    content: (
      <>
        <P>
          The table below gives a general guide to help you understand the distinction between fair
          wear and tear (not charged) and chargeable damage.
        </P>
        <CompareTable
          rows={[
            {
              item: 'Paint / Body',
              fairWear: 'Very fine swirl marks from normal washing; minor surface oxidation on older vehicles',
              damage: 'Scratches through the clear coat or paint; chips larger than 5 mm; dents or creases',
            },
            {
              item: 'Windscreen',
              fairWear: 'Minor pitting or light surface marks from road debris that do not impair visibility',
              damage: 'Chips, cracks, or star fractures of any size in the driver\'s line of sight',
            },
            {
              item: 'Glass (other)',
              fairWear: 'Very minor surface marks',
              damage: 'Any cracks, chips or breakage to side windows, rear window or mirrors',
            },
            {
              item: 'Tyres',
              fairWear: 'Normal tread reduction through driving on sealed roads',
              damage: 'Sidewall cuts or bulges, punctures, damage from kerbing or off-road driving',
            },
            {
              item: 'Interior upholstery',
              fairWear: 'Light soiling from normal use; very minor scuff marks',
              damage: 'Stains, burns, tears, cuts, pet hair requiring professional cleaning',
            },
            {
              item: 'Carpet / Floor',
              fairWear: 'Light dirt from footwear',
              damage: 'Heavy soiling, mud, staining that requires professional cleaning',
            },
            {
              item: 'Dashboard / Trim',
              fairWear: 'Light dust or fingerprints that clean off',
              damage: 'Scratches, gouges, broken panels or clips',
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'exterior',
    title: 'Exterior Standards',
    content: (
      <>
        <H3>Paintwork</H3>
        <P>
          We accept very fine surface swirl marks caused by normal washing and detailing. We do not accept
          scratches that penetrate through the clear coat into the paint or primer layer, stone chips larger
          than 5 mm in diameter, or any dents, creases or deformation to body panels.
        </P>
        <H3>Windscreen & Glass</H3>
        <P>
          Minor pitting caused by road debris on the outer surface is considered fair wear and tear.
          Any chip or crack — regardless of size — that appears in or near the driver&apos;s line of
          sight is considered damage and must be reported immediately.
        </P>
        <H3>Bumpers & Trim</H3>
        <UL>
          <LI>Light scuffs from parking that polish out: fair wear and tear</LI>
          <LI>Cracks, breaks, deep gouges or missing trim pieces: chargeable damage</LI>
          <LI>Any damage to sensors, cameras or parking aids embedded in bumpers: chargeable damage</LI>
        </UL>
        <Highlight>
          Please report any damage you notice — even damage already present when you collect the vehicle —
          at the time of collection. YITU staff will note it on the rental document. Unreported pre-existing
          damage discovered on return may be attributed to you.
        </Highlight>
      </>
    ),
  },
  {
    id: 'interior',
    title: 'Interior Standards',
    content: (
      <>
        <H3>Seats & Upholstery</H3>
        <P>
          Seats may show light compression or slight fading over the life of the vehicle — this is fair
          wear and tear. Stains (food, drink, ink, biological), burns from cigarettes or other heat sources,
          cuts, tears, or pet hair are all considered chargeable damage.
        </P>
        <H3>Odours</H3>
        <P>
          Vehicles returned with a smoke odour or any other strong persistent odour will be subject to a
          professional odour extraction fee. Smoking is strictly prohibited in all YITU vehicles.
        </P>
        <H3>Cleanliness</H3>
        <UL>
          <LI>Light dust and minor dirt from everyday use: acceptable</LI>
          <LI>Excessive dirt, sand, mud or food debris requiring professional cleaning: cleaning fee applies</LI>
          <LI>Any biological soiling: professional cleaning fee applies</LI>
        </UL>
        <H3>Dashboard, Controls & Electronics</H3>
        <P>
          All dashboard controls, screens and electronic systems must be returned in full working order.
          Damage to trim, broken clips, cracked screens or inoperative controls are considered chargeable
          damage unless pre-existing and noted on the rental document.
        </P>
      </>
    ),
  },
  {
    id: 'mechanical',
    title: 'Mechanical & Tyres',
    content: (
      <>
        <H3>Tyres</H3>
        <P>
          Gradual tread wear from normal driving on sealed roads is fair wear and tear.
          The following are considered chargeable damage:
        </P>
        <UL>
          <LI>Sidewall damage or bulging from kerb strikes or rough terrain</LI>
          <LI>Punctures from foreign objects</LI>
          <LI>Flat tyres caused by driving on underinflated tyres or impact damage</LI>
          <LI>Damage from driving on unsealed, prohibited surfaces</LI>
        </UL>
        <H3>Mechanical Systems</H3>
        <P>
          Any mechanical faults that arise from inherent vehicle defects during normal use will be
          covered by YITU at no charge to you. However, mechanical damage resulting from misuse
          (e.g., overloading, driving through water, towing without authorisation, wrong fuel) is
          chargeable and may not be covered by any Loss Damage Waiver.
        </P>
        <Highlight>
          <strong>Wrong fuel:</strong> If the vehicle is filled with the incorrect fuel type, you will
          be liable for all costs associated with draining and repairing the fuel system — this is not
          covered by any waiver product.
        </Highlight>
      </>
    ),
  },
  {
    id: 'assessment',
    title: 'Assessment Process',
    content: (
      <>
        <P>
          When you return your vehicle, a YITU staff member will conduct a walk-around inspection with
          you present (where possible). We strongly encourage you to be present during the return
          inspection so any questions can be resolved on the spot.
        </P>
        <H3>How Damage is Assessed</H3>
        <UL>
          <LI>Minor damage may be assessed using standardised repair cost schedules</LI>
          <LI>More significant damage will be assessed by an independent repairer or panel beater</LI>
          <LI>You will receive a written damage assessment report upon request</LI>
          <LI>You may be charged for loss of revenue during repair — see Terms &amp; Conditions clause 5.6</LI>
        </UL>
        <H3>Pre-existing Damage</H3>
        <P>
          All pre-existing damage is recorded on your rental document at pick-up. Please review this
          carefully and ensure any damage not noted is added before you sign. Pre-existing damage will
          not be charged to you at return.
        </P>
        <H3>After-hours Returns</H3>
        <P>
          If you return the vehicle after hours, YITU will conduct the inspection on the next business
          day. You are encouraged to photograph the vehicle at the time of return as a personal record.
        </P>
      </>
    ),
  },
  {
    id: 'dispute',
    title: 'Disputes',
    content: (
      <>
        <P>
          If you disagree with a damage assessment, you have the right to dispute the charge. Please
          contact us within 5 working days of receiving notification of a charge.
        </P>
        <UL>
          <LI>Submit your dispute in writing to <a href="mailto:yitucars@hotmail.com" className="text-orange hover:underline">yitucars@hotmail.com</a></LI>
          <LI>Include your rental agreement number, dates of rental, and your reasons for disputing</LI>
          <LI>Attach any photographs or evidence you took at the time of collection or return</LI>
        </UL>
        <P>
          YITU will review your dispute within 15 working days and respond in writing. If you remain
          unsatisfied, you may escalate the matter to the New Zealand Rental Vehicle Association.
        </P>
        <Highlight>
          We recommend taking dated photographs of the entire vehicle — all four corners, the roof,
          interior and all glass — at both collection and return. This protects both you and YITU
          and makes any dispute straightforward to resolve.
        </Highlight>
      </>
    ),
  },
]

export async function WearAndTearPageContent({forcedLocale}: {forcedLocale?: 'en' | 'zh'} = {}) {
  const locale = forcedLocale ?? await getLocale()

  if (locale === 'zh') {
    return (
      <LegalPageLayout
        badge="车辆状况政策"
        title="合理磨损政策"
        subtitle="帮助您了解“合理磨损”与“需收费损坏”之间的区别，以便在归还 YITU 车辆时清楚知道会如何评估。"
        lastUpdated="生效日期：2024年3月1日"
        sections={zhWearAndTearSections}
        tocLinks={zhWearAndTearToc}
      />
    )
  }

  return (
    <LegalPageLayout
      badge="Vehicle Condition Policy"
      title="Wear and Tear Policy"
      subtitle="Understanding the difference between fair wear and tear and chargeable damage — so you know exactly what to expect when you return your YITU vehicle."
      lastUpdated="Effective date: 01 March 2024"
      sections={SECTIONS}
      tocLinks={TOC}
    />
  )
}

export default async function WearAndTearPage() {
  return <WearAndTearPageContent />
}
