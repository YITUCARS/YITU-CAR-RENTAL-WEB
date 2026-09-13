import { getTranslations } from 'next-intl/server'
import WeddingPageShell from '@/components/wedding/WeddingPageShell'

export const metadata = {
    title: 'Wedding Car Hire New Zealand | YITU Car Rental',
    description: 'Luxury wedding and celebration car hire in New Zealand with elegant vehicles, flexible arrangements and dedicated support from YITU Car Rental.',
}

export default async function WeddingCarRentalPage() {
    const t = await getTranslations('WeddingPage')
    return <WeddingPageShell
        kicker={t('kicker')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={t('cta')}
        back={t('back')}
        serviceTitle={t('serviceTitle')}
        serviceBody={t('serviceBody')}
        points={[t('pointOne'), t('pointTwo'), t('pointThree'), t('pointFour')]}
        contactTitle={t('contactTitle')}
        contactBody={t('contactBody')}
    />
}
