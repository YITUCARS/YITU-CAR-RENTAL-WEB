import LegalPageLayout from '@/components/ui/LegalPageLayout'
import {getLocale} from 'next-intl/server'
import {zhPrivacySections, zhPrivacyToc} from '@/content/legal/privacy-policy.zh'

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

const TOC = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'renting', label: 'Renting a Vehicle' },
  { id: 'frequent-renter', label: 'Frequent Renter' },
  { id: 'coverage', label: 'Coverage Products' },
  { id: 'vehicle-data', label: 'Vehicle Data' },
  { id: 'online-data', label: 'Online Data' },
  { id: 'online-advertising', label: 'Online Advertising' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'information-sharing', label: 'Information Sharing' },
  { id: 'your-choices', label: 'Your Choices' },
  { id: 'safeguards', label: 'Safeguards' },
  { id: 'retention', label: 'Information Retention' },
  { id: 'international', label: 'International Transfers' },
  { id: 'your-rights', label: 'Your Privacy Rights' },
  { id: 'contact', label: 'Contact Details' },
]

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: (
      <>
        <P>
          Welcome to the Privacy Notice of YITU New Zealand within the YITU Group, Inc. (we refer to these companies as "YITU," "we," "us," or "our"). Please take the time to read this Privacy Notice as it is important for you to know how we collect and use your personal information.
        </P>
        <P>
          By "personal information" we mean all information that relates to a living individual and either identifies, or may be used to identify, that individual.
        </P>
        <P>
          We may change portions of this Privacy Notice from time to time. If we make a change that significantly affects your rights, we will notify you by way of a prominent posting on our websites, e-mail and/or postal mail prior to the change becoming effective.
        </P>
        <P>
          This Privacy Notice covers the personal information the YITU companies collect, use and disclose through your use of our products and services either online or offline. YITU needs to collect personal information from you to rent a vehicle or provide our other services.
        </P>
      </>
    ),
  },
  {
    id: 'renting',
    title: 'Renting a Vehicle',
    content: (
      <>
        <P>
          When you make a reservation, rent a vehicle or join one of our programs, we collect information to provide you with our great services and for our legitimate business interests. The information we collect includes:
        </P>
        <UL>
          <LI>Name and home address (for licence validation and billing)</LI>
          <LI>Email address (if booking online or requesting e-receipts)</LI>
          <LI>Telephone numbers at which we can reach you</LI>
          <LI>Date of birth and gender (for licence validation and legal requirements)</LI>
          <LI>Payment information such as credit or debit card details (security code is obtained for transaction only — we do not keep it)</LI>
          <LI>Driver's licence and/or other government issued identification</LI>
          <LI>Employer details and business address (if a member of a corporate program)</LI>
          <LI>Special discount codes, partner member numbers, association memberships</LI>
          <LI>Special requests and preferences, including optional extras such as damage waivers</LI>
        </UL>
        <P>
          During your rental we will collect where and when you rented the vehicle, where and when you returned the vehicle, coverage preferences, fuel consumption, mileage, accident history and other information related to the vehicle and your use of it.
        </P>
        <P>
          We will also collect information about any speeding, parking, toll or other traffic-related fines that you incur or any traffic offences that you commit during your rental where these are provided to us by any law enforcement agency.
        </P>
      </>
    ),
  },
  {
    id: 'frequent-renter',
    title: 'Frequent Renter Programmes',
    content: (
      <>
        <P>
          If you decide to join our frequent renter programme such as YITU Preferred, we will collect and retain your name, contact details, driver's licence details, and date of birth to create an account for you.
        </P>
        <P>
          We will use this information to allow you to take the benefits of membership, including fast-track service at our rental counters, the ability to self-service elements of the rental through our App, and to provide you with further benefits such as free upgrades and free rentals.
        </P>
      </>
    ),
  },
  {
    id: 'coverage',
    title: 'Coverage Products',
    content: (
      <>
        <P>
          If you have requested any of the products that we offer during your rental, we will pass your personal information to the insurer underwriting that product in connection with you entering into a contract with that insurer.
        </P>
        <P>
          In the event that you make any claim under one of these products, your personal information relating to the claim will be provided to the insurer and any appointed claims handler. The use of your personal information by that insurer will be subject to the terms of that insurer's privacy notice.
        </P>
      </>
    ),
  },
  {
    id: 'vehicle-data',
    title: 'Vehicle Data',
    content: (
      <>
        <P>
          Some vehicles you rent from YITU have been manufactured or equipped with on-board devices so as to be connected to the internet (connected car) which allow us to send commands to and receive certain information from the vehicle, including geolocation data from a global positioning system (GPS).
        </P>
        <P>
          YITU rental locations may also be equipped with video security surveillance systems as well as cameras that may record as our vehicles depart/enter our lots. These cameras may take images or photos of you, authorised drivers and passengers.
        </P>
      </>
    ),
  },
  {
    id: 'online-data',
    title: 'Online Data',
    content: (
      <>
        <P>
          When you download, visit and use our websites and/or Apps, YITU automatically collects technical information. This includes:
        </P>
        <H3>IP Addresses & Automatically Collected Information</H3>
        <P>
          We may collect your IP address when you visit our websites to help us diagnose problems, for system administration, and to report aggregated information to our business partners. We may also collect your browser type, ISP, referring/exit pages, operating system, date/time stamp, and clickstream data.
        </P>
        <H3>Cookies & Similar Technologies</H3>
        <P>
          We may send cookies to your computer when you visit our websites at www.yiturentalcars.co.nz. Persistent cookies identify pages accessed and provide personalised features. Session cookies are used for security purposes as part of our customer identification process.
        </P>
        <H3>Mobile GPS and Push Notifications</H3>
        <P>
          If you permit us, when you use our Apps we may collect location markers using the GPS in your device. This helps the App provide you better service, such as finding the nearest rental location. You may turn off these features at any time through your device settings.
        </P>
      </>
    ),
  },
  {
    id: 'online-advertising',
    title: 'Online Advertising',
    content: (
      <P>
        YITU uses third-parties to provide online or electronic ads on our behalf and on behalf of our partners. These third parties use data about your visits to our websites and Apps usage to send you customised ads that may be of interest to you. This information is collected using cookies, scripts, pixel tags, web beacons and other similar technologies.
      </P>
    ),
  },
  {
    id: 'marketing',
    title: 'Marketing',
    content: (
      <>
        <P>
          YITU may share personal information with third parties to help us with marketing and promotional projects, such as managing our social media pages, running contests, or sending marketing communications.
        </P>
        <P>
          We will only use your personal information to send you marketing where you have given us your consent or we are otherwise permitted by applicable law to do so. You can withdraw your consent at any time — see the Your Choices section to find out how.
        </P>
      </>
    ),
  },
  {
    id: 'information-sharing',
    title: 'Information Sharing',
    content: (
      <>
        <P>YITU may use and share your personal information with affiliated and non-affiliated organisations including:</P>
        <UL>
          <LI><strong>Independent licensees & network providers</strong> — to make and confirm reservations, provide rewards programs, connect corporate accounts, and provide customer assistance</LI>
          <LI><strong>Travel agents</strong> — to make and confirm reservations, process payments and refunds, and provide customer assistance</LI>
          <LI><strong>Your employer or organisation</strong> — to verify eligibility and connect with your corporate or commercial accounts</LI>
          <LI><strong>Credit card issuers</strong> — to process payments and refunds, and for fraud checks</LI>
          <LI><strong>IT service providers</strong> — to support our IT systems and infrastructure</LI>
          <LI><strong>Government, regulatory and law enforcement agencies</strong> — to verify driver's licences and comply with legal obligations</LI>
          <LI><strong>Insurance companies and claims handlers</strong> — to provide and service the coverage products you have requested</LI>
        </UL>
        <P>
          We may also transfer or assign your personal information to third parties as a result of a sale, merger, consolidation, change in control, transfer of assets, bankruptcy, reorganisation, or liquidation.
        </P>
      </>
    ),
  },
  {
    id: 'your-choices',
    title: 'Your Choices',
    content: (
      <>
        <P>If you want to opt out of receiving promotional and marketing communications from YITU, you can:</P>
        <UL>
          <LI>Log into your account and update your profile</LI>
          <LI>Click "unsubscribe" at the bottom of an email we sent you</LI>
          <LI>Contact our customer service representative directly</LI>
        </UL>
        <P>
          If you do opt out of receiving promotional messages, we can still contact you regarding our business relationship with you, such as account status updates, survey requests, and reservation confirmations.
        </P>
      </>
    ),
  },
  {
    id: 'safeguards',
    title: 'Safeguards',
    content: (
      <>
        <P>
          The security of your personal information is important to us. We take reasonable steps to make sure your information is protected from unauthorised use, access, disclosure, alteration, destruction or loss. For financial or payment information, we use firewalls and Transport Layer Security (TLS) encryption.
        </P>
        <P>
          We do not ask for financial or payment information, such as your credit card number, passcode, account number or pin number, in an e-mail, text or any other communication that we send to you.
        </P>
        <P>
          You are responsible for keeping your account passcode, membership numbers and pin numbers safe and secure. If there is an unauthorised use or any other breach of security involving your information, you must notify us as soon as possible.
        </P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Information Retention',
    content: (
      <>
        <P>
          YITU keeps your personal information for no longer than is reasonably necessary or required by law. How long we keep it depends on the type of information and purpose.
        </P>
        <P>The criteria we use to determine the retention period includes:</P>
        <UL>
          <LI>The length of time that you are a member of our frequent renter programme or any loyalty scheme</LI>
          <LI>How frequently you rent with us or when your most recent rental occurred</LI>
          <LI>Whether there are contractual or legal obligations that require us to retain the data</LI>
          <LI>Whether there is any ongoing legal claim related to your relationship with us</LI>
          <LI>Whether the personal information is considered a special category, in which case a shorter retention period generally applies</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'international',
    title: 'International Transfers',
    content: (
      <P>
        The information we collect from you may be transferred to, and stored by, IT vendors who operate on our behalf. In particular, these include our booking engine hosting provider. We also transfer information to a number of providers of business applications — such as CRM and marketing applications — as well as marketing service providers. These providers are primarily located in New Zealand, Australia and China.
      </P>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Privacy Rights',
    content: (
      <>
        <P>You may have the following rights when it comes to our handling of your personal information:</P>
        <UL>
          <LI><strong>Right of access</strong> — you may have the right to request a copy of the personal information we have about you</LI>
          <LI><strong>Right of rectification</strong> — you may have the right to request that we rectify inaccurate personal information about you</LI>
          <LI><strong>Right to withdraw consent</strong> — where we process your personal information based on consent, you have the right to withdraw consent at any time</LI>
          <LI><strong>Right to complain</strong> — if you feel we have not respected your privacy, please contact our Data Protection Officer</LI>
        </UL>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Data Controllers & Contact Details',
    content: (
      <>
        <P>You can contact our Data Protection Officer in respect of any issues or questions:</P>
        <div className="bg-off-white border border-black/10 rounded-card p-5 space-y-3 text-[14px]">
          <div>
            <span className="font-semibold text-navy block mb-0.5">By Mail</span>
            <span className="text-muted">Data Privacy Officer, YITU Group, 222 Main South Road, Hornby, Christchurch 8042</span>
          </div>
          <div>
            <span className="font-semibold text-navy block mb-0.5">By Telephone</span>
            <a href="tel:0800948888" className="text-orange hover:underline">0800 948 888</a>
          </div>
          <div>
            <span className="font-semibold text-navy block mb-0.5">By Email</span>
            <a href="mailto:info@yitugroup.co.nz" className="text-orange hover:underline">info@yitugroup.co.nz</a>
          </div>
        </div>
      </>
    ),
  },
]

export async function PrivacyPolicyPageContent({forcedLocale}: {forcedLocale?: 'en' | 'zh'} = {}) {
  const locale = forcedLocale ?? await getLocale()

  if (locale === 'zh') {
    return (
      <LegalPageLayout
        badge="隐私声明 · 更新于 2024年3月"
        title="隐私声明"
        subtitle="了解 YITU New Zealand 如何在您租车、访问网站或使用应用服务时收集、使用、共享和保护您的个人信息。"
        lastUpdated="最后更新：2024年3月"
        sections={zhPrivacySections}
        tocLinks={zhPrivacyToc}
      />
    )
  }

  return (
    <LegalPageLayout
      badge="Privacy Notice · Updated March 2024"
      title="Privacy Notice"
      subtitle="How YITU New Zealand collects, uses and protects your personal information when you rent with us."
      lastUpdated="Last updated: March 2024"
      sections={SECTIONS}
      tocLinks={TOC}
    />
  )
}

export default async function PrivacyPolicyPage() {
  return <PrivacyPolicyPageContent />
}
