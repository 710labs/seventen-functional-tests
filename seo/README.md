# SEO Pulse

Daily monitoring for `live.710labs.com`, separate from the functional suites. The workflow starts at **10:22 UTC**, five minutes after Daily System Health starts, and posts one digest through the same `SLACK_WEBHOOK_URL`. It does not wait for the functional workflow to finish. GitHub Actions, Playwright, Lighthouse CI, and Search Console are free tools; Actions usage counts toward the repository's runner allowance.

The site ships in **pre-launch mode**: `robotsExpectedState: "blocked"` guards its intentional full crawl block. No site settings are changed by this monitor.

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

The self-tests use only local fixtures and require no credentials or production traffic. PRs touching `seo/**`, the workflow, or dependency manifests run them. Technical checks use their own Playwright config and never enter the functional suites.

Actions → **seo-pulse** → **Run workflow** accepts an optional enabled site id. **Post to Slack defaults off**. Scheduled runs always post; PRs never post. GitHub requires a new dispatch workflow to be registered before it can run manually; verify the PR self-test first and dispatch the branch when available. Public-repository schedules can be disabled after 60 days without repository activity.

`seo/config/sites.json` is the source of truth. To add a site, add an enabled entry with its origin, canonical host, key-page paths, product discovery selector, robots state, and optional GSC settings. No workflow edit is needed. `shop` is a disabled example. Inspect the matrix with:

```sh
node seo/scripts/resolve-sites.mjs
node seo/scripts/resolve-sites.mjs live
```

Check ids are stable (for example `single-h1:/shop/`). Add one to `knownIssues` only after Brendan accepts the issue in the PR; this changes its failure to a warning. A passing known issue is flagged **Fixed — remove from knownIssues**. Remove confirmed fixed ids in a reviewed config change. Never use the list to hide outages or make a new failure green.

Emergency/self-test overrides: `SEO_SITE`, `SEO_BASE_URL`, `ROBOTS_EXPECTED_STATE`, `SEO_CONFIG`, `SEO_OUT_DIR`, `SEO_ROTATION_SEED`. Digest overrides: `SEO_OUT_ROOT`, `SEO_ONLY_SITE`. Prefer reviewed config changes for normal operation.

## Human setup

1. Enable **Google Search Console API** in Google Cloud. Create a service account and JSON key. In Search Console → Settings → Users and permissions, add its email with **Restricted** access. Store the JSON as repository secret `GSC_SERVICE_ACCOUNT_KEY`. Do not commit it.
2. Confirm `gsc.property`: the default is `sc-domain:710labs.com`. If the verified property is URL-prefix, change the config to its actual property, for example `https://live.710labs.com/`. `pageContains` scopes domain data to the site's host.
3. Only if runners get resets/403, ask infra for a WAF allow rule for the `seventen-seo-pulse/1.0` UA suffix or an appropriate self-hosted runner. Do not bypass the WAF in monitor code.
4. Optionally require the `seo-selftest` PR check. Do not require the scheduled production jobs for merges.

## Launch day

1. The site team ships robots.txt allowing crawl with a `Sitemap:` line and a working `/sitemap.xml`.
2. Review a PR setting Live's `robotsExpectedState` to `"open"` and removing `sitemap-present` from `knownIssues`. This automatically switches to the live Lighthouse gates and makes a future full crawl block red.
3. Submit the sitemap in Search Console.
4. Watch for impressions to leave zero. While blocked, zero impressions are expected; after launch this is the indexing tripwire.
