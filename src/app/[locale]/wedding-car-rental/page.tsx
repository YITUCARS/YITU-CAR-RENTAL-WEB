import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import WeddingPageShell from '@/components/wedding/WeddingPageShell'

const siteUrl = 'https://www.yiturentalcars.co.nz'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const isZh = params.locale === 'zh'
    const title = isZh ? '新西兰婚车租赁 | 婚礼用车 | 易途租车' : 'Wedding Car Hire New Zealand | YITU Car Rental'
    const description = isZh
        ? '预订新西兰婚礼用车和庆典婚车，提供基督城、皇后镇等地的豪华车辆、婚车车队和灵活婚礼用车安排。'
        : 'Hire a wedding car in New Zealand with YITU. Choose elegant wedding cars, luxury vehicles and coordinated wedding transport for Christchurch, Queenstown and South Island celebrations.'
    return {
        title,
        description,
        keywords: isZh
            ? ['新西兰婚车租赁', '婚礼用车新西兰', '基督城婚车', '皇后镇婚车', '婚车车队', '豪华婚车']
            : ['wedding car hire New Zealand', 'wedding car rental NZ', 'Christchurch wedding cars', 'Queenstown wedding cars', 'luxury wedding car hire', 'wedding transport South Island'],
        alternates: {
            canonical: `${siteUrl}/${params.locale}/wedding-car-rental`,
            languages: {
                'en-NZ': `${siteUrl}/en/wedding-car-rental`,
                'zh-Hans': `${siteUrl}/zh/wedding-car-rental`,
            },
        },
        openGraph: {
            title,
            description,
            url: `${siteUrl}/${params.locale}/wedding-car-rental`,
            siteName: 'YITU Car Rental',
            type: 'website',
            locale: isZh ? 'zh_CN' : 'en_NZ',
            images: [{ url: `${siteUrl}/wedding-hero.webp`, width: 4614, height: 2597, alt: isZh ? '新西兰婚礼婚车' : 'Wedding cars in New Zealand' }],
        },
        twitter: { card: 'summary_large_image', title, description, images: [`${siteUrl}/wedding-hero.webp`] },
    }
}

export default async function WeddingCarRentalPage({ params }: { params: { locale: string } }) {
    const t = await getTranslations('WeddingPage')
    const locale = params.locale === 'zh' ? 'zh' : 'en'
    return <>
        <WeddingPageShell
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: locale === 'zh' ? '新西兰婚车租赁' : 'Wedding Car Hire New Zealand',
            serviceType: 'Wedding car hire',
            provider: { '@type': 'LocalBusiness', name: 'YITU Car Rental', url: siteUrl, telephone: '+64 800 948 888' },
            areaServed: ['Christchurch', 'Queenstown', 'New Zealand'],
            url: `${siteUrl}/${locale}/wedding-car-rental`,
            image: `${siteUrl}/wedding-hero.webp`,
        }) }} />
    </>
}
