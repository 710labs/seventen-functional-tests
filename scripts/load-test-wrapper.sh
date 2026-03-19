#!/usr/bin/env bash

set -euo pipefail

ARTILLERY_TARGET="${ARTILLERY_TARGET:?ARTILLERY_TARGET is required}"
ARTILLERY_CONFIG_TEMPLATE="${ARTILLERY_CONFIG_TEMPLATE:?ARTILLERY_CONFIG_TEMPLATE is required}"
ARTILLERY_DURATION="${ARTILLERY_DURATION:-300}"
ARTILLERY_ARRIVAL_RATE="${ARTILLERY_ARRIVAL_RATE:-1}"
ARTILLERY_MAX_VUS="${ARTILLERY_MAX_VUS:-5}"

RESULTS_DIR="load-test-results"
OUTPUT_JSON="${RESULTS_DIR}/artillery-report.json"
OUTPUT_HTML="${RESULTS_DIR}/artillery-report.html"
SUMMARY_JSON="${RESULTS_DIR}/load-test-summary.json"

mkdir -p "${RESULTS_DIR}"

if [[ ! -f "${ARTILLERY_CONFIG_TEMPLATE}" ]]; then
	echo "Missing Artillery config template: ${ARTILLERY_CONFIG_TEMPLATE}" >&2
	exit 1
fi

TMP_CONFIG="$(mktemp /tmp/site-readiness-artillery.XXXXXX.yml)"
cleanup() {
	rm -f "${TMP_CONFIG}"
}
trap cleanup EXIT

cp "${ARTILLERY_CONFIG_TEMPLATE}" "${TMP_CONFIG}"
sed -i.bak "s/duration: [0-9][0-9]*/duration: ${ARTILLERY_DURATION}/" "${TMP_CONFIG}"
sed -i.bak "s/arrivalRate: [0-9][0-9]*/arrivalRate: ${ARTILLERY_ARRIVAL_RATE}/" "${TMP_CONFIG}"
sed -i.bak "s/maxVusers: [0-9][0-9]*/maxVusers: ${ARTILLERY_MAX_VUS}/" "${TMP_CONFIG}"
rm -f "${TMP_CONFIG}.bak"

status="pass"
message="Load test completed successfully."

set +e
npx artillery run "${TMP_CONFIG}" --output "${OUTPUT_JSON}"
exit_code=$?
set -e

if [[ ${exit_code} -ne 0 ]]; then
	status="fail"
	message="Artillery exited with code ${exit_code}."
fi

npx artillery report --output "${OUTPUT_HTML}" "${OUTPUT_JSON}" >/dev/null 2>&1 || true

LOAD_STATUS="${status}" \
LOAD_MESSAGE="${message}" \
SUMMARY_JSON="${SUMMARY_JSON}" \
OUTPUT_JSON="${OUTPUT_JSON}" \
OUTPUT_HTML="${OUTPUT_HTML}" \
node - <<'NODE'
const fs = require('node:fs')

const summaryPath = process.env.SUMMARY_JSON
const summary = {
	status: process.env.LOAD_STATUS,
	message: process.env.LOAD_MESSAGE,
	target: process.env.ARTILLERY_TARGET,
	configTemplate: process.env.ARTILLERY_CONFIG_TEMPLATE,
	durationSeconds: Number.parseInt(process.env.ARTILLERY_DURATION, 10),
	arrivalRate: Number.parseInt(process.env.ARTILLERY_ARRIVAL_RATE, 10),
	maxVusers: Number.parseInt(process.env.ARTILLERY_MAX_VUS, 10),
	rawReportPath: process.env.OUTPUT_JSON,
	htmlReportPath: process.env.OUTPUT_HTML,
}

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
NODE

if [[ ${exit_code} -ne 0 ]]; then
	exit "${exit_code}"
fi
