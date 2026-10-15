# Historical report cleanup inventory

Observed 2026-10-05 through the GitHub connector. This is a starting inventory from one run, not the full exposure window. Metadata was read; archive contents were not downloaded. None of these artifacts or logs have been deleted.

Run: [Daily System Health #100](https://github.com/710labs/seventen-functional-tests/actions/runs/37297462901), commit `8aafc6ea85277f248f60b6323bbca2838a0a245b`.

The following raw Playwright report artifacts were present and unexpired:

| Artifact ID | Name | Scheduled expiry (UTC) |
| --- | --- | --- |
| 11340742704 | playwright-report-concierge-dev | 2026-10-08T10:42:59Z |
| 11340691919 | playwright-report-live-dev-storefront | 2026-10-08T10:38:25Z |
| 11340617335 | playwright-report-list-prod-ca | 2026-10-08T10:39:47Z |
| 11340368596 | playwright-report-concierge-prod | 2026-10-08T10:45:30Z |
| 11340082286 | playwright-report-list-prod-mi | 2026-10-08T10:38:43Z |
| 11340072540 | playwright-report-live-stage-storefront | 2026-10-08T10:39:40Z |
| 11339554086 | playwright-report-employee-prod | 2026-10-08T10:45:53Z |
| 11339468565 | playwright-report-list-prod-nj | 2026-10-08T10:42:07Z |
| 11339358466 | playwright-report-list-prod-co | 2026-10-08T10:41:21Z |
| 11339278104 | playwright-report-live-prod-storefront | 2026-10-08T10:38:43Z |

Delete these report artifacts and review/remove sensitive logs from this run and all attempts. Extend the inventory to older runs and the standalone Live, Concierge, Employee, List, admin, image-upload, and Acuity workflows before declaring cleanup complete. S3, Tesults, and any Pages copies need their own inventory and cleanup.

Access blocker: the connector supports reading artifacts but not deleting them. The available in-app GitHub browser is signed out, and Git's credential helper supplied no noninteractive credential. Server-side CAPTCHA configuration, S3 ownership, and Tesults administration locations have been requested from the user. Do not paste credentials into this file or chat.
