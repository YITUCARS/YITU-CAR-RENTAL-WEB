import {AboutPageContent} from '../../about/page'

export default async function LocaleAboutPage({
  params,
}: {
  params: {locale: 'en' | 'zh'}
}) {
  return <AboutPageContent forcedLocale={params.locale} />
}
