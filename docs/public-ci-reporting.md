# Public CI reporting

This repository is public. Treat workflow output and uploaded files as public data.

All Playwright npm test commands use `scripts/run-public-playwright.js`. It runs Playwright with stdout/stderr suppressed, including discovery/configuration errors that occur before reporters load, and prints a validated JSON summary. The summary contains outcome, counts, opaque test IDs, final-attempt duration, retry count, and safe failure diagnostics. Unknown fields are discarded; malformed summaries fail the command. Normal test failures and startup failures still return a nonzero exit code.

Every checked-in Playwright configuration disables trace and screenshot capture. Video defaults to off, with an explicitly enabled hosted report path described below. Public-safe, health, and summary-only Slack outputs replace public HTML, Tesults, public S3 reports, and raw GitHub annotations. The user-approved hosted HTML report is the exception described below. Health counts retain their existing convention: a successful retry counts as passed. Test titles, errors, browser state, and attachments are excluded from public summaries. Test IDs are the first 16 hex characters of SHA-256 of Playwright's test ID; they allow correlation without publishing dynamic test names.

The safe runner loads a guard before test discovery and in workers to reject recording overrides in `test.use()`, `test.extend()`, and derived or merged test fixtures. The summary reporter terminates runs with unsafe project defaults before workers launch; throwing from a reporter alone does not stop Playwright. The only permitted video mode besides `off` is `retain-on-failure` after hosted-storage verification. Empty and all-skipped runs fail consistently in the runner, health results, and Slack. Successful retries still count as healthy, with Slack retaining its flaky indicator, unless hosted report uploads failed.

Raw GitHub artifact uploads remain removed, including the daily health, admin, image-upload, and Acuity paths. The safe runner coordinates hosted HTML publication; legacy standalone uploader entrypoints remain disabled to prevent duplicate uploads. Admin smoke phases write safe summaries to `public-results/admin-drop-N.json`; the final Slack notification aggregates those summaries. The Acuity authentication helper cannot enable browser artifacts in CI. Health/business-result artifacts elsewhere in the repository are separate from raw Playwright artifacts.

## Validation

- `npm run validate:security` checks capture defaults, recording overrides in test/support source, report destinations, workflow upload paths, and runner overrides.
- `npm run test:security` runs synthetic passing/failing/retrying browser cases, including fake cookies, headers, password inputs, page content, raw output, attachments, and errors. It never contacts the real applications or sends Slack notifications. Install Chromium with `npx playwright install chromium` if needed.
- `npm run test:health` and `npm run validate:health` verify health aggregation and workflow configuration.

The `Public reporting security` workflow runs these checks without application secrets on pull requests and main. Branch protection must require this check in GitHub settings to make it a merge gate. A source policy check is a regression guard, not a sandbox for malicious test code; reviewers must still inspect new publishers, test-generated files, and non-Playwright logging.

## Debugging

Failed and flaky tests include a fixed error category and phase (for example `google-maps-referrer-denied` / `address-entry`). When available, the deepest failed step supplies a Git-tracked source filename and line. Untracked/generated paths, raw step titles, selectors, error text, URLs, and browser console messages are never published. Missing Git metadata simply omits source locations. Health artifacts and GitHub summaries include these diagnostics; the daily Slack digest includes category/phase summaries. Successful retries retain their original failure diagnostic in the public summary while still counting as healthy.

The shared address helper supports legacy Google suggestions and the new `gmp-place-autocomplete` widget, including keyboard selection through closed shadow roots. A modern widget must emit its real `gmp-select` event before the test proceeds. Tests do not supply a Maps key, synthesize a selection, or skip address validation. Website-side referrer/API configuration failures remain failures and are reported with fixed codes. `ADDRESS_WIDGET_UNAVAILABLE` means the custom element did not initialize; `ADDRESS_AUTOCOMPLETE_FAILED` means address interaction or suggestion selection did not complete. Run the synthetic address/cart tests with `node scripts/run-public-playwright.js --config=configs/unit.config.ts`.

Do not upload raw diagnostics as GitHub workflow artifacts. Reproduce locally with synthetic credentials using a separate temporary config and no publishing reporters, or use the user-approved hosted report path below. Local raw artifacts remain sensitive and must not be committed or uploaded publicly. Keep real-secret production runs on the safe runner.

The runner intentionally rejects `--reporter`, `--trace`, `--ui`, `--debug`, and `--list`. Use a separate local synthetic configuration for interactive investigation. The current summary sacrifices raw stack traces and error detail to prevent disclosure.

## Hosted Playwright reports

The original one-click report experience is restored: the standard Playwright HTML report and its relative attachments upload to S3, and Slack shows a **Test Report** button. GitHub job summaries and daily health notifications also link to the report. This is the user-approved anonymous hosted-report path; it does not require AWS Console sign-in or downloading ZIPs.

### Setup and testing

1. Keep the original GitHub Actions repository secrets: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, and `S3_SECRET`. These must target the original hosted-report bucket, not the new private-video bucket. The upload identity needs `s3:PutObject`; the report objects need anonymous read access for direct browser viewing. The workflow does not change bucket policies or ACLs.
2. Keep the existing `SLACK_WEBHOOK_URL` for the Slack message. No Slack file-upload scopes or new channel ID are required.
3. Merge the changes, then start a fresh **List - Dev - All States** run on `main`, initially with only CA selected.
4. Confirm **Configure hosted Playwright reports** succeeds. After the tests, select **Test Report** in Slack or the GitHub job summary. Browse individual tests, errors, steps, retries, and attached failure videos directly in the browser.

Report generation is enabled by the composite action; no new repository feature-flag secret is needed. Outside these workflows, capture remains off unless `PLAYWRIGHT_HOSTED_REPORT=true` and all four S3 settings are provided to the safe runner.

### Behavior

Each Playwright invocation produces a report, including passing and failing runs. Videos use `retain-on-failure`, so failed attempts remain attached when a retry passes. Traces and automatic screenshots remain off. Report URLs distinguish the environment/check, run, run attempt, job, and invocation to prevent admin phases and reruns from overwriting one another.

Before tests start, the runner writes a synthetic storage-check object and verifies anonymous HTTP access. The uploader preserves the report directory structure, sets HTML/video content types, uploads `index.html` last, and verifies each uploaded object's readability. Slack receives the report link only after all files are uploaded and readable. Failed uploads/read checks fail the run and health result with a fixed diagnostic code, rather than presenting a broken report button.

The reports themselves are publicly readable and include test details and visible browser content, as explicitly requested. Console logs and the existing health JSON remain sanitized; the restored HTML path is the intentional exception to the earlier no-public-browser-artifacts policy. No Tesults credential, raw console reporter, GitHub browser-artifact upload, or unrelated test change is restored.

The HTML adapter uses the installed Playwright reporter and is covered by a real-browser integration test. Its tests check passing/failing/retrying cases, relative video references, content types, publish ordering, inaccessible assets, upload failures, and omission of test details from public console summaries.

### Retiring the alternate setups

The workflows no longer use `PRIVATE_VIDEO_*`, `SLACK_REPORTS_ENABLED`, `SLACK_REPORT_CHANNEL_ID`, or the private-report OIDC role. The corresponding secrets are not needed for hosted reports. The `infra/private-failure-videos.yaml` template remains only as a record of the earlier private deployment. Existing AWS resources have not been deleted; manage their retirement separately. S3 storage and retention continue to follow the configured bucket policies.

Validation: `npm run test:security`, `npm run test:health`, `npm run validate:security`, and `npm run validate:health`. Synthetic upload tests mock S3 and HTTP; they never upload to real storage or send Slack messages. A fresh CI run verifies the live bucket and original credentials.

## Incident completion outside the code patch

The patch does not revoke existing credentials or erase previously published files. Do not call the incident resolved until owners have completed:

1. Merge/deploy the patch and prevent reruns of older unsafe revisions while rotating credentials.
2. Inventory and remove exposed GitHub report artifacts and logs across attempts. Review S3 objects/versions/cache, Tesults results, and any Pages copies separately. Retention expiration does not recall downloads.
3. Rotate the CAPTCHA bypass at its server-side source and update `RECAPTCHA_BYPASS` in GitHub. Confirm the old cookie is rejected. Changing only the GitHub value does not revoke the server credential.
4. Reset affected test-account passwords and invalidate sessions, including accounts previously created with `NEW_ALWAYS_ON_PASSWORD`. Changing that variable alone does not reset existing accounts.
5. Revoke every active Tesults target token previously committed in the repository. Tokens were removed from current configs but remain in Git history and potentially in clones. Do not reintroduce them.
6. Review actual browser use/log contents to decide whether additional credentials require rotation. Presence in a job environment alone is not proof of disclosure.
7. Verify historical URLs no longer provide public access, then resume patched workflows. Record run/artifact IDs and completion dates without recording secret values.

The GitHub connector confirms repository admin access but does not expose artifact/log deletion, secret changes, or workflow disable operations. Server, S3, and Tesults control locations must be supplied by their owners. Do not place replacement secret values in this document or chat.
