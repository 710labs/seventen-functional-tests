// Adapt SEO findings to the existing Daily System Health result contract.
import { buildReport } from '../scripts/report.mjs'

const statusFor = (present, failures = [], warnings = []) =>
	!present ? 'missing' : failures.length ? 'failed' : warnings.length ? 'warning' : 'passed'

export function toHealthResult(site, runUrl = '') {
	const technical = site.technical
	const lighthouse = site.lighthouse
	const gsc = site.gsc
	const technicalFailures = technical
		? [...technical.failures, ...technical.otherErrors]
		: ['Technical: no result artifact']
	const technicalWarnings = technical ? [...technical.warnings, ...technical.fixedKnownIssues] : []
	const lighthouseFailures = lighthouse?.errors ?? ['Lighthouse: no complete result artifact']
	const rankingsFailures = !gsc
		? ['Search Console: no result artifact']
		: gsc.status === 'error'
			? [`Search Console: ${gsc.error}`]
			: gsc.status === 'cliff'
				? [`Search Console clicks fell ${gsc.clicksDeltaPct}% week over week`]
				: !['ok', 'skipped'].includes(gsc.status)
					? ['Search Console: invalid result status']
					: []
	const failures = [...technicalFailures, ...lighthouseFailures, ...rankingsFailures]
	const warnings = [...technicalWarnings, ...(lighthouse?.warnings ?? [])]
	const status = failures.length ? 'failed' : warnings.length ? 'warning' : 'passed'
	const report = buildReport({
		sites: [site],
		runUrl,
		jobs: { technical: 'success', lighthouse: 'success', rankings: 'success' },
	})
	return {
		schemaVersion: 1,
		id: site.healthCheckId || `seo-${site.id}`,
		label: site.name,
		group: 'SEO',
		status,
		counts: technical
			? { passed: technical.passed, failed: technical.failed, flaky: technical.flaky, skipped: 0 }
			: null,
		failureSummary: failures,
		warningSummary: warnings,
		runUrl: runUrl || null,
		reportUrl: runUrl || null,
		seo: {
			technical: statusFor(technical, technicalFailures, technicalWarnings),
			lighthouse: statusFor(lighthouse, lighthouseFailures, lighthouse?.warnings),
			rankings: gsc?.status === 'skipped' ? 'skipped' : statusFor(gsc, rankingsFailures),
		},
		seoMarkdown: report.markdown.slice(report.markdown.indexOf('### ')),
	}
}
