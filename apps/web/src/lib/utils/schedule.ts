type Schedulable = {
  daysOfWeek: number[];
  departureTimeUtc: string;
};

function parseUtcTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/u.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return {
    hours,
    minutes,
  };
}

function normalizeUtcDayOfWeek(date: Date): number {
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function getNextScheduledDepartureUtc(
  schedule: Schedulable,
  fromDate = new Date(),
): Date | null {
  const departureTime = parseUtcTime(schedule.departureTimeUtc);

  if (!departureTime) {
    return null;
  }

  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = new Date(
      Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate() + offset,
        departureTime.hours,
        departureTime.minutes,
        0,
        0,
      ),
    );

    if (
      schedule.daysOfWeek.includes(normalizeUtcDayOfWeek(candidate)) &&
      candidate.getTime() > fromDate.getTime()
    ) {
      return candidate;
    }
  }

  return null;
}

export function buildNextBookedForIso(
  schedule: Schedulable,
  fromDate = new Date(),
): string | null {
  const nextDeparture = getNextScheduledDepartureUtc(schedule, fromDate);

  return nextDeparture ? nextDeparture.toISOString() : null;
}
