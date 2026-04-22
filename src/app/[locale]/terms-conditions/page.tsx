import {TermsConditionsPageContent} from '../../terms-conditions/page'

export default async function LocaleTermsConditionsPage({
  params,
}: {
  params: {locale: 'en' | 'zh'}
}) {
  return <TermsConditionsPageContent forcedLocale={params.locale} />
}
