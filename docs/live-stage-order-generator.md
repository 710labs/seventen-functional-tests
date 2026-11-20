# Live Stage order generator

Run **Actions → Live - Stage - Order Generator → Run workflow**. Leave `pos` as
`all` to create **eight new pickup orders: one recreational and one medical per
POS**. Select an individual POS to create that Rec/Med pair for one integration.

The workflow is manual only and always targets `https://live-stage.710labs.com`.
It has its own Playwright config and a single desktop Chromium project. It sends
one Slack summary at the end of the workflow, including failed or incomplete runs.

| POS | Store | POS instance | Facility |
| --- | --- | --- | --- |
| Dutchie | 710 Labs - MI Sandbox (`test-facility`) | 10 | 13 |
| Blaze | Spaceflyt - Culver City | 4 | 3 |
| Treez | Sticky Thumb - South SF | 15 | 10 |
| Meadow | The Artist Tree - Beverly Hills | 19 | 6 |

Each order registers a new synthetic customer, adds available inventory from
the target store until its checkout minimum is met, completes
pickup checkout with cash and the existing test document, then submits once.
First and last names are identical: `Test_710Labs_{POS Name}_Rec` or
`Test_710Labs_{POS Name}_Med`, for example `Test_710Labs_Dutchie_Rec` and
`Test_710Labs_Dutchie_Med`.
Each account still receives a unique email address on every run.

The medical case saves the `Medical-Card.png` test fixture to the customer's
account before building the cart, with issuing state MI for Dutchie and CA for
the other sandboxes. It reloads the account and checks the saved card details,
then uses the medical cart and checkout flow and requires medical document
details at checkout. Medical-only inventory is preferred when available;
otherwise the medical customer can use the store's regular inventory. A name
ending in `_Med` alone cannot satisfy medical coverage.

Add-to-cart controls must match the store's facility, pickup method, and POS
instance. The generator fails instead of substituting a different store.

After checkout it polls the existing Persy QA orders endpoint for up to 90
seconds. Success requires `outcome: success`, the expected instance ID and POS
type, an instance name, and a nonempty external order ID. This checks the
reported integration result; it does not log in to the POS provider directly.

## Repository secrets

Uses existing secret names from the Live Stage workflows:

- `ALWAYS_ON_PASSWORD`: password for newly registered synthetic customers.
- `CHECKOUT_PASSWORD`: Stage checkout password.
- `LIVE_STAGE_QA_AUTH`: authentication for the Persy order verification endpoint.
- `SLACK_WEBHOOK_URL`: existing incoming webhook for the test-results Slack channel.
- `RECAPTCHA_BYPASS`: existing QA bypass cookie, when required by Stage.
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET`: existing hosted report setup.

The workflow checks required customer, checkout, QA, and Slack secrets before creating
orders. No production URL secret is used.

## Results and reruns

Slack lists **every requested order in one compact line**: status icon, POS,
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
`summary.md`. The workflow fails unless every requested order is verified and
has a distinct order ID and matches its expected Rec/Med profile. A medical
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
directory before starting another local run: the generator refuses to overwrite
records from a previous invocation. GitHub runners start with a fresh checkout.

Offline checks:

```bash
npm run test:live-order-generator
npm run validate:security
```

The workflow must be on the repository's default branch before GitHub exposes
the manual run button. See [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
