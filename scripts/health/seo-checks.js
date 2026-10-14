// Derive SEO health checks from the same config that builds the runner matrix.
function getSeoChecks(sites) {
	return sites
		.filter(site => site.enabled)
		.map(site => ({
			id: site.healthCheckId || `seo-${site.id}`,
			label: site.name || site.id,
			group: 'SEO',
			type: 'seo',
			seoSiteId: site.id,
		}))
}
module.exports = { getSeoChecks }
