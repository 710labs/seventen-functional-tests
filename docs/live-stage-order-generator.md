# Live Stage order generator

Run **Actions → Live - Stage - Order Generator → Run workflow**. Leave `pos` as
`all` to create **eight new pickup orders: one recreational and one medical per
POS**. Select an individual POS to create that Rec/Med pair for one integration.

The workflow always targets `https://live-stage.710labs.com`. It can run manually
and is reused by **Daily System Health**, which is scheduled at **10:17 UTC daily**.
The daily job creates all eight orders after the existing Stage storefront/POS
checks. It adds one required check to the daily health result and includes the
batch and compact order rows in the single daily Slack digest. Manual runs keep
their standalone Slack summary (unless `notify_slack` is disabled).
The generator has its own Playwright config and a single desktop Chromium project.
Manual and daily batches share a concurrency group so they cannot overlap.

| POS | Store | POS instance | Facility |
| --- | --- | --- | --- |
| Dutchie | 710 Labs - MI Sandbox (`test-facility`) | 10 | 13 |
| Blaze | Spaceflyt - Culver City | 4 | 3 |
| Treez | Sticky Thumb - South SF | 15 | 10 |
| Meadow | The Artist Tree - Beverly Hills | 19 | 6 |

Each order registers a new synthetic customer, adds available inventory from
the target store until its checkout minimum is met, completes
pickup checkout with cash and the existing test document, then submits once.
First and last names are identical and use a compact format:
`710_{POS code}_{Rec|Med}_{batch ID}`, for example `710_DUT_Med_A7K2Q9`.
POS codes are `DUT` (Dutchie), `BLZ` (Blaze), `TRZ` (Treez), and `MDW` (Meadow);
`Rec` means recreational and `Med` means medical. Names are 18 characters.
The suffix is one cryptographically random six-character **batch ID shared by
every order in that run**, across all POSs and both customer types. For example:

```text
710_DUT_Rec_A7K2Q9
710_DUT_Med_A7K2Q9
710_TRZ_Rec_A7K2Q9
710_TRZ_Med_A7K2Q9
```

The launcher creates `output/live-order-generator/batch.json` before starting
Playwright and passes the ID to all workers, including replacement workers.
Every new invocation (including a GitHub rerun) starts a fresh batch. First and
last names still match. Batch IDs and names are preserved in the order evidence
and full report. Reports also recognize names from earlier, pre-batch runs.
Each account still receives a unique email address on every run.

The medical case saves the `Medical-Card.png` test fixture to the customer's
account before building the cart, with issuing state MI for Dutchie and CA for
the other sandboxes. It reloads the account and checks the saved card details,
then uses the medical cart and checkout flow and requires medical document
details at checkout. Medical-only inventory is preferred when available;
otherwise the medical customer can use the store's regular inventory. A name
containing `_Med_` alone cannot satisfy medical coverage.

Add-to-cart controls must match the store's facility, pickup method, and POS
instance. The generator fails instead of substituting a different store.

After the Playwright suite exits, the launcher polls the existing Persy QA orders
endpoint (`/wp-content/plugins/persy/interface/qa/orders/`) by each captured Woo
order ID for up to 90 seconds per order, concurrently, at five-second intervals.
This runs even if a later checkout fails. It queries this batch's IDs rather than
the latest orders. Success requires `outcome: success`, the expected instance ID
and POS type, an instance name, and a nonempty external order ID. Pending results,
API errors, and missing/mismatched identifiers cannot pass. Response redirects
are rejected and requests time out after at most 15 seconds.

These are the confirmed fields for the transmission check, matching the existing
health tests. `instanceId` identifies the specific configured POS connection and
must exactly match the target in the store mapping above; `instanceType` must
also match its provider. A different instance of the same provider fails. The
instance name must be present but is not used as the identity check. The instance
ID is distinct from the facility ID used to select the storefront cart; this API
check does not independently verify facility identity within a shared connection.
It checks the reported integration result without logging into the POS provider.
Per-order evidence records the verification source, attempt
count, last check timestamp, and confirmation flag without storing raw API bodies
or credentials. `orders.json` retains that verification evidence.

## Repository secrets

Uses existing secret names from the Live Stage workflows:

- `ALWAYS_ON_PASSWORD`: password for newly registered synthetic customers.
- `CHECKOUT_PASSWORD`: Stage checkout password.
- `LIVE_STAGE_QA_AUTH`: authentication for the Persy order verification endpoint.
- `SLACK_WEBHOOK_URL`: existing incoming webhook for the test-results Slack channel.
- `RECAPTCHA_BYPASS`: existing QA bypass cookie, when required by Stage.
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET`: existing hosted report setup.

The workflow checks required customer, checkout, and QA secrets before creating
orders. It also requires Slack when standalone notifications are enabled. Daily
health uses the final digest job's Slack configuration. No production URL secret
is used.

## Results and reruns

Slack shows the shared batch ID once above **every requested order in one compact line**: status icon, POS,
Rec/Med, linked WooCommerce ID, and external POS ID (linked when available).
Verified rows omit repeated status/phase text. Incomplete rows include their
status and phase; a rerun warning appears only for an ambiguous submission.
The lines share one message section where possible to avoid extra spacing.

The **Full report** button opens the GitHub run summary, which retains store
names, customer names, Rec/Med types, WooCommerce and POS IDs/links, statuses,
and phases. Missing orders are shown as `not-started`; an unreadable evidence
file is shown as `invalid-evidence`. A failed setup or incomplete run does not
hide the remaining order attempts. Slack delivery failure fails the workflow.

Download `live-stage-generated-orders-<run>-<attempt>` for `orders.json` and
`summary.md` plus the `batch.json` manifest. The workflow fails unless every
requested order is verified, has a distinct order ID, belongs to the same batch,
and matches its expected Rec/Med profile and name. A medical
order also requires evidence that its medical card was persisted. Earlier
failures do not stop later order attempts.

Automatic test retries are disabled. A `created` status means checkout returned
an order ID but POS verification did not complete. A `submitting` status means
checkout started and may have created an order without returning a confirmation.
Inspect Stage before rerunning either case. Every fresh workflow run creates
two **new** orders per selected POS; it does not top up a prior run. Existing
orders are left available for inspection.

## Direct POS order links

The known Persy QA response provides an external order ID, but no confirmed
direct order URL. When the response includes `posOrderUrl`, `posOrderURL`,
`externalUrl`, or `externalURL`, the generator can preserve a valid provider link
for the matching POS instance. These optional fields are supported for future
responses; their presence on Stage has not been verified. Without a URL, Slack
still shows the external ID without repeating an unavailable-link notice.

Alternatively, set a GitHub Actions **repository variable** with a confirmed
order URL template for the relevant sandbox:

- `LIVE_STAGE_DUTCHIE_ORDER_URL_TEMPLATE`
- `LIVE_STAGE_BLAZE_ORDER_URL_TEMPLATE`
- `LIVE_STAGE_TREEZ_ORDER_URL_TEMPLATE`
- `LIVE_STAGE_MEADOW_ORDER_URL_TEMPLATE`

Copy an actual sandbox order URL and replace only the external order ID with
`{externalId}`. The generator URL-encodes the ID when substituting it. The four
templates are unset by default; no dashboard route is guessed from an ID.
Links must use HTTPS on the relevant provider's domain (`dutchie.com`,
`blaze.me`, `treez.io`, or `getmeadow.com`) and cannot contain credentials or
authentication query parameters. POS links require your normal POS login.

The Slack sender uses the existing incoming webhook's configured channel, as
described in [Slack's webhook documentation](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

## Local use

With the required secrets in `.env` or the process environment:

```bash
npm run live:stage:generate-orders
node scripts/live-order-generator/summarize.cjs
```

Set `LIVE_ORDER_POS=meadow` (or `dutchie`, `blaze`, `treez`) to target one POS.
Local evidence is stored under `output/live-order-generator/`. Archive that
directory before starting another local run: the launcher refuses to overwrite
a prior batch or its evidence. Use the npm command to initialize the batch;
invoking Playwright directly does not create a batch. GitHub runners start with
a fresh checkout.

To repeat only the API checks against the existing local batch, without creating
accounts or orders:

```bash
node scripts/live-order-generator/verify-orders.cjs
node scripts/live-order-generator/summarize.cjs
```

Offline checks:

```bash
npm run test:live-order-generator
npm run validate:security
```

The workflow must be on the repository's default branch before GitHub exposes
the manual run button. See [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
