import type { Reporter } from '@playwright/test/reporter'

// Raw reports can contain credentials. Use an independently reviewed private workflow for diagnostics.
export default class DisabledReportUpload implements Reporter {
	onEnd() {}
}
