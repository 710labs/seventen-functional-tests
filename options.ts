import {
	devices,
	expect,
	request,
	test as base,
} from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { QAClient, buildQaApiBaseUrl, type DomainState } from './support/qa/client'

export type TestOptions = {
	orders: string[][]
}

type TestFixtures = {
	qaRequest: APIRequestContext
	qaClient: QAClient
	domainState: {
		set: (state: DomainState) => Promise<string>
	}
}

export const test = base.extend<TestOptions & TestFixtures>({
	orders: [[['']], { option: true }],
	qaRequest: [
		async ({}, use, workerInfo) => {
			const apiKey = process.env.API_KEY || process.env.SEVENTEN_QA_API_KEY
			const baseURL = workerInfo.project.use.baseURL as string | undefined

			if (!apiKey) {
				throw new Error('API_KEY is required to initialize the QA API request context.')
			}

			const qaRequest = await request.newContext({
				baseURL: buildQaApiBaseUrl(baseURL, process.env.QA_ENDPOINT),
				extraHTTPHeaders: {
					'x-api-key': apiKey,
				},
			})

			await use(qaRequest)
			await qaRequest.dispose()
		},
		{ scope: 'worker' },
	],
	qaClient: [
		async ({ qaRequest }, use) => {
			await use(new QAClient(qaRequest))
		},
		{ scope: 'worker' },
	],
	domainState: async ({ qaClient }, use) => {
		await use({
			set: (state: DomainState) => qaClient.setDomainState(state),
		})
	},
})

export { devices, expect, request }
export type { APIRequestContext }
