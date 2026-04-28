export type TestUsageType = 'medical' | 'recreational'

export function normalizeUsageType(usage: string): TestUsageType {
	const normalized = usage.trim().toLowerCase()
	if (normalized === 'medical') return 'medical'
	if (normalized === 'recreational') return 'recreational'
	throw new Error(`Unknown usage type "${usage}". Expected 'medical' or 'recreational'.`)
}

export function isMedicalUsage(usage: TestUsageType | string): boolean {
	return normalizeUsageType(usage) === 'medical'
}

export function getUsageLabel(usage: TestUsageType | string): 'Medical' | 'Recreational' {
	return isMedicalUsage(usage) ? 'Medical' : 'Recreational'
}

export function getRatesBucketForUsage(
	usage: TestUsageType | string,
): 'medical-rate' | 'standard' {
	return isMedicalUsage(usage) ? 'medical-rate' : 'standard'
}
