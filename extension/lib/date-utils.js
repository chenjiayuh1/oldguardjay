export function formatDateInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function getDayBounds(dateString, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const findUtcMidnight = (targetYear, targetMonth, targetDay) => {
    for (let utcHour = 0; utcHour < 48; utcHour += 1) {
      const instant = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, utcHour, 0, 0, 0));
      const formatted = instant.toLocaleString('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const [datePart, timePart] = formatted.split(', ');
      const [m, d, y] = datePart.split('/').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);

      if (y === targetYear && m === targetMonth && d === targetDay && hour === 0 && minute === 0) {
        return instant;
      }
    }

    throw new Error(`Could not resolve timezone window for ${dateString} in ${timeZone}`);
  };

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    start: findUtcMidnight(year, month, day),
    end: findUtcMidnight(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
    ),
  };
}

export function isWithinDay(createdAt, dateString, timeZone) {
  const created = new Date(createdAt);
  const { start, end } = getDayBounds(dateString, timeZone);
  return created >= start && created < end;
}

export function offsetDateString(dateString, dayOffset, timeZone) {
  const { start } = getDayBounds(dateString, timeZone);
  const shifted = new Date(start.getTime() + dayOffset * 86_400_000);
  return formatDateInTimezone(shifted, timeZone);
}

export function isWithinAnyDay(createdAt, dateStrings, timeZone) {
  return dateStrings.some((dateString) => isWithinDay(createdAt, dateString, timeZone));
}