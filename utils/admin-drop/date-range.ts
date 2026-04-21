function getDatePartsInTimeZone(date: Date, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
	const parts = formatter.formatToParts(date)

	return {
		year: Number(parts.find(part => part.type === 'year')?.value),
		month: Number(parts.find(part => part.type === 'month')?.value),
		day: Number(parts.find(part => part.type === 'day')?.value),
	}
}

function formatIsoDate(date: Date) {
	return date.toISOString().slice(0, 10)
}

export function getLastSevenDayRangeInTimeZone(timeZone: string) {
	const { year, month, day } = getDatePartsInTimeZone(new Date(), timeZone)
	const endDate = new Date(Date.UTC(year, month - 1, day))
	const startDate = new Date(endDate)

	startDate.setUTCDate(startDate.getUTCDate() - 6)

	return {
		fromDate: formatIsoDate(startDate),
		toDate: formatIsoDate(endDate),
	}
}
