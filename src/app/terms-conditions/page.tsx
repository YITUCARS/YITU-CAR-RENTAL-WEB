import LegalPageLayout from '@/components/ui/LegalPageLayout'
import { Phone } from 'lucide-react'

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
const PriceTable = ({ rows }: { rows: { fee: string; rate: string; clause: string }[] }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-navy text-white">
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tl-lg">Fee</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold">Rate (incl. GST)</th>
          <th className="text-left px-4 py-2.5 font-syne font-bold rounded-tr-lg">Clause</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
            <td className="px-4 py-2.5 text-navy font-medium">{r.fee}</td>
            <td className="px-4 py-2.5 text-muted">{r.rate}</td>
            <td className="px-4 py-2.5 text-muted">{r.clause}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const TOC = [
  { id: 'contact-details', label: 'Contact Details' },
  { id: 'understanding', label: '1. Understanding Your Agreement' },
  { id: 'driver', label: '2. Driver' },
  { id: 'where-to-drive', label: '3. Where You Can Drive' },
  { id: 'vehicle-maintenance', label: '4. Vehicle Maintenance' },
  { id: 'return', label: '5. Return of the Vehicle' },
  { id: 'fuel', label: '6. Fuel' },
  { id: 'liability', label: '7. Liability for Loss or Damage' },
  { id: 'ldw', label: '8. Loss Damage Waiver' },
  { id: 'snow', label: '9. Driving in Snow' },
  { id: 'assessment', label: '10. Assessment & Payment' },
  { id: 'claims', label: '11. Claims & Incidents' },
  { id: 'payment', label: '12. Payment' },
  { id: 'termination', label: '13. Termination' },
  { id: 'dispute', label: '15. Dispute Resolution' },
  { id: 'nz-consumer', label: '16. NZ Consumer Law' },
  { id: 'pricing-schedule', label: 'Annexure B: Pricing Schedule' },
  { id: 'ev-terms', label: 'Annexure C: Electric Vehicle' },
  { id: 'pay-now', label: 'Annexure D: Pay Now' },
]

const SECTIONS = [
  {
    id: 'contact-details',
    title: 'Contact Details',
    content: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Reservations', email: 'booking@yiturentalcars.co.nz', phone: '0800 948 888' },
          { label: 'Roadside Assistance', email: null, phone: '0800 948 888', iPhone: '0800 734 543' },
          { label: 'Customer Service', email: 'yitucars@hotmail.com', phone: '0800 948 888' },
          { label: 'Claims', email: 'jay@yitugroup.co.nz', phone: '+64 21 873789' },
        ].map((c) => (
          <div key={c.label} className="bg-off-white border border-black/10 rounded-[10px] p-4">
            <div className="font-syne font-bold text-[13px] text-navy mb-2">{c.label}</div>
            {c.email && <a href={`mailto:${c.email}`} className="block text-[12.5px] text-orange hover:underline mb-1">{c.email}</a>}
            <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="block text-[12.5px] text-muted hover:text-orange mb-1">{c.phone}</a>
            {c.iPhone && <a href={`tel:${c.iPhone.replace(/\s/g, '')}`} className="text-[12.5px] text-muted hover:text-orange">{c.iPhone}</a>}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'understanding',
    title: '1. Understanding Your Rental Agreement',
    content: (
      <>
        <P>
          The Rental Agreement between YITU and You is made on the date shown on the Rental Document in respect of the Vehicle. It sets out our responsibilities to You and Your responsibilities to YITU when renting a vehicle and any optional extras.
        </P>
        <P>
          The Rental Agreement will become legally binding when You sign the Rental Document when picking up the Vehicle from YITU.
        </P>
        <Highlight>
          By entering into the Rental Agreement, You agree to be bound by these Terms and Conditions, the Privacy Notice (Annexure A), Pricing Schedule (Annexure B), Electric Vehicle Terms and Conditions (Annexure C), and if applicable, the Pay Now Terms and Conditions (Annexure D).
        </Highlight>
        <H3>What You agree to</H3>
        <UL>
          <LI>Rent the vehicle identified as part of the Rental Agreement for the Pre-agreed Rental Period</LI>
          <LI>Pay the amounts described in the Rental Agreement</LI>
          <LI>Pay rental fees for any extension to the pre-agreed rental period</LI>
          <LI>Pay relevant administration charges, fees, theft, loss and damage costs, toll charges, parking, traffic or other fines or charges</LI>
        </UL>
        <H3>Additional Drivers</H3>
        <P>
          Only You and any Additional Drivers are allowed to drive the Vehicle. You are responsible for making sure all Additional Drivers comply with the Rental Agreement. You may be charged for each Additional Driver.
        </P>
      </>
    ),
  },
  {
    id: 'driver',
    title: '2. Driver',
    content: (
      <>
        <P>You agree and acknowledge that:</P>
        <UL>
          <LI>Only Authorised Drivers will drive the Vehicle</LI>
          <LI>All Authorised Drivers must hold a current and valid licence to drive the Vehicle and have been licenced to drive Vehicles of the same category for at least 12 consecutive months prior to signing the Rental Document</LI>
          <LI>You and Additional Drivers authorise YITU to verify Your driving licence status, details and records with local authorities</LI>
        </UL>
        <Highlight>
          YITU may refuse to allow You or any Additional Driver to drive the Vehicle if they do not hold a valid licence, have driving-related convictions, or do not meet our reasonable identity, security or credit checks.
        </Highlight>
      </>
    ),
  },
  {
    id: 'where-to-drive',
    title: '3. Where You Can and Cannot Drive the Vehicle',
    content: (
      <>
        <P>Authorised Drivers must only use the Vehicle on a road which is properly formed and constructed as a sealed, metalled or gravel road.</P>
        <H3>Prohibited Use</H3>
        <P>Authorised Drivers must not use the Vehicle:</P>
        <UL>
          <LI>On beaches, in any sand, through streams</LI>
          <LI>Through rivers or flood waters</LI>
          <LI>On fire trails</LI>
          <LI>On snow unless You use Snow Chains</LI>
          <LI>Airside on or at any airport (unless authorised in writing by YITU)</LI>
        </UL>
        <H3>Other Unauthorised Use</H3>
        <P>Authorised Drivers must not:</P>
        <UL>
          <LI>Use the Vehicle for any illegal purpose, race, contest or performance test</LI>
          <LI>Carry more passengers than seat belts permit</LI>
          <LI>Drive under the influence of alcohol or drugs</LI>
          <LI>Carry passengers for payment of any kind</LI>
          <LI>Smoke within the Vehicle or allow any other person to smoke within the Vehicle at any time</LI>
          <LI>Use the Vehicle to prepare, commit or assist in any criminal or Terrorist Act</LI>
          <LI>Pay all tolls, parking charges, cleaning fees, fines and infringements incurred</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'vehicle-maintenance',
    title: '4. Vehicle Maintenance, Security and Cleaning',
    content: (
      <>
        <P>All Authorised Drivers must:</P>
        <UL>
          <LI>Maintain all of the Vehicle's engine oils and engine coolant levels to the Manufacturer's Specifications</LI>
          <LI>Keep the Vehicle locked and secure when unattended and take all reasonable precautions to safeguard the keys</LI>
          <LI>Comply with all applicable seatbelt and child restraint laws</LI>
        </UL>
        <H3>Roadside Assistance</H3>
        <P>
          YITU will provide 24 hour roadside assistance for all Inherent Mechanical Faults at no additional cost. However, You will be charged a Roadside Callout Fee for each callout caused by Your act or omission, including emergency refuelling, tyre damage, lost keys, keys locked in the Vehicle, or a flat battery due to lights being left on.
        </P>
        <H3>Cleaning</H3>
        <P>
          If YITU has reasonable grounds to believe that You returned the Vehicle in poor condition (excluding Fair Wear and Tear) or that smoking occurred in the Vehicle during the Rental Period, You may be required to pay the cost of professional cleaning or odour extraction.
        </P>
      </>
    ),
  },
  {
    id: 'return',
    title: '5. Return of the Vehicle',
    content: (
      <>
        <P>You must return the Vehicle to YITU at the place, on the date and by the time shown on the Rental Document, and in the same condition as it was at the commencement of the Rental Period (Fair Wear and Tear excepted).</P>
        <Highlight>
          <strong>Important:</strong> If You return the Vehicle to a different location without prior approval, you may incur a One Way Fee of $2.30 per kilometre. If You return late, a Late Return Fee of $30.00 per hour applies.
        </Highlight>
        <H3>Returning the Vehicle Earlier Than Agreed</H3>
        <P>
          If You return the Vehicle at an earlier date or time, the rates shown on the Rental Document will not apply and You must pay the current daily rate applicable for that rental period, which is likely to be higher.
        </P>
        <H3>Your Liability for Vehicle Downtime</H3>
        <P>
          If Your breach of the Rental Agreement has caused downtime of the Vehicle, You may be liable to pay a per day loss of revenue fee based on the actual downtime of the Vehicle.
        </P>
      </>
    ),
  },
  {
    id: 'fuel',
    title: '6. Fuel',
    content: (
      <>
        <P>You must fill the Vehicle only with the fuel type specified in the Manufacturer's Specifications.</P>
        <H3>Refuelling: Less Than 120 Kilometres Driven</H3>
        <P>
          If You drive the Vehicle less than 120 kilometres during the Rental Period, You will be charged the Fuel Service fee per kilometre driven. YITU will waive this fee if You present a receipt indicating You refuelled the Vehicle to the same level as when You rented it.
        </P>
        <H3>Refuelling: More Than 120 Kilometres Driven</H3>
        <P>
          If You drive 120 or more kilometres and return the Vehicle with less fuel than it had when You rented it, You must pay YITU the Fuel Service fee per litre as set out in the Rental Document.
        </P>
      </>
    ),
  },
  {
    id: 'liability',
    title: '7. Liability for Loss or Damage',
    content: (
      <>
        <P>
          Subject to any applicable Loss Damage Waiver, You are liable to compensate YITU for any damage to or loss of the Vehicle which YITU has reasonable grounds to believe occurred during the Rental Period, including hail, flood or storm related damage or theft.
        </P>
        <H3>When You Are Not Liable</H3>
        <P>
          If YITU accepts that the loss or damage was not Your fault, You will not be liable to compensate YITU, provided You comply with the claims process set out in Clause 11, You are resident in New Zealand, and You provide YITU with all required details of the Incident.
        </P>
        <H3>When YITU Is Liable</H3>
        <P>
          YITU is liable for any damage to or loss of the vehicle that is our fault, including any failure on our part to properly maintain the Vehicle.
        </P>
      </>
    ),
  },
  {
    id: 'ldw',
    title: '8. Loss Damage Waiver ("Basic Insurance" or "YITU SUPER COVER")',
    content: (
      <>
        <P>
          If You are liable to compensate YITU for loss under Clause 7.1, YITU will waive that liability if You have complied with the Rental Agreement and You pay the Excess Amount (Basic Insurance: $3,000 standard fleet / $5,000 LUX fleet; YITU Super Cover: zero excess).
        </P>
        <H3>When Loss Damage Waiver Will NOT Apply</H3>
        <P>The waiver does not apply to:</P>
        <UL>
          <LI>Overhead Damage or Underbody Damage (e.g., contact with bridges, tunnels, trees, car park boom gates; damage from driving over gutters or kerbs at excessive speeds)</LI>
          <LI>Water damage from driving through floods, creeks or rivers</LI>
          <LI>Damage caused by breach of the permitted use clauses</LI>
          <LI>Theft of the Vehicle (except where recovered and You are only liable for a lesser amount)</LI>
          <LI>Damage or loss caused deliberately or recklessly</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'snow',
    title: '9. Driving in Snow',
    content: (
      <>
        <P>
          Despite the general prohibition on driving in snow, You are permitted to drive the Vehicle on snow provided You use appropriate driving equipment (such as snow chains) suitable for the Vehicle, which You obtained from us or which we approved, and it is otherwise reasonably safe and responsible to drive on snow in the circumstances.
        </P>
        <P>
          Ski Equipment may be available for hire as an optional extra from the pick-up location, but it is not guaranteed. It is Your responsibility to safely secure all Ski Equipment to or on the Vehicle in accordance with the Manufacturer's Specifications.
        </P>
      </>
    ),
  },
  {
    id: 'assessment',
    title: '10. Assessment and Payment for Loss or Damage',
    content: (
      <>
        <P>
          YITU will debit Your Account with the Excess Amount if You must pay the Excess Amount under the Loss Damage Waiver, fault has not been determined but YITU has reasonable grounds to believe You are the party at fault, or You have not provided required information.
        </P>
        <Highlight>
          <strong>Example:</strong> If the Excess Amount is $5,000 and the Vehicle is recovered three days after theft with $100 damage, and Recovery Costs amount to $400, You will be refunded $4,500.
        </Highlight>
        <P>
          Where You are required to pay YITU for any loss, damage, repair, cost, or fee, the amount is the lesser of the cost of repairs to the Vehicle or the market value of the Vehicle at the time of the damage.
        </P>
      </>
    ),
  },
  {
    id: 'claims',
    title: '11. Claims and Proceedings — What to Do If There Is an Incident',
    content: (
      <>
        <P>In the event of an Incident, You must ensure that You or another Authorised Driver:</P>
        <UL>
          <LI>Promptly report the Incident to the local police (if required by applicable law)</LI>
          <LI>Promptly report the Incident in writing to YITU within 24 hours</LI>
          <LI>Do not make or give any offer, promise of payment, settlement, waiver, release, or admission of liability</LI>
          <LI>Permit YITU or its insurers to bring, defend, and settle any legal proceedings in Your name</LI>
          <LI>Complete and furnish to YITU any additional statement, information or assistance which YITU may reasonably require</LI>
        </UL>
        <Highlight>
          <strong>In the event of an accident:</strong> Do not panic. Notify YITU as soon as practical. If it is safe to do so, take pictures of the accident site and all vehicles involved. Failure to follow this procedure may make You financially liable for loss or damage.
        </Highlight>
      </>
    ),
  },
  {
    id: 'payment',
    title: '12. Payment',
    content: (
      <>
        <P>At the end of the Rental Period, You authorise the debit of Your Account by YITU to pay all Rental Charges, any amounts paid or payable arising out of Your use of the Vehicle, and any amount which You reasonably owe to YITU under the Rental Agreement.</P>
        <H3>Payment Disputes</H3>
        <P>
          You may dispute amounts by contacting yitucars@hotmail.com within 5 working days of notification. YITU will not debit Your Account for disputed amounts during the Notice Period.
        </P>
        <H3>Refunds</H3>
        <P>
          YITU aims to pay any refund due to You within 14 days after it becomes payable. Credit card refunds may take 7-10 working days for Your financial institution to process.
        </P>
        <H3>Card Surcharges</H3>
        <P>Visa & MasterCard: 2.2% · American Express: 3.1%</P>
      </>
    ),
  },
  {
    id: 'termination',
    title: '13. Termination',
    content: (
      <>
        <P>Either party may terminate the Rental Agreement at any time if the other party commits a breach of the Rental Agreement.</P>
        <P>YITU may terminate the Rental Agreement if the vehicle is in an "Unable to drive" condition caused by the hirer's fault in a car accident, or if YITU is required by the police or other regulatory authority to take possession of the Vehicle from You.</P>
        <Highlight>
          In the event of such termination or repossession, the hirer has no right to a refund of any part of the rental charges.
        </Highlight>
      </>
    ),
  },
  {
    id: 'dispute',
    title: '15. Dispute Resolution',
    content: (
      <>
        <P>
          YITU will use its best endeavours to respond to Your complaint within fifteen (15) working days after the date of receipt of the complaint. Your complaint will be reviewed by a YITU representative who has appropriate experience and authority and is different from the person whose decision is the subject of the complaint.
        </P>
        <P>
          If You do not accept the resolution through our internal dispute resolution process, You may refer the matter to the New Zealand Rental Vehicle Association. YITU will participate in the dispute resolution process in good faith.
        </P>
      </>
    ),
  },
  {
    id: 'nz-consumer',
    title: '16. New Zealand Consumer Law',
    content: (
      <>
        <P>
          Nothing in these Terms and Conditions applies where it would exclude, restrict or modify any right or remedy that You may have under the New Zealand Consumer Law if such right or remedy cannot lawfully be excluded, restricted or modified.
        </P>
        <H3>Your Rights: Major Failures</H3>
        <P>For major failures with the service, You are entitled to cancel your service contract with us and to a refund for the unused portion, or to compensation for its reduced value.</P>
        <H3>Your Rights: Other Failures</H3>
        <P>If a failure with the goods or a service does not amount to a major failure, You are entitled to have it rectified in a reasonable time. If this is not done, You are entitled to a refund for the goods and to cancel the contract for the service and obtain a refund of any unused portion.</P>
      </>
    ),
  },
  {
    id: 'pricing-schedule',
    title: 'Annexure B: Pricing Schedule',
    content: (
      <>
        <PriceTable rows={[
          { fee: 'Late Return Fee', rate: '$30.00/hr, or applicable daily rate', clause: '5.3' },
          { fee: 'One Way Fee', rate: '$2.30 per kilometre', clause: '5.2' },
          { fee: 'Card Surcharge (Visa/MC)', rate: '2.2%', clause: '12.1(d)' },
          { fee: 'Card Surcharge (Amex)', rate: '3.1%', clause: '12.1(d)' },
          { fee: 'Collection Costs', rate: '$86.25 plus 10% p.a. interest', clause: '12.10' },
          { fee: 'Roadside Callout Fee', rate: 'Min. $235.75 per callout', clause: '4.6' },
          { fee: 'Professional Cleaning', rate: '$28.75 admin fee + cleaning cost', clause: '4.9' },
          { fee: 'EV Recharge Fee (10%–90%)', rate: '$34.50', clause: 'Annexure C' },
          { fee: 'EV Recharge Fee (under 10%)', rate: '$69.00', clause: 'Annexure C' },
          { fee: 'Additional Driver Fee', rate: '$30 per rental per driver', clause: '2.2' },
          { fee: 'Cancellation (24hr+ notice)', rate: 'Up to $86.25', clause: '4.4' },
          { fee: 'Cancellation (under 24hr)', rate: 'Up to $172.50', clause: '4.5' },
          { fee: 'Pre-authorisation Hold', rate: '$4,500 standard / $5,000 LUX', clause: '2.4' },
        ]} />
        <P>All amounts inclusive of GST unless otherwise stated. All rental charges and excess amounts are as specified on Your Rental Document.</P>
      </>
    ),
  },
  {
    id: 'ev-terms',
    title: 'Annexure C: Electric Vehicle Terms and Conditions',
    content: (
      <>
        <Highlight>
          <strong>Warning:</strong> Battery exhaustion may cause irreparable damage to the battery of an Electric Vehicle — You will be held responsible for the replacement costs. Electric Vehicles cannot be driven through an automatic car wash.
        </Highlight>
        <P>If you rent an Electric Vehicle from YITU, You and any Authorised Driver acknowledge and agree to:</P>
        <UL>
          <LI>YITU provides Electric Vehicles with at least 90% charge; You must return the Vehicle with the same or greater charge level</LI>
          <LI>If returned with less than 90% but more than 10% charge, an Electric Vehicle Recharge Fee of $34.50 applies</LI>
          <LI>If returned with 10% or less charge, a Recharge Fee of $69.00 applies</LI>
          <LI>Charging cables must be returned with the Vehicle; if not returned or damaged, You will be charged the replacement cost</LI>
          <LI>Any damage to an Electric Vehicle's battery due to battery exhaustion or careless driving is not covered by any Loss Damage Waiver</LI>
          <LI>If You sign into any infotainment system applications, signing out at the end of Your Rental Period is Your responsibility</LI>
          <LI>Tesla Supercharger usage is billed back to YITU and You are responsible for these costs, which may be charged up to 30 days after return</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'pay-now',
    title: 'Annexure D: Pay Now Terms and Conditions',
    content: (
      <>
        <P>
          These Pay Now Terms and Conditions apply to bookings for which payment for the Pre-Agreed Rental Period and any optional extras is made at the time of booking.
        </P>
        <H3>Booking Conditions</H3>
        <UL>
          <LI>The name of the Authorised Driver set out in the booking documentation must match the name of the person collecting the Vehicle</LI>
          <LI>The credit or debit card used for the Pay Now Booking must be presented at the time of collection</LI>
          <LI>A Pre-authorisation of $4,500 ($5,000 for Luxury) will be placed on Your Account at collection</LI>
        </UL>
        <H3>Cancellation Policy</H3>
        <UL>
          <LI><strong>24+ hours notice:</strong> Full refund less a cancellation fee of up to $86.25</LI>
          <LI><strong>Under 24 hours notice:</strong> Refund less a cancellation fee of up to $172.50</LI>
          <LI><strong>No-show / failure to cancel:</strong> Entire amount paid in advance is forfeited</LI>
        </UL>
        <P>All requests for refunds must be submitted within 90 days after the scheduled rental pick-up date. No refunds will be granted after this 90-day period.</P>
        <H3>Changing Your Booking</H3>
        <P>
          You may change your booking at any time before the day You are due to pick up the Vehicle by calling reservations on 0800 948 888 or managing Your booking online at www.yiturentalcars.co.nz.
        </P>
        <Highlight>
          If You return the Vehicle before the return date of the Pre-Agreed Rental Period, You will not be refunded any portion of your pre-paid charges. This does not detract from your rights under the New Zealand Consumer Law.
        </Highlight>
      </>
    ),
  },
]

export default function TermsConditionsPage() {
  return (
    <LegalPageLayout
      badge="Rental Terms & Conditions · Effective 01 March 2024"
      title="Terms & Conditions"
      subtitle="Please read these Terms and Conditions before You sign the Rental Document. These pages contain the information You need to know about Your rental with YITU New Zealand."
      lastUpdated="Effective date: 01 March 2024"
      sections={SECTIONS}
      tocLinks={TOC}
    />
  )
}
