'use client'

import { useEffect, useRef, useState } from 'react'
import { SCENARIOS, optionsOf, poseAt, signalAt } from './scenarios'

const DURATION_MS = 7000

// Playback state shared by the website simulator and the mobile H5 page.
// A link such as #roundabout-signals/right opens that scenario and option;
// with `syncHash` the address keeps following the visitor's choice, so the
// page can be shared at the scenario being watched.
export function useScenarioPlayer({ syncHash = false }: { syncHash?: boolean } = {}) {
    const [index, setIndex] = useState(0)
    const [mode, setMode] = useState('correct')
    const [progress, setProgressState] = useState(0)
    const [playing, setPlaying] = useState(false)
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

    // Remember the address the page was opened with: the hash is rewritten as
    // the visitor moves on (and React may run this effect twice in development).
    const openedWith = useRef<string | null>(null)
    useEffect(() => {
        openedWith.current ??= window.location.hash
        const [scenarioId, optionId] = openedWith.current.slice(1).split('/')
        const linked = SCENARIOS.findIndex(item => item.id === scenarioId)
        if (linked < 0) return
        const linkedOptions = optionsOf(SCENARIOS[linked])
        setIndex(linked)
        setMode((linkedOptions.find(item => item.id === optionId) ?? linkedOptions[0]).id)
    }, [])

    useEffect(() => {
        if (!syncHash) return
        const hash = `#${scenario.id}${option.id === options[0].id ? '' : `/${option.id}`}`
        if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    }, [syncHash, scenario.id, option.id, options[0].id])

    // Restart whenever the scene changes. Visitors who prefer reduced motion
    // see the finished scene and can still press play.
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

    return {
        index,
        scenario,
        options,
        option,
        variant,
        progress,
        playing,
        actorTime,
        crash: crashed && crash ? crash : null,
        crashed,
        finished,
        caption,
        hero,
        heroSignal,
        selectScenario: (i: number) => { setIndex(i); setMode(optionsOf(SCENARIOS[i])[0].id) },
        selectOption: setMode,
        togglePlay: () => {
            if (playing) return setPlaying(false)
            if (finished) setProgress(0)
            setPlaying(true)
        },
        scrub: (value: number) => { setPlaying(false); setProgress(value) },
    }
}
