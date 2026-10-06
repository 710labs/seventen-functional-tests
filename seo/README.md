# SEO Pulse

SEO runs **inside Daily System Health** at **10:17 UTC**. The GitHub summary and single daily
Slack digest have an **SEO** section with **LIVE - PROD**, **LIVE - STAGE**, and **LIVE - DEV**
underneath. Each row shows technical, mobile Lighthouse, and Search Console status. There is no
separate SEO schedule or Slack message. `seo-pulse.yml` is the reusable implementation called
by the daily workflow; its manual dispatch is a diagnostic run that never sends Slack.

All three environments currently use `robotsExpectedState: "blocked"` to guard their intentional
crawl blocks. Their SEO checks remain isolated from the functional suites. Search Console is
scoped to Prod; it is explicitly skipped for Stage and Dev. No site settings are changed.

## Checks and digest

- Technical: robots state, sitemap, metadata, self canonical, H1, image alt, language, JSON-LD, and a rotating daily sample of five product pages. Key-page outages and an empty product grid always fail.
- Lighthouse: mobile, three runs per key page, median assertions. While blocked, on-page audit gates run without a category SEO threshold. Live mode adds SEO ≥0.9 and crawlability gates. Reports remain private workflow artifacts.
- Search Console: final data for the last seven days ending three days ago, versus the prior seven days. A clicks drop of at least 40%, with at least 20 previous clicks, fails. A missing service-account secret skips; broken credentials fail.

🟢 means clean. 🟠 means warnings or a known issue now fixed and needing config cleanup. 🔴 means a new failure, outage, Lighthouse error gate, GSC cliff/API error, or missing check output. The digest links to the run; artifacts include technical JSON, traces, HTML reports, Lighthouse output, and `report.md`. GSC JSON is retained for 90 days. Flaky technical tests are shown as passed on retry.

## Run and maintain

Use Node **22.13.0** and the repository's npm lockfile:

```sh
npm ci
npx playwright install chromium
npm run seo:unit
npm run seo:selftest
npm run seo
node seo/scripts/report.mjs --dry-run
```

The self-tests use only local fixtures and require no credentials or production traffic. PRs touching `seo/**`, either workflow, health aggregation code, or dependency manifests run them, along with the Daily System Health regression tests. Technical checks use their own Playwright config and never enter the functional suites.

Actions → **seo-pulse** → **Run workflow** accepts an optional enabled site id (`live`, `live-stage`, or `live-dev`). These focused diagnostic runs and PR self-tests never post to Slack. The final Daily System Health aggregation job owns the only daily message. GitHub requires a new dispatch workflow to be registered before it can run manually; verify the PR self-test first and dispatch the branch when available. Public-repository schedules can be disabled after 60 days without repository activity.

`seo/config/sites.json` is the source of truth. To add a site, add an enabled entry with its origin, canonical host, key-page paths, product discovery selector, robots state, and optional GSC settings. The health manifest derives enabled SEO environments from the same config, so no workflow or manifest edit is needed. Optional `healthCheckId` sets its stable Daily System Health id; it defaults to `seo-<site id>`. `shop` is a disabled example. Inspect the matrix with:

```sh
node seo/scripts/resolve-sites.mjs
node seo/scripts/resolve-sites.mjs live
```

Check ids are stable (for example `single-h1:/shop/`). Add one to `knownIssues` only after Brendan accepts the issue in the PR; this changes its failure to a warning. A passing known issue is flagged **Fixed — remove from knownIssues**. Remove confirmed fixed ids in a reviewed config change. Never use the list to hide outages or make a new failure green.

Emergency/self-test overrides: `SEO_SITE`, `SEO_BASE_URL`, `ROBOTS_EXPECTED_STATE`, `SEO_CONFIG`, `SEO_OUT_DIR`, `SEO_ROTATION_SEED`. Diagnostic report overrides: `SEO_OUT_ROOT`, `SEO_ONLY_SITE`, `HEALTH_RESULTS_DIR`. `HEALTH_ONLY_GROUP=SEO` restricts the daily aggregator to SEO artifacts for diagnostics; normal daily runs include all checks. Prefer reviewed config changes for normal operation.

## Human setup

1. Enable **Google Search Console API** in Google Cloud. Create a service account and JSON key. In Search Console → Settings → Users and permissions, add its email with **Restricted** access. Store the JSON as repository secret `GSC_SERVICE_ACCOUNT_KEY`. Do not commit it.
2. Confirm `gsc.property`: the default is `sc-domain:710labs.com`. If the verified property is URL-prefix, change the config to its actual property, for example `https://live.710labs.com/`. `pageContains` scopes domain data to the site's host.
3. Only if runners get resets/403, ask infra for a WAF allow rule for the `seventen-seo-pulse/1.0` UA suffix or an appropriate self-hosted runner. Do not bypass the WAF in monitor code.
4. Optionally require the `seo-selftest` PR check. Do not require the scheduled production jobs for merges.

## Launch day

1. The site team ships robots.txt allowing crawl with a `Sitemap:` line and a working `/sitemap.xml`.
2. Review a PR setting Live's `robotsExpectedState` to `"open"` and removing `sitemap-present` from `knownIssues` if still listed. This automatically switches to the live Lighthouse gates and makes a future full crawl block red.
3. Submit the sitemap in Search Console.
4. Watch for impressions to leave zero. While blocked, zero impressions are expected; after launch this is the indexing tripwire.
