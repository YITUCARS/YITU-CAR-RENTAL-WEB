import { WearAndTearPageContent } from '../../wear-and-tear/page'

export default async function LocaleWearAndTearPage({
  params,
}: {
  params: {locale: 'en' | 'zh'}
}) {
  return <WearAndTearPageContent forcedLocale={params.locale} />
}
