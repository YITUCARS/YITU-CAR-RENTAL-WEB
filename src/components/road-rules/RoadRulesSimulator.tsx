'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowUp, Check, CornerUpLeft, CornerUpRight, Pause, Play, RotateCcw, X } from 'lucide-react'
import { SCENARIOS, optionsOf, poseAt, signalAt, type Actor, type ScenarioOption, type SceneKind } from './scenarios'

// three.js only loads on this page, in the browser. Without WebGL the flat
// SVG stage below is used instead.
const Stage3D = dynamic(() => import('./Stage3D'), {
    ssr: false,
    loading: () => <div className="w-full" style={{ aspectRatio: '1.6', background: '#cfdcc0' }} />,
})

const DURATION_MS = 7000
const GRASS = '#d9ecd0'
const ROAD = '#5b6472'

type Lang = 'en' | 'zh'

const COPY = {
    en: { correct: 'Correct', mistake: 'Common mistake', play: 'Play', pause: 'Pause', replay: 'Replay', scrub: 'Animation progress', you: 'You', giveWay: 'GIVE WAY', bay: 'SLOW VEHICLE BAY', bridge: 'ONE LANE BRIDGE', signal: 'Indicator', signalOff: 'Off', signalLeft: 'Left', signalRight: 'Right' },
    zh: { correct: '正确做法', mistake: '常见错误', play: '播放', pause: '暂停', replay: '重播', scrub: '动画进度', you: '你', giveWay: '让行', bay: '慢车避让区', bridge: '单车道桥', signal: '转向灯', signalOff: '不打灯', signalLeft: '左转灯', signalRight: '右转灯' },
}

function Dashes({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={2} strokeDasharray="10 9" opacity={0.85} />
}

function GiveWaySign({ x, y, label }: { x: number; y: number; label: string }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <line x1={0} y1={6} x2={0} y2={24} stroke="#475569" strokeWidth={2} />
            <polygon points="-11,-9 11,-9 0,9" fill="#fff" stroke="#dc2626" strokeWidth={3} strokeLinejoin="round" />
            <text y={36} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1a2b6b">{label}</text>
        </g>
    )
}

function Scene({ kind, copy }: { kind: SceneKind; copy: (typeof COPY)[Lang] }) {
    switch (kind) {
        case 'keepLeft':
            return <>
                <rect x={0} y={115} width={400} height={70} fill={ROAD} />
                <rect x={178} y={185} width={44} height={115} fill={ROAD} />
                <Dashes x1={0} y1={150} x2={172} y2={150} />
                <Dashes x1={228} y1={150} x2={400} y2={150} />
                <Dashes x1={200} y1={196} x2={200} y2={300} />
                <line x1={178} y1={190} x2={200} y2={190} stroke="#fff" strokeWidth={3} />
            </>
        case 'roundabout':
            return <>
                <rect x={0} y={128} width={400} height={44} fill={ROAD} />
                <rect x={178} y={0} width={44} height={300} fill={ROAD} />
                <circle cx={200} cy={150} r={74} fill={ROAD} />
                <circle cx={200} cy={150} r={34} fill={GRASS} stroke="#fff" strokeWidth={3} />
                <Dashes x1={0} y1={150} x2={118} y2={150} />
                <Dashes x1={282} y1={150} x2={400} y2={150} />
                <Dashes x1={200} y1={0} x2={200} y2={68} />
                <Dashes x1={200} y1={232} x2={200} y2={300} />
                <line x1={178} y1={228} x2={200} y2={228} stroke="#fff" strokeWidth={3} strokeDasharray="5 3" />
                <GiveWaySign x={160} y={250} label={copy.giveWay} />
            </>
        case 'bridge':
            return <>
                <rect x={160} y={0} width={80} height={300} fill="#8ecae6" />
                <rect x={0} y={115} width={135} height={70} fill={ROAD} />
                <rect x={265} y={115} width={135} height={70} fill={ROAD} />
                <polygon points="135,115 150,134 150,166 135,185" fill={ROAD} />
                <polygon points="265,115 250,134 250,166 265,185" fill={ROAD} />
                <rect x={150} y={134} width={100} height={32} fill="#7c7368" />
                <line x1={150} y1={134} x2={250} y2={134} stroke="#3f3a35" strokeWidth={3} />
                <line x1={150} y1={166} x2={250} y2={166} stroke="#3f3a35" strokeWidth={3} />
                <Dashes x1={0} y1={150} x2={130} y2={150} />
                <Dashes x1={270} y1={150} x2={400} y2={150} />
                <GiveWaySign x={78} y={62} label={copy.giveWay} />
                <text x={200} y={124} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1a2b6b">{copy.bridge}</text>
            </>
        case 'turnGiveWay':
            return <>
                <rect x={0} y={128} width={400} height={44} fill={ROAD} />
                <rect x={178} y={0} width={44} height={300} fill={ROAD} />
                <Dashes x1={0} y1={150} x2={172} y2={150} />
                <Dashes x1={228} y1={150} x2={400} y2={150} />
                <Dashes x1={200} y1={0} x2={200} y2={122} />
                <Dashes x1={200} y1={178} x2={200} y2={300} />
                <line x1={178} y1={176} x2={200} y2={176} stroke="#fff" strokeWidth={3} />
                <line x1={200} y1={124} x2={222} y2={124} stroke="#fff" strokeWidth={3} />
            </>
        case 'overtake':
            return <>
                <rect x={0} y={115} width={400} height={70} fill={ROAD} />
                <polygon points="200,115 225,93 320,93 345,115" fill={ROAD} />
                <line x1={0} y1={147} x2={400} y2={147} stroke="#facc15" strokeWidth={2.5} />
                <line x1={0} y1={153} x2={400} y2={153} stroke="#facc15" strokeWidth={2.5} />
                <text x={272} y={86} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1a2b6b">{copy.bay}</text>
            </>
    }
}

function Vehicle({ actor, t, label }: { actor: Actor; t: number; label: string }) {
    const pose = poseAt(actor.keys, t)
    if (!pose) return null
    const long = actor.kind === 'van'
    const w = long ? 40 : 28
    const h = long ? 17 : 15
    const body = actor.kind === 'hero' ? '#e8431a' : actor.kind === 'van' ? '#f8fafc' : '#1a2b6b'
    return (
        <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.r})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={body} stroke="#0f172a" strokeWidth={1} />
            <rect x={w / 2 - 10} y={-h / 2 + 2.5} width={5} height={h - 5} rx={1.5} fill="#bfdbfe" />
            {actor.kind === 'hero' && (
                <g transform={`rotate(${-pose.r})`}>
                    <text y={-13} textAnchor="middle" fontSize={9} fontWeight={700} fill="#e8431a" stroke="#fff" strokeWidth={3} paintOrder="stroke">{label}</text>
                </g>
            )}
        </g>
    )
}

const OPTION_ACTIVE: Record<ScenarioOption['tone'], string> = {
    correct: 'bg-emerald-600 text-white',
    mistake: 'bg-red-600 text-white',
    choice: 'bg-navy text-white',
}

function OptionIcon({ option }: { option: ScenarioOption }) {
    if (option.icon === 'left') return <CornerUpLeft size={15} />
    if (option.icon === 'right') return <CornerUpRight size={15} />
    if (option.icon === 'straight') return <ArrowUp size={15} />
    return option.tone === 'mistake' ? <X size={15} /> : <Check size={15} />
}

// Shows which indicator the visitor's car is using right now.
function SignalStatus({ side, copy }: { side: 'left' | 'right' | null; copy: (typeof COPY)[Lang] }) {
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

export default function RoadRulesSimulator({ locale }: { locale: Lang }) {
    const copy = COPY[locale]
    const [index, setIndex] = useState(0)
    const [mode, setMode] = useState('correct')
    const [progress, setProgressState] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [webgl, setWebgl] = useState(true)
    const frame = useRef<number>()
    const progressRef = useRef(0)
    const setProgress = (value: number) => { progressRef.current = value; setProgressState(value) }

    const scenario = SCENARIOS[index]
    const options = optionsOf(scenario)
    const option = options.find(item => item.id === mode) ?? options[0]
    const variant = option.variant
    const crash = variant.crash
    const actorTime = crash ? Math.min(progress, crash.t) : progress
    const crashed = Boolean(crash && progress >= crash.t)
    const finished = progress >= 1 || crashed
    const caption = [...variant.captions].reverse().find(item => item.t <= progress) || variant.captions[0]
    const hero = variant.actors.find(actor => actor.kind === 'hero')
    const heroSignal = hero && poseAt(hero.keys, actorTime) && !crashed ? signalAt(hero, actorTime) : null

    // A link such as /nz-road-rules#roundabout-signals/right opens that
    // scenario (and option), so a scenario can be shared directly.
    useEffect(() => {
        const [scenarioId, optionId] = window.location.hash.slice(1).split('/')
        const linked = SCENARIOS.findIndex(item => item.id === scenarioId)
        if (linked < 0) return
        const linkedOptions = optionsOf(SCENARIOS[linked])
        setIndex(linked)
        setMode((linkedOptions.find(item => item.id === optionId) ?? linkedOptions[0]).id)
    }, [])

    // Restart whenever the scene changes. Visitors who prefer reduced motion
    // see the finished scene and can still press play.
    useEffect(() => {
        const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        setProgress(reduced ? 1 : 0)
        setPlaying(!reduced)
    }, [index, mode])

    useEffect(() => {
        if (!playing) return
        let last = performance.now()
        const tick = (now: number) => {
            const next = Math.min(1, progressRef.current + (now - last) / DURATION_MS)
            last = now
            setProgress(next)
            if (next >= (crash ? crash.t + 0.08 : 1)) setPlaying(false)
            else frame.current = requestAnimationFrame(tick)
        }
        frame.current = requestAnimationFrame(tick)
        return () => { if (frame.current) cancelAnimationFrame(frame.current) }
    }, [playing, crash])

    const togglePlay = () => {
        if (playing) return setPlaying(false)
        if (finished) setProgress(0)
        setPlaying(true)
    }

    return (
        <div className="rounded-card bg-white shadow-card">
            <div className="flex gap-2 overflow-x-auto border-b border-black/5 p-3 sm:p-4" role="tablist">
                {SCENARIOS.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        onClick={() => { setIndex(i); setMode(optionsOf(item)[0].id) }}
                        className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${i === index ? 'bg-navy text-white' : 'bg-off-white text-navy hover:bg-navy/10'}`}
                    >
                        {i + 1}. {item.title[locale]}
                    </button>
                ))}
            </div>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
                <div>
                    <div className="relative overflow-hidden rounded-[12px]" style={{ background: GRASS }} aria-label={`${scenario.title[locale]} — ${caption[locale]}`} role="img">
                        {webgl ? (
                            <Stage3D
                                scene={scenario.scene}
                                actors={variant.actors}
                                t={actorTime}
                                crash={crashed && crash ? crash : null}
                                labels={copy}
                                onUnsupported={() => setWebgl(false)}
                            />
                        ) : <svg viewBox="0 0 400 300" className="block h-auto w-full" aria-hidden="true">
                            <Scene kind={scenario.scene} copy={copy} />
                            {variant.actors.map(actor => <Vehicle key={actor.id} actor={actor} t={actorTime} label={copy.you} />)}
                            {crashed && crash && (
                                <g transform={`translate(${crash.x} ${crash.y})`}>
                                    <circle r={22} fill="#dc2626" opacity={0.25}>
                                        <animate attributeName="r" from="8" to="30" dur="0.6s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.5" to="0" dur="0.6s" repeatCount="indefinite" />
                                    </circle>
                                    <polygon points="0,-14 4,-5 14,-6 7,2 11,12 0,6 -11,12 -7,2 -14,-6 -4,-5" fill="#facc15" stroke="#dc2626" strokeWidth={2} />
                                </g>
                            )}
                        </svg>}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={togglePlay}
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
                            onChange={event => { setPlaying(false); setProgress(Number(event.target.value) / 1000) }}
                            aria-label={copy.scrub}
                            className="w-full accent-orange"
                        />
                    </div>
                </div>

                <div className="flex flex-col">
                    <div className="inline-flex self-start rounded-full bg-off-white p-1">
                        {options.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setMode(item.id)}
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
                    {hero && <SignalStatus side={heroSignal} copy={copy} />}
                    <p className="mt-4 text-[14.5px] leading-relaxed text-gray-700">{scenario.rule[locale]}</p>
                    <p className="mt-3 border-l-2 border-orange pl-3 text-[13.5px] leading-relaxed text-muted">{scenario.tip[locale]}</p>
                </div>
            </div>
        </div>
    )
}
