import { expect, test, type Locator, type Page } from '@playwright/test'
import { selectAutocompleteAddress as selectAddress } from './address-autocomplete.cjs'

export async function selectAutocompleteAddress(
	page: Page,
	field: Locator,
	address: string,
	timeout = 10000,
	step: (name: string, action: () => Promise<void>) => Promise<void> = (name, action) => test.step(name, action),
) {
	return step('Select address autocomplete suggestion', () => selectAddress(page, field, address, timeout, expect))
}
