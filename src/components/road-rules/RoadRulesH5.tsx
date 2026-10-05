'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { SCENARIOS } from './scenarios'
import { COPY, OPTION_ACTIVE, OptionIcon, SignalStatus } from './controls'
import ScenarioStage from './ScenarioStage'
import { useScenarioPlayer } from './useScenarioPlayer'

const copy = COPY.zh

type MiniProgramBridge = { miniProgram?: { switchTab: (options: { url: string }) => void } }

// Inside the WeChat mini program's web-view, the page can hand the visitor back
// to the mini program through WeChat's JS bridge (loaded only there).
function useMiniProgram() {
    const [inMiniProgram, setInMiniProgram] = useState(false)
    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase()
        const flagged = (window as unknown as { __wxjs_environment?: string }).__wxjs_environment === 'miniprogram'
        if (!flagged && !ua.includes('miniprogram')) return
        setInMiniProgram(true)
        if (document.getElementById('wx-jssdk')) return
        const script = document.createElement('script')
        script.id = 'wx-jssdk'
        script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
        document.head.appendChild(script)
    }, [])
    const openMiniProgramHome = () => {
        const wx = (window as unknown as { wx?: MiniProgramBridge }).wx
        wx?.miniProgram?.switchTab({ url: '/pages/index/index' })
    }
    return { inMiniProgram, openMiniProgramHome }
}

export default function RoadRulesH5() {
    const player = useScenarioPlayer({ syncHash: true })
    const { scenario, option, caption, crashed, finished, playing, progress, index } = player
    const { inMiniProgram, openMiniProgramHome } = useMiniProgram()
    const chips = useRef<HTMLElement>(null)

    // Keep the selected scenario's chip in view in the scrolling row.
    useEffect(() => {
        const row = chips.current
        const chip = row?.children[index] as HTMLElement | undefined
        if (row && chip) row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2, behavior: 'smooth' })
    }, [index])

    const go = (step: number) => {
        player.selectScenario((index + step + SCENARIOS.length) % SCENARIOS.length)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <main className="mx-auto min-h-[100svh] max-w-[560px] bg-off-white pb-10">
            <header className="bg-navy px-4 pb-4 pt-5 text-white">
                <p className="text-[11px] font-bold tracking-[0.16em] text-orange">易途租车 · 新西兰自驾</p>
                <h1 className="mt-1 text-[22px] font-extrabold leading-tight">新西兰自驾交规动画</h1>
                <p className="mt-1 text-[13px] leading-relaxed text-white/75">6 个游客最容易出错的场景，看动画学会在新西兰开车。</p>
            </header>

            <div className="sticky top-0 z-20 bg-off-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                <ScenarioStage
                    scenario={scenario}
                    variant={player.variant}
                    actorTime={player.actorTime}
                    crash={player.crash}
                    copy={copy}
                    label={`${scenario.title.zh}：${caption.zh}`}
                />
                <div className="flex items-center gap-3 bg-white px-4 py-2.5">
                    <button
                        type="button"
                        onClick={player.togglePlay}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-orange px-3.5 text-[13px] font-bold text-white"
                    >
                        {playing ? <Pause size={15} /> : finished ? <RotateCcw size={15} /> : <Play size={15} />}
                        {playing ? copy.pause : finished ? copy.replay : copy.play}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        value={Math.round(progress * 1000)}
                        onChange={event => player.scrub(Number(event.target.value) / 1000)}
                        aria-label={copy.scrub}
                        className="w-full accent-orange"
                    />
                </div>
            </div>

            <nav ref={chips} className="flex gap-2 overflow-x-auto px-4 pb-1 pt-4 [scrollbar-width:none]" aria-label="场景">
                {SCENARIOS.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-current={i === index}
                        onClick={() => player.selectScenario(i)}
                        className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${i === index ? 'bg-navy text-white' : 'bg-white text-navy'}`}
                    >
                        {i + 1}. {item.title.zh}
                    </button>
                ))}
            </nav>

            <section className="px-4 pt-3">
                <div className="grid gap-1 rounded-full bg-white p-1" style={{ gridTemplateColumns: `repeat(${player.options.length}, minmax(0, 1fr))` }}>
                    {player.options.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => player.selectOption(item.id)}
                            aria-pressed={option.id === item.id}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-bold ${option.id === item.id ? OPTION_ACTIVE[item.tone] : 'text-muted'}`}
                        >
                            <OptionIcon option={item} />
                            {item.label ? item.label.zh : copy[item.tone as 'correct' | 'mistake']}
                        </button>
                    ))}
                </div>

                <h2 className="mt-5 text-[20px] font-extrabold text-navy">{index + 1}. {scenario.title.zh}</h2>
                <p
                    aria-live="polite"
                    className={`mt-2 min-h-[3em] text-[17px] font-bold leading-snug ${crashed ? 'text-red-600' : finished && option.tone !== 'mistake' ? 'text-emerald-700' : 'text-navy'}`}
                >
                    {caption.zh}
                </p>
                {player.hero && <SignalStatus side={player.heroSignal} copy={copy} />}

                <h3 className="mt-6 text-[14px] font-bold text-navy">规则</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-gray-700">{scenario.rule.zh}</p>
                <p className="mt-4 border-l-2 border-orange pl-3 text-[14px] leading-relaxed text-muted">{scenario.tip.zh}</p>

                <div className="mt-8 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => go(-1)} className="inline-flex items-center justify-center gap-1 rounded-full bg-white py-3 text-[14px] font-bold text-navy">
                        <ChevronLeft size={17} /> 上一个场景
                    </button>
                    <button type="button" onClick={() => go(1)} className="inline-flex items-center justify-center gap-1 rounded-full bg-navy py-3 text-[14px] font-bold text-white">
                        下一个场景 <ChevronRight size={17} />
                    </button>
                </div>

                {inMiniProgram ? (
                    <button type="button" onClick={openMiniProgramHome} className="mt-3 w-full rounded-full bg-orange py-3 text-[14px] font-bold text-white">
                        去易途租车小程序订车
                    </button>
                ) : (
                    <a href="/zh" className="mt-3 block w-full rounded-full bg-orange py-3 text-center text-[14px] font-bold text-white">
                        在易途租车预订新西兰租车
                    </a>
                )}

                <p className="mt-6 text-[12px] leading-relaxed text-muted">
                    动画为简化示意。实际驾驶请以道路标志和新西兰交通局（NZ Transport Agency Waka Kotahi）发布的官方《道路规则》（Road Code）为准。
                </p>
            </section>
        </main>
    )
}
