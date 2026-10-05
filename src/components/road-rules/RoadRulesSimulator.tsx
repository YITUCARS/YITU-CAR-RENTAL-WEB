'use client'

import { Pause, Play, RotateCcw } from 'lucide-react'
import { SCENARIOS } from './scenarios'
import { COPY, OPTION_ACTIVE, OptionIcon, SignalStatus, type Lang } from './controls'
import ScenarioStage from './ScenarioStage'
import { useScenarioPlayer } from './useScenarioPlayer'

export default function RoadRulesSimulator({ locale }: { locale: Lang }) {
    const copy = COPY[locale]
    const player = useScenarioPlayer()
    const { scenario, option, caption, crashed, finished, playing, progress } = player

    return (
        <div className="rounded-card bg-white shadow-card">
            <div className="flex gap-2 overflow-x-auto border-b border-black/5 p-3 sm:p-4" role="tablist">
                {SCENARIOS.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={i === player.index}
                        onClick={() => player.selectScenario(i)}
                        className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${i === player.index ? 'bg-navy text-white' : 'bg-off-white text-navy hover:bg-navy/10'}`}
                    >
                        {i + 1}. {item.title[locale]}
                    </button>
                ))}
            </div>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
                <div>
                    <ScenarioStage
                        scenario={scenario}
                        variant={player.variant}
                        actorTime={player.actorTime}
                        crash={player.crash}
                        copy={copy}
                        label={`${scenario.title[locale]} — ${caption[locale]}`}
                        className="rounded-[12px]"
                    />

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={player.togglePlay}
                            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange px-4 text-[13px] font-bold text-white shadow-orange-glow transition-colors hover:bg-orange-dark"
                        >
                            {playing ? <Pause size={16} /> : finished ? <RotateCcw size={16} /> : <Play size={16} />}
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

                <div className="flex flex-col">
                    <div className="inline-flex self-start rounded-full bg-off-white p-1">
                        {player.options.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => player.selectOption(item.id)}
                                aria-pressed={option.id === item.id}
                                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${option.id === item.id
                                    ? OPTION_ACTIVE[item.tone]
                                    : 'text-muted hover:text-navy'}`}
                            >
                                <OptionIcon option={item} />
                                {item.label ? item.label[locale] : copy[item.tone as 'correct' | 'mistake']}
                            </button>
                        ))}
                    </div>

                    <h3 className="mt-5 font-syne text-[22px] font-bold leading-tight text-navy">{scenario.title[locale]}</h3>
                    <p
                        aria-live="polite"
                        className={`mt-3 min-h-[3.5em] text-[17px] font-semibold leading-snug ${crashed ? 'text-red-600' : finished && option.tone !== 'mistake' ? 'text-emerald-700' : 'text-navy'}`}
                    >
                        {caption[locale]}
                    </p>
                    {player.hero && <SignalStatus side={player.heroSignal} copy={copy} />}
                    <p className="mt-4 text-[14.5px] leading-relaxed text-gray-700">{scenario.rule[locale]}</p>
                    <p className="mt-3 border-l-2 border-orange pl-3 text-[13.5px] leading-relaxed text-muted">{scenario.tip[locale]}</p>
                </div>
            </div>
        </div>
    )
}
