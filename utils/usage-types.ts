export type TestUsageType = 'medical' | 'recreational'

export function normalizeUsageType(usage: string): TestUsageType {
	return usage.toLowerCase() === 'medical' ? 'medical' : 'recreational'
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
