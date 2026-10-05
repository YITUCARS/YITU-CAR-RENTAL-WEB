'use client'

import { ArrowUp, Check, CornerUpLeft, CornerUpRight, X } from 'lucide-react'
import type { ScenarioOption } from './scenarios'

export type Lang = 'en' | 'zh'

export const COPY = {
    en: { correct: 'Correct', mistake: 'Common mistake', play: 'Play', pause: 'Pause', replay: 'Replay', scrub: 'Animation progress', you: 'You', giveWay: 'GIVE WAY', bay: 'SLOW VEHICLE BAY', bridge: 'ONE LANE BRIDGE', signal: 'Indicator', signalOff: 'Off', signalLeft: 'Left', signalRight: 'Right' },
    zh: { correct: '正确做法', mistake: '常见错误', play: '播放', pause: '暂停', replay: '重播', scrub: '动画进度', you: '你', giveWay: '让行', bay: '慢车避让区', bridge: '单车道桥', signal: '转向灯', signalOff: '不打灯', signalLeft: '左转灯', signalRight: '右转灯' },
}

export type StageCopy = (typeof COPY)[Lang]

export const OPTION_ACTIVE: Record<ScenarioOption['tone'], string> = {
    correct: 'bg-emerald-600 text-white',
    mistake: 'bg-red-600 text-white',
    choice: 'bg-navy text-white',
}

export function OptionIcon({ option }: { option: ScenarioOption }) {
    if (option.icon === 'left') return <CornerUpLeft size={15} />
    if (option.icon === 'right') return <CornerUpRight size={15} />
    if (option.icon === 'straight') return <ArrowUp size={15} />
    return option.tone === 'mistake' ? <X size={15} /> : <Check size={15} />
}

// Shows which indicator the visitor's car is using right now.
export function SignalStatus({ side, copy }: { side: 'left' | 'right' | null; copy: StageCopy }) {
    const lamp = (on: boolean) => (
        <span className={`h-2.5 w-2.5 rounded-full ${on ? 'animate-pulse bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]' : 'bg-gray-300'}`} />
    )
    return (
        <div className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-off-white px-3 py-1.5 text-[13px] font-semibold text-navy">
            <span className="text-muted">{copy.signal}</span>
            {lamp(side === 'left')}
            <span className="min-w-[4.5em] text-center">{side === 'left' ? copy.signalLeft : side === 'right' ? copy.signalRight : copy.signalOff}</span>
            {lamp(side === 'right')}
        </div>
    )
}
