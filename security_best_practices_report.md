# Public CI exposure: analysis and remediation plan

Reviewed 2026-10-05 against pre-fix commit `67c6807`; finding line numbers refer to that version. Scope: Live/Concierge/Employee Playwright capture, reporting, and related GitHub workflows.

## Implementation status

The working tree now hardens all 16 Playwright configurations, removes raw browser report uploads, disables S3 publication, removes committed Tesults target tokens from current configs, and routes Playwright commands through a safe summary runner. Health and Slack use safe identifiers and no S3 links. A credential-free regression workflow and synthetic browser tests cover pass, failure, retry, startup errors, notifications, and resolved config defaults.

Validation: 10 security tests, 9 health tests, and 10 Acuity authentication tests passed; security and health configuration checks passed. Existing workflow job graphs, matrices, dependencies, and outputs were preserved. Production tests were not run. Full TypeScript checking still reports unrelated errors in existing application tests/helpers.

Changes are local and are not yet deployed to GitHub. Repository public visibility and connector admin access were confirmed, but the connector has no deletion/secret/workflow-disable operations and the Git credential helper did not provide a noninteractive credential. Historical deletion, server-side rotation, session invalidation, and required-check configuration remain outstanding. See [the operational checklist](docs/public-ci-reporting.md).

## Executive assessment

The checked-in code confirms a path from credential-bearing browser sessions to uploaded reports. Treat credentials used in retained public reports as potentially compromised. Disabling future uploads alone does not remediate historical copies or invalidate credentials.

This is a source review, not proof of a particular downloaded artifact or unauthorized access. Repository public visibility has since been verified. A metadata-only check confirmed 10 unexpired raw Playwright report artifacts in Daily System Health #100; see [the cleanup inventory](docs/public-ci-cleanup-inventory.md). Their contents, bucket permissions, and Tesults access were not independently verified. GitHub CLI is unavailable in this workspace. No production tests, external deletions, or credential changes were performed. The security skill has no Playwright-specific reference; this assessment uses repository evidence and primary documentation.

## Findings

### 1. High: browser recording and public artifact publication

- `configs/liveandconcierge.config.ts:37` injects storage state; lines 41–43 enable traces, videos, and screenshots for every test.
- `support/qa/recaptcha-bypass.ts:24` builds a cookie whose value comes from `RECAPTCHA_BYPASS`; lines 79–83 include it in storage state.
- `.github/workflows/live-prod.yml:36` supplies that secret; lines 56–62 upload `playwright-report` even after failures, with three-day retention.
- `tests/always-on-tests/prod-live.spec.ts:14` reads `NEW_ALWAYS_ON_PASSWORD`; line 40 passes it into registration. `models/always-on/login-homepage.ts:198` fills the password field.

Impact: anyone able to download a report can inspect sensitive browser data it contains, potentially including reusable credentials and sessions.

Qualification: the shared config's base URL is hardcoded to `live-dev.710labs.com` (line 6), and the cookie helper scopes cookies to that hostname. Production tests navigate to `PROD_LIVE_URL`. This review does not establish that the bypass cookie is transmitted to production or appears in every trace. Production password entry still makes those traces sensitive. Trace contents depend on the installed Playwright version and executed actions; “every value” is unnecessarily absolute.

### 2. High: removing the GitHub upload leaves other report destinations

`configs/liveandconcierge.config.ts:18–30` enables HTML, Tesults, Slack, health, S3, and GitHub Actions reporters. `reporters/s3/pw-report-s3-upload.ts:19–30` uploads the entire report directory recursively; lines 60–69 upload each file. Bucket access policy is unknown, so public S3 exposure is not confirmed. Tesults output and permissions also need review.

The config serves Live dev/stage/prod, Concierge dev/stage/prod, and Employee production. Daily health invokes these scripts (`scripts/health/checks.json:175–202`) and uploads HTML reports (`.github/workflows/daily-system-health.yml:535–542`). Other Playwright configs also enable recording and report uploads; the pattern is broader than one workflow.

### 3. High: a reporter credential is committed in source

`configs/liveandconcierge.config.ts:24` contains a literal Tesults target token. Its validity and permissions are unverified. Do not reproduce it in tickets or logs. Remove it from source, revoke/rotate it if active, and supply a replacement through secrets only if that integration remains necessary. Deleting the current literal does not erase Git history.

### 4. Medium: logs and report metadata remain a separate channel

`models/always-on/login-homepage.ts:186` logs generated account email addresses; lines 224 and 246 log generated birth dates. These are test-generated values, not evidence of real customer data. Built-in error output and annotations can still contain page text, inputs, URLs, or response content after recordings are disabled.

The health reporter already limits output largely to status, counts, and test titles (`reporters/health/pw-health-json-reporter.ts:52–65`). However, titles must remain static and non-sensitive. Its S3 link (lines 43–46), and Slack's S3 link (`reporters/slack/pw-slack-webhook-reporter.ts:69–71`), should reflect whether a report was actually published.

## Ordered remediation plan

### Phase 1: contain publication and recording

1. Pause affected scheduled/manual runs operationally while the patch is prepared, including daily health paths. Prevent reruns of older unsafe revisions with live credentials.
2. Set trace, video, and screenshot to `off` by default in the shared config. Do not replace them with failure-only or retry-only capture: failed authentication and checkout tests are especially sensitive.
3. Remove raw HTML/report-directory uploads from Live and Concierge workflows and their daily health jobs. Employee also inherits the S3 reporter even without a standalone artifact step.
4. Disable HTML, S3, and Tesults reporting for affected public CI runs until an access-controlled diagnostic destination is verified. Audit the GitHub annotations reporter and console reporter for raw error output. Preserve only an allowlisted summary: static test identifier, outcome, retry count, duration, and run URL.
5. Remove sensitive console output at its source. Suppress raw test stdout/stderr and error details in the public CI reporter; review setup/runner errors separately. GitHub secret masking is an extra protection, not artifact sanitization or a guarantee for generated session tokens.
6. Keep health status/counts and summary-only Slack notifications working. Remove dead S3 report links from both. Do not remove the bypass mechanism as a substitute for fixing publication, or broaden its cookie domain; investigate host configuration separately.
7. Remove unused job secrets, especially S3/Tesults credentials once uploads are disabled. Apply the same policy to remaining configs/workflows that use real credentials, prioritizing production.

### Phase 2: invalidate and remove historical exposure

1. Inventory affected run IDs, attempts, artifact IDs, S3 prefixes, Tesults results, and any Pages deployments. Determine the exposure window from Git history and retained run metadata. Preserve only necessary evidence in restricted storage.
2. Rotate the server-side CAPTCHA bypass secret and update its GitHub secret in coordination, so the old value stops being accepted. Reset passwords actually used in affected tests, including the shared new-account password, and invalidate related sessions. Changing the shared password variable alone does not reset accounts previously created with it.
3. Revoke the committed Tesults token if active. Assess additional credentials based on actual browser use, captured requests, logs, or committed values; merely being present in job environment variables does not prove exposure.
4. Delete affected GitHub artifacts and exposed logs across run attempts. Delete/restrict corresponding S3 objects, versions and cached copies where applicable, and remove exposed Tesults/Pages copies. Verify access after cleanup. Short retention is not access control and deletion cannot recall prior downloads.
5. Resume only patched workflows with replacement credentials. Repository changes cannot complete server-side rotation or remote cleanup by themselves.

### Phase 3: restore private diagnostics and prevent regressions

1. If detailed traces are required, run credential-bearing diagnostics in a private repository or runner with verified restricted logs and storage. A public repository's manual trigger or protected environment does not make its logs/artifacts private. Use explicit opt-in capture, limited access, short retention, and dedicated test accounts.
2. Add a policy check covering resolved project configs, reporter selection, CLI overrides, explicit screenshots/attachments, manual tracing, HAR/video capture, and workflow upload paths. Unknown publication destinations should fail review.
3. Add local synthetic passing, failing, and retrying tests with fake canary values in cookies, headers, password input, response content, stdout/stderr, and assertion errors. Inspect all public-intended output, including compressed/embedded data if retained. Require no sensitive captures and no canary values. Do not run these checks against production.
4. Validate health aggregation, failure exit status, counts, notification formatting, and absent-report links with integrations mocked. Then perform a controlled non-production run and inspect its logs and exact uploaded outputs before resuming production.

## Delivery and acceptance

- First patch: shared safe defaults, public-safe summary reporting, affected upload removal, and focused synthetic regression checks.
- Operational remediation: documented artifact/log cleanup and credential/session invalidation, performed by owners with the relevant access.
- Follow-up patch: remaining credential-bearing workflows and a restricted diagnostic workflow if needed.

Complete when passing, failing, and retrying public runs expose only approved summaries; retained unsafe copies have been removed or restricted; exposed credentials/sessions have been invalidated; health monitoring still reports failures accurately; and a policy check prevents reintroduction. Expect reduced public debugging detail as an intentional tradeoff.

## Primary sources

- [GitHub: downloading workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts): signed-in users with repository read access can download artifacts.
- [GitHub: workflow logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs): viewing, downloading, and deleting logs.
- [GitHub: secure use](https://docs.github.com/en/actions/reference/security/secure-use): secret handling and log-redaction limitations.
- [Playwright: trace viewer](https://playwright.dev/docs/trace-viewer): traces expose network headers/bodies, DOM snapshots, actions, and console output; retry/failure modes still record traces.
