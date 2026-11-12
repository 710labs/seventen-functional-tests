# Load Tests

## Load Test Live (dev only)

The manual **Load Test Live** action (`.github/workflows/load-test-live.yml`) runs
Playwright browser journeys on AWS Fargate against **https://live-dev.710labs.com**.
The workflow, config planner, and browser processor reject other targets. It uses
the existing `dev` GitHub environment. There is no stage or production option.

### Journeys

- `rec-order`: delivery address, product selection, unique registration, cart minimum,
  checkout appointment, personal information, photo ID, cash payment, checkout
  password, and optionally order submission and confirmation.
- `med-order`: the same journey with a required medical product and medical-card
  handling. Missing medical inventory fails the run instead of silently testing a
  recreational order.
- `rec-account`: unique registration, personal information/email update, photo ID,
  password change, logout, and login with the updated credentials.
- `med-account`: the account journey including a medical-card update.
- `mixed`: all four journeys. Smoke runs execute each once in separate sequential
  jobs; ramp runs assign equal weights to the four journeys.

These are successful customer paths. Intentional invalid birthdays/passwords and
repeated edit checks remain in the functional suite. Cart minimum, storefront,
inventory, and product-portion handling reuse the functional cart implementation.

### Inputs and load model

- `profile`: `dry` builds and validates without launching workers; `smoke` launches
  exactly one user per selected journey; `ramp` ramps arrivals for 120 seconds and
  then sustains load for `duration_seconds` (60–1800 seconds, default 300).
- `browsers`: concurrent-user cap for ramp: 1, 5, 10, 20, 50, or 100 (default 5).
  Smoke ignores this input and uses one user. Each worker has at most 10 concurrent
  users, allocated 4 vCPU / 8 GB, following the drop simulation's starting sizing.
- Each ramp worker increases from 0.1 to 1 new user/second, then holds 1/second.
  For example, 50 browsers use 5 workers and ramp from 0.5 to 5 users/second total.
  These configs already contain per-worker load: do not split their phases again.
  Arrivals at the concurrency cap may be skipped; reports show skipped users.
- `place_orders`: defaults to **false**. Order flows still create accounts, upload
  documents, and complete checkout through an enabled Place Order button. True
  submits dev orders and requires a confirmation/order ID. Submission is never
  retried after an ambiguous timeout.
- `fargate_capacity`: `on_demand` (default) or `spot`.

Each journey has a ten-minute deadline. Total execution includes worker startup,
the arrival phases, and time for the last users to finish. Browser cap is not a
total-account/order budget. Prepare inventory and appointment capacity for the
chosen workload. Start with dry, then individual smoke runs, mixed smoke, and
5–10-browser ramps before increasing load.

### Secrets and reports

Fargate requires `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_REGION`, and
`ARTILLERY_REPORT_APIKEY`. Every journey requires `ALWAYS_ON_PASSWORD` and
`RECAPTCHA_BYPASS`. Order journeys also require `CHECKOUT_PASSWORD`, even with
submission disabled. Account journeys require `NEW_ALWAYS_ON_PASSWORD`, which
must differ from `ALWAYS_ON_PASSWORD`. Mixed runs require all of these.

The processor injects the CAPTCHA bypass cookie only on live-dev and does not
inject the List VIP cookie. Temporary worker dotenv files are removed after the
job and are never uploaded as artifacts.

Artillery Cloud receives the run; GitHub retains JSON reports for 14 days and
summarizes step p95 timings, completed/failed/skipped users, and confirmed orders.
Smoke requires one completed user with no failures or skips. Ramp permits at most
1% failed users and requires at least one completed journey of each selected type.
Missing reports, empty runs, incomplete user accounting, and missing confirmation
evidence fail the action. Latencies are reported without an invented pass/fail
budget; use baseline runs to establish a suitable latency budget.

Confirmed order IDs are logged as structured `LIVE_ORDER` records with the GitHub
run ID and virtual-user ID. Artillery Fargate persists worker logs to the run's S3
worker-log files. They are separate from the GitHub JSON artifact. POS verification
remains in the existing Live functional workflows; it is not part of the load
measurement. Browser traces and screenshots are disabled.

### Local validation

Use Node 22.13.0 or newer:

```bash
npm ci --prefix loadtest --no-audit
npm --prefix loadtest run test:live
LIVE_PROFILE=dry LIVE_SCENARIO=mixed node loadtest/scripts/prepare-live.js
node loadtest/scripts/validate-configs.js loadtest/live loadtest/generated/live-*.yml
```

The build bundles the shared TypeScript cart/address helpers into an ignored
`loadtest/generated/live-funnel.cjs`; do not commit generated files. The Live
template lives in `loadtest/live/` so existing drop config validation works without
first building Live. `loadtest/tsconfig.live.json` resolves shared helper types
against the loadtest Playwright version.

For a one-user local recreational checkout smoke, provide the required secrets in
a local ignored dotenv file, then:

```bash
LIVE_PROFILE=smoke LIVE_SCENARIO=rec-order PLACE_ORDERS=false \
  node loadtest/scripts/prepare-live.js
mkdir -p loadtest/reports
npm --prefix loadtest exec -- artillery run loadtest/generated/live-rec-order.yml \
  --dotenv loadtest/.env --output loadtest/reports/live-local.json
LIVE_PROFILE=smoke LIVE_SCENARIO=rec-order PLACE_ORDERS=false \
  node loadtest/scripts/check-live-report.js loadtest/reports/live-local.json
```

Order submission is embedded in the generated config: regenerate it when changing
`PLACE_ORDERS`. Setting the runtime environment alone does not override that choice.

## Load Test - Drop Simulation

This directory contains the self-contained Artillery suite for the manual **Load Test- Drop Simulation** GitHub Action. It is built for The List dev, stage, CA prod, CO prod, MI prod, and NJ prod environments and uses AWS Fargate for generated load.

## What Runs

- `config/http-entry.yml`: HTTP stampede against `/` with no VIP cookie. It expects a `302` redirect to `queue-it.net`.
- `config/http-funnel.yml`: HTTP-only funnel pressure with `vipChecker` and optional reCAPTCHA bypass.
- `config/browser-bypass.yml`: Playwright browser funnel with `vipChecker`, defaulting to 100 browsers in the workflow.
- `config/browser-realqueue.yml`: Playwright browser funnel without `vipChecker`, defaulting to 50 browsers and waiting up to 60 minutes for Queue-It release in the workflow.

Browser scenarios use `flows/funnel.js`. HTTP scenarios use `flows/http.js`.
Browser funnels add cart items using the first eligible add-to-cart buttons in storefront order. The workflow `cart_item_count` input controls how many items each virtual user adds (default `1`, range 1–10).

## Local Setup

Use Node `22.13.0` or newer for parity with the workflow:

```bash
npm ci --prefix loadtest --no-audit
node loadtest/scripts/validate-configs.js loadtest/config
```

Render a 1-VU browser config locally:

```bash
node loadtest/scripts/render-config.js \
  --config loadtest/config/browser-bypass.yml \
  --output loadtest/generated/browser-bypass.local.yml \
  --workers 1 \
  --worker-number 1 \
  --target https://thelist-stage.710labs.com \
  --duration 1 \
  --arrival-rate 1 \
  --max-vusers 1
```

Run a local browser bypass smoke with order placement:

```bash
ARTILLERY_TARGET=https://thelist-stage.710labs.com \
ARTILLERY_LIST_PASSWORD='<list password>' \
RECAPTCHA_BYPASS='<qa captcha bypass secret>' \
PLACE_ORDERS=true \
SCREENSHOTS=false \
npm --prefix loadtest exec -- artillery run loadtest/generated/browser-bypass.local.yml \
  --output loadtest/reports/browser-bypass-local.json
```

## Workflow Inputs

Run **Load Test- Drop Simulation** manually from GitHub Actions.

- `env`: `stage`, `dev`, `prod-ca`, `prod-co`, `prod-mi`, or `prod-nj`.
- `target`: must match the selected environment URL.
- `mode`: `flip`, `entry-only`, `bypass-only`, `realqueue-only`, `http-funnel`, or `dry`.
- `bypass_browsers`: total bypass browser concurrency; default `100`. Presets: `1`, `5`, `10`, `20`, `30`, `40`, `50`, `60`, `70`, `80`, `90`, `100`, `150`, `200`.
- `realqueue_browsers`: total real-queue browser concurrency; default `50`. Presets: `1`, `5`, `10`, `20`, `30`, `40`, `50`, `60`, `70`, `80`, `90`, `100`, `150`, `200`.
- `gate_iso`: Queue-It event start time. Empty means "now".
- `queue_wait_minutes`: max time realqueue browsers wait for Queue-It release; default `60`. Presets: `20`, `30`, `45`, `60`, `90`, `120`.
- `place_orders`: default `true`; when true, browser funnels click `#place_order`.
- `screenshots`: default `false`; enable only for small debugging runs.
- `fargate_capacity`: `on_demand` or `spot`.

`prod-ca` targets the live production site at `https://thelist.710labs.com`, `prod-co` targets `https://thelist-co.710labs.com`, `prod-mi` targets `https://thelist-mi.710labs.com`, and `prod-nj` targets `https://thelist-nj.710labs.com`. For production verification runs, prefer `mode=dry` or `place_orders=false` unless production order placement is intentional.

The workflow derives exact 10-browser Fargate workers for presets above 10, so the default 100 bypass browsers become 10 workers and the default 50 realqueue browsers become 5 workers.

## Modes

- `flip`: starts realqueue browsers 5 minutes before `gate_iso`, then starts bypass browsers at `gate_iso`. HTTP load is intentionally excluded from flip; use `entry-only`, `http-funnel`, or an external tool such as k6 for HTTP pressure.
- `entry-only`: runs only the Queue-It HTTP entry redirect test.
- `bypass-only`: runs only VIP-cookie browser users.
- `realqueue-only`: runs only non-VIP browser users.
- `http-funnel`: runs only the HTTP age/password/register endpoint funnel.
- `waitlist-only`: runs waitlist browsers without checkout traffic.
- `site-waitlist-only`: validates a storefront configured to offer waitlists for the entire catalog and runs consecutive waitlist signups.
- `dry`: validates configs and renders smoke configs without launching Fargate.

### Waitlist load and inventory transitions

Set `waitlist_browsers` above zero in `bypass-only`, `realqueue-only`, or `flip` to
run the waitlist alongside checkout. Waitlist jobs use VIP bypass and launch at
`gate_iso`. Real-queue checkout traffic depends on Queue-It release. Use
`waitlist-only` for the waitlist cohort by itself. Leave `waitlist_browsers` at
zero for the standard Drop Simulation.

- `waitlist_products`: comma-separated `productId:startingStock` pairs, such as
  `181894:1,181895:3,181896:0`. Seed those quantities before dispatch. Zero tests
  joining an already sold-out item. Positive stock tests depleting it via cart
  holds without placing waitlist-product orders.
- `waitlist_facility_id`: expected pickup facility ID. Set up the drop so the
  existing test address and Pickup selection route users to that facility. The
  waitlist modal must identify that pickup facility and the selected product.
- `checkout_product_ids`: comma-separated allowlist for mixed checkout
  traffic. Use a separate pool of high-inventory products available for the
  same Pickup setup, including alternatives beyond `cart_item_count`.
  Checkout tries alternatives from this pool after a stock rejection.
- `waitlist_browsers`: total concurrency, up to 200, allocated across the
  product jobs. Each product needs at least its starting stock plus one
  browser, so the example above requires at least 7. Dry mode shows the
  exact allocation and Fargate worker count before dispatching load. Uneven
  allocations can run fewer browsers per worker to preserve the exact count.
- `waitlist_duration_seconds` sets the arrival window from 1 to 900 seconds
  and defaults to 900. Use 1 for a single wave. By default, longer runs sustain
  arrivals at the configured cap per second and may skip arrivals while at
  the concurrency limit.
- `waitlist_spread_arrivals` spreads a fixed number of starts across the
  arrival window. For 50 browsers over 30 seconds, set it to true and set
  `waitlist_duration_seconds` to 30. Each of the five workers starts ten
  browsers, with one start per worker about every three seconds.

For an initial mixed smoke, use `mode=bypass-only`, `bypass_browsers=1`,
`waitlist_products=181894:1`, `waitlist_browsers=2`,
`waitlist_duration_seconds=1`, `place_orders=false`, and your facility and
checkout product IDs. This stops the checkout cohort before order submission.
Choose a future gate when the job launches need to line up.

The test samples the product card's numeric `data-gtm4wp_product_data.stocklevel`
separately from its button. This signal must represent available units for the
chosen pickup setup and reflect cart holds. Check that on a seeded dev or stage
product before scaling. The run requires a seeded positive sample, enough
confirmed cart holds, and at least one confirmed join for each positive-stock
product. It fails if a sampled positive quantity shows a waitlist, or zero
persists for 30 seconds without an enabled Join Waitlist button. Stock is
sampled on storefront reloads, so the zero-to-button timing starts at the first
observed zero. The test keeps cart holds in the test accounts until the site's
normal expiration.

Each product job publishes its own Artillery report. The GitHub summaries show
confirmed joins, stock races and recoveries, inventory transition failures,
and p95 latency for the observed zero-to-button and submit-to-confirmation steps.
The checkout jobs show their own success totals and checkout p95.

### Storefront in waitlist-only mode

Enable the site's waitlist-only setting before dispatching
`mode=site-waitlist-only`. Set `waitlist_browsers`, `waitlist_facility_id`, and
`waitlist_duration_seconds`. Leave `waitlist_products` and
`checkout_product_ids` blank. This mode discovers the products offered to the
selected pickup facility, including subsequent WooCommerce catalog pages.

Each browser checks every displayed card for an enabled **Join Waitlist**
button and fails if the catalog shows any **Add to cart** control. It then joins
each distinct product in succession and verifies **On waitlist** after every
submission. The storefront setting governs this mode, so a product's inventory
can still be positive. The test sends no cart additions or checkout traffic.

For a smoke run, use one browser and a duration of one second. For sustained
signup traffic, increase the browser count and duration. Reports include
completed catalog journeys, confirmations, and submit-to-confirmation p95.

Run the local browser fixture checks with
`node --test loadtest/flows/waitlist.test.js` after installing loadtest
dependencies and Playwright Chromium.

## Secrets

Required for Fargate runs:

- `ARTILLERY_LIST_PASSWORD`
- `RECAPTCHA_BYPASS`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_REGION`
- `ARTILLERY_REPORT_APIKEY`

Optional:

- `VIP_COOKIE_VALUE`; defaults to `3`.
- `SLACK_WEBHOOK_URL`; posts workflow status and Artillery summaries when set.

## Queue-It Prerequisite

`http-entry` only passes when Queue-It is active server-side for the target and `/` returns a `302` with a `queue-it.net` location. If the target returns `200`, Queue-It is not enabled for that route or the integration is client-side JavaScript; in that case HTTP cannot validate the redirect and the real browser scenarios become the source of truth.

For a meaningful `flip` run, configure the Queue-It event and outflow outside this repo before starting the workflow. Realqueue browsers are launched before the gate and intentionally omit `vipChecker`.

If a realqueue smoke run fails with `Storefront was not ready within N seconds` while the current URL is still Queue-It, the browser wait path worked but Queue-It did not release the user inside `queue_wait_minutes`. That is expected when testing before the scheduled event release. A full success requires the user to leave Queue-It, reach the storefront, and complete the funnel.

## Fargate Sizing

The default browser topology is:

- Bypass: 100 browsers, 10 workers, 4 vCPU / 8 GB each.
- Realqueue: 50 browsers, 5 workers, 4 vCPU / 8 GB each.

Before a full 150-browser flip, verify regional Fargate vCPU, ENI, subnet IP, and task-count limits. Request roughly 128 vCPU of quota so the run has headroom beyond the default 60 vCPU topology.

## Safety

`place_orders=true` is the default. Use `place_orders=false` only for explicit checkout-path smoke runs that must stop before order submission.

Generated configs, dotenv files, reports, and screenshots under `loadtest/` are ignored by git.
