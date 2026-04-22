import { getTranslations } from 'next-intl/server'
import AboutPageShell from '@/components/about/AboutPageShell'

export const metadata = {
  title: 'About Us | YITU Car Rental',
  description: 'Learn about YITU Car Rental — New Zealand-based, dedicated to reliable, comfortable and affordable transportation.',
}

export async function AboutPageContent({forcedLocale}: {forcedLocale?: 'en' | 'zh'} = {}) {
  const t = forcedLocale
    ? await getTranslations({locale: forcedLocale})
    : await getTranslations()

  return (
    <AboutPageShell
      kicker={t('AboutPage.kicker')}
      titlePrefix={t('AboutPage.titlePrefix')}
      titleAccent={t('AboutPage.titleAccent')}
      titleSuffix={t('AboutPage.titleSuffix')}
      subtitle={t('AboutPage.subtitle')}
      ourStory={t('AboutPage.ourStory')}
      storyP1={t('AboutPage.story.p1')}
      storyP2={t('AboutPage.story.p2')}
      storyP3={t('AboutPage.story.p3')}
      valueReliabilityTitle={t('AboutPage.values.reliability.title')}
      valueReliabilityBody={t('AboutPage.values.reliability.body')}
      valueTransparencyTitle={t('AboutPage.values.transparency.title')}
      valueTransparencyBody={t('AboutPage.values.transparency.body')}
      valueCustomerFirstTitle={t('AboutPage.values.customerFirst.title')}
      valueCustomerFirstBody={t('AboutPage.values.customerFirst.body')}
      getInTouch={t('AboutPage.getInTouch')}
      phone={t('AboutPage.phone')}
      email={t('AboutPage.email')}
      address={t('AboutPage.address')}
      addressValue={t('AboutPage.addressValue')}
      bookVehicle={t('AboutPage.bookVehicle')}
    />
  )
}

export default async function AboutPage() {
  return <AboutPageContent />
}
