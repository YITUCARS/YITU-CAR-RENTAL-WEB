import type { Metadata } from 'next'
import RoadRulesH5 from '@/components/road-rules/RoadRulesH5'

const siteUrl = 'https://www.yiturentalcars.co.nz'
const title = '新西兰自驾交规动画 | 易途租车'
const description = '6 个游客最容易出错的场景：靠左行驶、环岛让行、单车道桥、右转让左转、黄色实线禁止超车、环岛打灯。'

// Mobile page shared with customers in WeChat (also opened inside the mini
// program's web-view). The full desktop page lives at /[locale]/nz-road-rules.
export const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical: `${siteUrl}/zh/nz-road-rules` },
    robots: { index: false, follow: true },
    openGraph: {
        title,
        description,
        url: `${siteUrl}/h5/road-rules`,
        siteName: '易途租车 YITU Car Rental',
        type: 'website',
        locale: 'zh_CN',
        images: [{ url: `${siteUrl}/h5/road-rules-cover.jpg`, width: 1000, height: 800, alt: '新西兰自驾交规动画' }],
    },
}

export default function RoadRulesH5Page() {
    return <RoadRulesH5 />
}
