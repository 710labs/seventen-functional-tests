import { test as base } from '@playwright/test'

export type TestOptions = {
	orders: string[][]
}

export const test = base.extend<TestOptions>({
	orders: [[['']], { option: true }],
})
