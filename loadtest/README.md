# Load Test - Drop Simulation

This directory contains the self-contained Artillery suite for the manual **Load Test- Drop Simulation** GitHub Action. It is built for The List dev/stage environments and uses AWS Fargate for generated load.

## What Runs

- `config/http-entry.yml`: HTTP stampede against `/` with no VIP cookie. It expects a `302` redirect to `queue-it.net`.
- `config/http-funnel.yml`: HTTP-only funnel pressure with `vipChecker` and optional reCAPTCHA bypass.
- `config/browser-bypass.yml`: Playwright browser funnel with `vipChecker`, defaulting to 100 browsers in the workflow.
- `config/browser-realqueue.yml`: Playwright browser funnel without `vipChecker`, defaulting to 50 browsers and waiting up to 60 minutes for Queue-It release in the workflow.

Browser scenarios use `flows/funnel.js`. HTTP scenarios use `flows/http.js`.

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

- `env`: `stage` or `dev`; production is intentionally excluded.
- `target`: must match the selected environment URL.
- `mode`: `flip`, `entry-only`, `bypass-only`, `realqueue-only`, `http-funnel`, or `dry`.
- `bypass_browsers`: total bypass browser concurrency; default `100`. Presets: `1`, `5`, `10`, `20`, `30`, `40`, `50`, `60`, `70`, `80`, `90`, `100`, `150`, `200`.
- `realqueue_browsers`: total real-queue browser concurrency; default `50`. Presets: `1`, `5`, `10`, `20`, `30`, `40`, `50`, `60`, `70`, `80`, `90`, `100`, `150`, `200`.
- `gate_iso`: Queue-It event start time. Empty means "now".
- `queue_wait_minutes`: max time realqueue browsers wait for Queue-It release; default `60`. Presets: `20`, `30`, `45`, `60`, `90`, `120`.
- `place_orders`: default `true`; when true, browser funnels click `#place_order`.
- `screenshots`: default `false`; enable only for small debugging runs.
- `fargate_capacity`: `on_demand` or `spot`.

The workflow derives exact 10-browser Fargate workers for presets above 10, so the default 100 bypass browsers become 10 workers and the default 50 realqueue browsers become 5 workers.

## Modes

- `flip`: starts realqueue browsers 5 minutes before `gate_iso`, then starts bypass browsers at `gate_iso`. HTTP load is intentionally excluded from flip; use `entry-only`, `http-funnel`, or an external tool such as k6 for HTTP pressure.
- `entry-only`: runs only the Queue-It HTTP entry redirect test.
- `bypass-only`: runs only VIP-cookie browser users.
- `realqueue-only`: runs only non-VIP browser users.
- `http-funnel`: runs only the HTTP age/password/register endpoint funnel.
- `dry`: validates configs and renders smoke configs without launching Fargate.

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
