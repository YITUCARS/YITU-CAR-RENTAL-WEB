import {PrivacyPolicyPageContent} from '../../privacy-policy/page'

export default async function LocalePrivacyPolicyPage({
  params,
}: {
  params: {locale: 'en' | 'zh'}
}) {
  return <PrivacyPolicyPageContent forcedLocale={params.locale} />
}
