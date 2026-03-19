#!/usr/bin/env bash

set -euo pipefail

TARGET_URL="${TARGET_URL:?TARGET_URL is required}"
RESULTS_DIR="${RESULTS_DIR:-security-results}"

if ! command -v jq >/dev/null 2>&1; then
	sudo apt-get update -y
	sudo apt-get install -y jq
fi

mkdir -p "${RESULTS_DIR}"

HOSTNAME="$(echo "${TARGET_URL}" | sed 's|https\?://||' | cut -d'/' -f1)"
RAW_PATH="${RESULTS_DIR}/observatory.json"
SUMMARY_PATH="${RESULTS_DIR}/observatory-summary.json"

curl -sS -X POST "https://http-observatory.security.mozilla.org/api/v1/analyze?host=${HOSTNAME}&hidden=true" \
	-H 'Content-Type: application/x-www-form-urlencoded' \
	>/dev/null

sleep 10

RESULT="$(curl -sS "https://http-observatory.security.mozilla.org/api/v1/analyze?host=${HOSTNAME}")"
echo "${RESULT}" | jq '.' > "${RAW_PATH}"

GRADE="$(echo "${RESULT}" | jq -r '.grade // "UNKNOWN"')"
SCORE="$(echo "${RESULT}" | jq -r '.score // 0')"

status="pass"
message="Mozilla Observatory grade ${GRADE}."
exit_code=0

case "${GRADE}" in
	A*|B*)
		status="pass"
		;;
	C*)
		status="warn"
		message="Mozilla Observatory grade ${GRADE}; review missing hardening headers."
		exit_code=10
		;;
	D*|E*|F*)
		status="fail"
		message="Mozilla Observatory grade ${GRADE} is below the minimum acceptable grade."
		exit_code=20
		;;
	*)
		status="error"
		message="Mozilla Observatory did not return a valid grade."
		exit_code=30
		;;
esac

OBS_STATUS="${status}" \
OBS_MESSAGE="${message}" \
HOSTNAME="${HOSTNAME}" \
GRADE="${GRADE}" \
SCORE="${SCORE}" \
SUMMARY_PATH="${SUMMARY_PATH}" \
node - <<'NODE'
const fs = require('node:fs')

const summary = {
	status: process.env.OBS_STATUS,
	message: process.env.OBS_MESSAGE,
	host: process.env.HOSTNAME,
	grade: process.env.GRADE,
	score: Number.parseInt(process.env.SCORE, 10),
}

fs.writeFileSync(process.env.SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`)
NODE

exit "${exit_code}"
