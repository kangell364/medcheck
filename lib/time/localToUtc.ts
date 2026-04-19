/**
 * Convert a local date+time in an IANA timezone into a UTC ISO string.
 *
 * JS Date does not directly parse "YYYY-MM-DDTHH:mm" in a given timezone.
 * This helper uses an offset search: guess UTC, see what local time it formats to,
 * then adjust by the difference.
 */

export function localDateTimeToUtcIso(opts: {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  timezone: string // IANA tz
}): string {
  const { date, time, timezone } = opts
  const [hh, mm] = time.split(':').map(n => parseInt(n, 10))

  // Initial guess: interpret as UTC.
  let guess = new Date(`${date}T${time}:00.000Z`).getTime()

  // Iterate a couple times to converge (handles DST offsets).
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(guess))

    const get = (t: string) => parts.find(p => p.type === t)?.value
    const y = get('year')!
    const mo = get('month')!
    const da = get('day')!
    const h = parseInt(get('hour')!, 10)
    const m = parseInt(get('minute')!, 10)

    // Desired local minutes since midnight
    const wantMins = hh * 60 + mm
    const gotMins = h * 60 + m

    // If the date rolled, account for it by comparing YYYY-MM-DD.
    const gotDate = `${y}-${mo}-${da}`

    let dayDelta = 0
    if (gotDate < date) dayDelta = -1
    else if (gotDate > date) dayDelta = 1

    const deltaMinutes = (gotMins - wantMins) + dayDelta * 1440
    if (deltaMinutes === 0) break

    guess -= deltaMinutes * 60 * 1000
  }

  return new Date(guess).toISOString()
}
