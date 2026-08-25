import LegalPageLayout from '@/components/ui/LegalPageLayout'
import {getLocale} from 'next-intl/server'
import {redirect} from 'next/navigation'
import {enTermsSections, enTermsToc} from '@/content/legal/terms-conditions.en'
import {zhTermsSections, zhTermsToc} from '@/content/legal/terms-conditions.zh'

export async function TermsConditionsPageContent({forcedLocale}: {forcedLocale?: 'en' | 'zh'} = {}) {
  const locale = forcedLocale ?? await getLocale()

  if (locale === 'zh') {
    return (
      <LegalPageLayout
        badge="租赁条款与条件 · 中文译文"
        title="条款与条件"
        subtitle="以下页面展示《车辆租赁合同》中的租赁合同及条款条件中文译文，便于您理解租赁条款内容。"
        lastUpdated="来源：Rental_agreement_中文译文.docx"
        sections={zhTermsSections}
        tocLinks={zhTermsToc}
      />
    )
  }

  return (
    <LegalPageLayout
      badge="Rental Terms & Conditions"
      title="Terms & Conditions"
      subtitle="Please read these Terms and Conditions before You sign the Rental Agreement. This page contains the rental contract terms from YITU Prestige Car Rentals."
      lastUpdated="Extracted from the current rental agreement PDF"
      sections={enTermsSections}
      tocLinks={enTermsToc}
    />
  )
}

export default async function TermsConditionsPage() {
  // Keep the non-localized legacy URL working without evaluating the longform
  // source file in a dynamic root request on Vercel.
  redirect('/en/terms-conditions')
}
