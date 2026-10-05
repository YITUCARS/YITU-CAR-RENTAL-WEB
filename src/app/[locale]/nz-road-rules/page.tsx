import type { Metadata } from 'next'
import RoadRulesPageShell from '@/components/road-rules/RoadRulesPageShell'

const siteUrl = 'https://www.yiturentalcars.co.nz'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const isZh = params.locale === 'zh'
    // The root layout template appends " | YITU Car Rental".
    const title = isZh ? '新西兰交规动画演示 | 游客自驾必看' : 'NZ Road Rules for Visitors, Animated'
    const description = isZh
        ? '用动画演示游客在新西兰自驾最容易出错的场景：靠左行驶、环岛让行、单车道桥、右转让对向左转、黄色实线禁止超车，以及环岛打灯规则。'
        : 'Animated guide to New Zealand road rules for visitors: keeping left, roundabouts, one-lane bridges, right turns giving way to left turns, no overtaking on yellow lines, and how to signal at roundabouts.'
    return {
        title,
        description,
        keywords: isZh
            ? ['新西兰交规', '新西兰自驾', '新西兰靠左行驶', '新西兰环岛规则', '单车道桥', '新西兰租车']
            : ['NZ road rules', 'New Zealand road rules for tourists', 'driving in New Zealand', 'NZ roundabout rules', 'one lane bridge NZ', 'keep left New Zealand'],
        alternates: {
            canonical: `${siteUrl}/${params.locale}/nz-road-rules`,
            languages: {
                'en-NZ': `${siteUrl}/en/nz-road-rules`,
                'zh-Hans': `${siteUrl}/zh/nz-road-rules`,
            },
        },
        openGraph: {
            title,
            description,
            url: `${siteUrl}/${params.locale}/nz-road-rules`,
            siteName: 'YITU Car Rental',
            type: 'website',
            locale: isZh ? 'zh_CN' : 'en_NZ',
        },
    }
}

export default function NzRoadRulesPage({ params }: { params: { locale: string } }) {
    return <RoadRulesPageShell locale={params.locale === 'zh' ? 'zh' : 'en'} />
}
