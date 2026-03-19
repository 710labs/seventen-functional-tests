#!/usr/bin/env bash

set -euo pipefail

POS_BASE_URL="${POS_BASE_URL:?POS_BASE_URL is required}"
POS_QA_AUTH="${POS_QA_AUTH:?POS_QA_AUTH is required}"
POS_RESULTS_DIR="${POS_RESULTS_DIR:-pos-results}"
ORDER_IDS_FILE="${POS_RESULTS_DIR}/order-ids.json"
SUMMARY_FILE="${POS_RESULTS_DIR}/verification-summary.json"

if ! command -v jq >/dev/null 2>&1; then
	sudo apt-get update -y
	sudo apt-get install -y jq
fi

mkdir -p "${POS_RESULTS_DIR}"

if [[ ! -f "${ORDER_IDS_FILE}" ]]; then
	echo '{"status":"skipped","message":"No order ID file was generated.","checked":0,"failures":[]}' > "${SUMMARY_FILE}"
	exit 0
fi

mapfile -t ORDER_IDS < <(jq -r '.[]' "${ORDER_IDS_FILE}")

if [[ ${#ORDER_IDS[@]} -eq 0 ]]; then
	echo '{"status":"skipped","message":"No order IDs were available for POS verification.","checked":0,"failures":[]}' > "${SUMMARY_FILE}"
	exit 0
fi

failures_json='[]'
checked=0
passed=0

for order_id in "${ORDER_IDS[@]}"; do
	checked=$((checked + 1))
	success=false
	last_http_code=""
	last_message=""
	missing_fields='[]'

	for attempt in 1 2 3 4 5 6; do
		url="${POS_BASE_URL%/}/wp-content/plugins/persy/interface/qa/orders/?auth=${POS_QA_AUTH}&id=${order_id}"
		http_code=$(curl -sS -L -w "%{http_code}" -o /tmp/site-readiness-pos-response.json "${url}" || true)
		last_http_code="${http_code}"

		if [[ "${http_code}" != "200" ]]; then
			last_message="Received HTTP ${http_code}"
			sleep 10
			continue
		fi

		if ! jq . >/dev/null 2>&1 </tmp/site-readiness-pos-response.json; then
			last_message="Response was not valid JSON"
			sleep 10
			continue
		fi

		outcome=$(jq -r '.outcome // empty' /tmp/site-readiness-pos-response.json)
		if [[ "${outcome}" != "success" ]]; then
			last_message="$(jq -r '.message // "POS outcome was not success"' /tmp/site-readiness-pos-response.json)"
			sleep 10
			continue
		fi

		instance_id=$(jq -r '.instanceId // .instanceID // empty' /tmp/site-readiness-pos-response.json)
		instance_name=$(jq -r '.instanceName // empty' /tmp/site-readiness-pos-response.json)
		instance_type=$(jq -r '.instanceType // empty' /tmp/site-readiness-pos-response.json)
		external_id=$(jq -r '.externalId // .externalID // empty' /tmp/site-readiness-pos-response.json)

		missing=()
		[[ -z "${instance_id}" ]] && missing+=("instanceId")
		[[ -z "${instance_name}" ]] && missing+=("instanceName")
		[[ -z "${instance_type}" ]] && missing+=("instanceType")
		[[ -z "${external_id}" ]] && missing+=("externalId")

		if [[ ${#missing[@]} -eq 0 ]]; then
			success=true
			passed=$((passed + 1))
			break
		fi

		missing_fields="$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)"
		last_message="Missing POS fields"
		sleep 10
	done

	if [[ "${success}" != "true" ]]; then
		failures_json="$(
			jq -n \
				--argjson existing "${failures_json}" \
				--arg orderId "${order_id}" \
				--arg httpCode "${last_http_code}" \
				--arg message "${last_message}" \
				--argjson missing "${missing_fields}" \
				'$existing + [{ orderId: $orderId, httpCode: $httpCode, message: $message, missing: $missing }]'
		)"
	fi
done

status="pass"
message="All orders contain the required POS transmission fields."

if [[ "${failures_json}" != "[]" ]]; then
	status="fail"
	message="One or more orders were missing required POS transmission fields."
fi

jq -n \
	--arg status "${status}" \
	--arg message "${message}" \
	--argjson checked "${checked}" \
	--argjson passed "${passed}" \
	--argjson failed "$((checked - passed))" \
	--argjson failures "${failures_json}" \
	'{
		status: $status,
		message: $message,
		checked: $checked,
		passed: $passed,
		failed: $failed,
		failures: $failures
	}' > "${SUMMARY_FILE}"

if [[ "${status}" == "fail" ]]; then
	exit 1
fi
