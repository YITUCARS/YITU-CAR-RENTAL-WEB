// Pick-up and drop-off times are always New Zealand local time, whatever the
// customer's browser or the server is set to.
const NZ_TIME_ZONE = 'Pacific/Auckland'

function nzParts(ms: number) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: NZ_TIME_ZONE, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(ms)).map(part => [part.type, Number(part.value)]))
    return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute }
}

/** Epoch ms of an NZ-local `YYYY-MM-DD` + `HH:mm`. */
export function nzLocalToMs(date: string, time: string) {
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = (time || '10:00').split(':').map(Number)
    const asUtc = Date.UTC(y, m - 1, d, hh, mm)
    const p = nzParts(asUtc)
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - asUtc
    return asUtc - offset
}

/** NZ-local `YYYY-MM-DD` and `HH:mm` for an epoch ms. */
export function msToNzLocal(ms: number) {
    const p = nzParts(ms)
    const two = (value: number) => String(value).padStart(2, '0')
    return { date: `${p.year}-${two(p.month)}-${two(p.day)}`, time: `${two(p.hour)}:${two(p.minute)}` }
}

export function hoursUntilNz(date: string, time: string) {
    return (nzLocalToMs(date, time) - Date.now()) / 36e5
}
