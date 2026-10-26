# Public CI reporting

This repository is public. Treat workflow output and uploaded files as public data.

All Playwright npm test commands use `scripts/run-public-playwright.js`. It runs Playwright with stdout/stderr suppressed, including discovery/configuration errors that occur before reporters load, and prints a validated JSON summary. The summary contains outcome, counts, opaque test IDs, final-attempt duration, retry count, and safe failure diagnostics. Unknown fields are discarded; malformed summaries fail the command. Normal test failures and startup failures still return a nonzero exit code.

Every checked-in Playwright configuration disables trace and screenshot capture. Video defaults to off, with an explicit private-S3 recording path described below. Public-safe, health, and summary-only Slack reporters replace HTML, Tesults, public S3 reports, and raw GitHub annotations. Health counts retain their existing convention: a successful retry counts as passed. Test titles, errors, browser state, and attachments are excluded from public summaries. Test IDs are the first 16 hex characters of SHA-256 of Playwright's test ID; they allow correlation without publishing dynamic test names.

The safe runner loads a guard before test discovery and in workers to reject recording overrides in `test.use()`, `test.extend()`, and derived or merged test fixtures. The summary reporter terminates runs with unsafe project defaults before workers launch; throwing from a reporter alone does not stop Playwright. The only permitted video mode besides `off` is `retain-on-failure` after private-storage verification. Empty and all-skipped runs fail consistently in the runner, health results, and Slack. Successful retries still count as healthy, with Slack retaining its flaky indicator, unless private recording uploads failed.

Raw report and test-result uploads have been removed, including the daily health, admin, image-upload, and Acuity paths. S3 uploader entrypoints cannot publish reports. Admin smoke phases write safe summaries to `public-results/admin-drop-N.json`; the final Slack notification aggregates those summaries. The Acuity authentication helper cannot enable browser artifacts in CI. Health/business-result artifacts elsewhere in the repository are separate from raw Playwright artifacts.

## Validation

- `npm run validate:security` checks capture defaults, recording overrides in test/support source, report destinations, workflow upload paths, and runner overrides.
- `npm run test:security` runs synthetic passing/failing/retrying browser cases, including fake cookies, headers, password inputs, page content, raw output, attachments, and errors. It never contacts the real applications or sends Slack notifications. Install Chromium with `npx playwright install chromium` if needed.
- `npm run test:health` and `npm run validate:health` verify health aggregation and workflow configuration.

The `Public reporting security` workflow runs these checks without application secrets on pull requests and main. Branch protection must require this check in GitHub settings to make it a merge gate. A source policy check is a regression guard, not a sandbox for malicious test code; reviewers must still inspect new publishers, test-generated files, and non-Playwright logging.

## Debugging

Failed and flaky tests include a fixed error category and phase (for example `google-maps-referrer-denied` / `address-entry`). When available, the deepest failed step supplies a Git-tracked source filename and line. Untracked/generated paths, raw step titles, selectors, error text, URLs, and browser console messages are never published. Missing Git metadata simply omits source locations. Health artifacts and GitHub summaries include these diagnostics; the daily Slack digest includes category/phase summaries. Successful retries retain their original failure diagnostic in the public summary while still counting as healthy.

The shared address helper supports legacy Google suggestions and the new `gmp-place-autocomplete` widget, including keyboard selection through closed shadow roots. A modern widget must emit its real `gmp-select` event before the test proceeds. Tests do not supply a Maps key, synthesize a selection, or skip address validation. Website-side referrer/API configuration failures remain failures and are reported with fixed codes. `ADDRESS_WIDGET_UNAVAILABLE` means the custom element did not initialize; `ADDRESS_AUTOCOMPLETE_FAILED` means address interaction or suggestion selection did not complete. Run the synthetic address/cart tests with `node scripts/run-public-playwright.js --config=configs/unit.config.ts`.

Do not publish raw diagnostics as public workflow artifacts, even for a manual run or failed retry. Reproduce locally with synthetic credentials using a separate temporary config and no publishing reporters, or use the verified private-S3 video path below. Local raw artifacts remain sensitive and must not be committed or uploaded publicly. Keep real-secret production runs on the safe runner.

The runner intentionally rejects `--reporter`, `--trace`, `--ui`, `--debug`, and `--list`. Use a separate local synthetic configuration for interactive investigation. The current summary sacrifices raw stack traces and error detail to prevent disclosure.

## Automatic private failure videos

The repository stays public. All application Playwright workflows can retain failed-attempt videos in a dedicated private S3 bucket. Public logs, summaries, and Slack contain only non-authorizing AWS Console links and opaque test IDs. Your own AWS Console session supplies read access; there are no public object URLs or presigned links. The CI role can upload and check bucket privacy but cannot read videos or change bucket permissions.

`infra/private-failure-videos.yaml` provisions a new bucket with all four S3 Block Public Access settings, ACLs disabled, encryption, HTTPS-only access, and a seven-day expiration rule. It also creates the GitHub OIDC upload role. No existing report bucket or credentials are reused. The stack retains the bucket if deleted; the lifecycle rule continues expiring objects. S3 storage/request charges apply. Lifecycle deletion is asynchronous, so seven days is an expiration policy rather than an exact deletion deadline.

### One-time AWS and GitHub setup

1. In your AWS account, open CloudFormation in the desired region and create a stack using `infra/private-failure-videos.yaml`. Suggested stack name: `seventen-private-failure-videos`. Keep `GitHubRepository` at `710labs/seventen-functional-tests` and `RetentionDays` at `7` unless desired otherwise. If IAM already has an OIDC provider for `token.actions.githubusercontent.com`, supply its ARN as `ExistingGitHubOidcProviderArn`; otherwise leave that field blank. Review and acknowledge IAM resource creation.
2. Restrict the repository's `dev` and `stage` GitHub environments to deployments from `main`. The image-upload job uses those environments, so its OIDC subject differs from normal branch-based jobs. The composite action also rejects non-main and pull-request invocations. The AWS role trusts only this repository's main branch and those two environments.
3. After the stack completes, add these **GitHub Actions repository secrets** from its Outputs: `PRIVATE_VIDEO_BUCKET` = `PrivateVideoBucket`, `PRIVATE_VIDEO_REGION` = `PrivateVideoRegion`, and `PRIVATE_VIDEO_ROLE_ARN` = `PrivateVideoRoleArn`.
4. Deploy the code change to `main`, then set the repository secret `PRIVATE_VIDEO_RECORDING` = `true`. No new long-lived AWS key is needed. Until that final switch is enabled, existing behavior stays unchanged.
5. Run List Dev. In the GitHub run summary, select **Open video in AWS Console**, sign in to the AWS account that owns the bucket, and use **Open** or **Download** on the object. Slack provides a link to the run's private recording folder. `manifest.json` in that folder maps opaque IDs to test names and browser projects. Your AWS identity needs `s3:ListBucket` and `s3:GetObject` for this bucket; the write-only CI role is not a viewing role.

Recording uses `retain-on-failure` on the original attempt, not only on a rerun. A failed attempt remains available when its retry passes. Videos upload as tests finish; a manifest is written at the end. Separate prefixes distinguish GitHub run, rerun attempt, job, state/check, and Playwright invocation. This prevents daily-health state changes and admin phases from overwriting each other.

Before each Playwright invocation, the runner checks all four public-access blocks, policy privacy, bucket-owner-enforced ownership, and a synthetic upload. If verification fails, the invocation fails before collecting browser data. If a video upload fails, the run is marked failed with an explicit incomplete-recording status. Failures before a browser opens have no video; abrupt runner termination can also prevent video finalization/upload. These limitations are reported where possible, not represented as successful captures.

Disable future capture by setting the repository secret `PRIVATE_VIDEO_RECORDING` = `false`. This does not delete existing private recordings. Traces, screenshots, raw HTML reports, and public browser-artifact uploads remain disabled.

Validation uses synthetic browser pages and a mocked S3 client: `node --test scripts/security/private-videos.test.js`. It checks failed and recovered attempts, privacy preflight, denied uploads, and absence of synthetic secrets or signed URLs in public outputs. Live AWS provisioning and an actual CI run are separate activation checks.

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
