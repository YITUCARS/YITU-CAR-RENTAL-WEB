'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { poseAt, type Actor, type Scenario, type SceneKind, type Variant } from './scenarios'
import type { StageCopy } from './controls'

// three.js only loads in the browser, on pages that show a scenario. Without
// WebGL the flat SVG stage below is used instead.
const Stage3D = dynamic(() => import('./Stage3D'), {
    ssr: false,
    loading: () => <div className="w-full" style={{ aspectRatio: '1.6', background: '#cfdcc0' }} />,
})

const GRASS = '#d9ecd0'
const ROAD = '#5b6472'

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

function Scene({ kind, copy }: { kind: SceneKind; copy: StageCopy }) {
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

type Props = {
    scenario: Scenario
    variant: Variant
    actorTime: number
    crash: Variant['crash'] | null
    copy: StageCopy
    label: string
    className?: string
}

export default function ScenarioStage({ scenario, variant, actorTime, crash, copy, label, className = '' }: Props) {
    const [webgl, setWebgl] = useState(true)
    return (
        <div className={`relative overflow-hidden ${className}`} style={{ background: GRASS }} aria-label={label} role="img">
            {webgl ? (
                <Stage3D
                    scene={scenario.scene}
                    actors={variant.actors}
                    t={actorTime}
                    crash={crash}
                    labels={copy}
                    onUnsupported={() => setWebgl(false)}
                />
            ) : <svg viewBox="0 0 400 300" className="block h-auto w-full" aria-hidden="true">
                <Scene kind={scenario.scene} copy={copy} />
                {variant.actors.map(actor => <Vehicle key={actor.id} actor={actor} t={actorTime} label={copy.you} />)}
                {crash && (
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
    )
}
