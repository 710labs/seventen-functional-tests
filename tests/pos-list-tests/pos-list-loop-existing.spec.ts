import { test, request, APIRequestContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'

// Environment variables
const POS_LIST_PASSWORD = process.env.POS_LIST_PASSWORD

// Read CSV file
const csvPath = path.resolve(__dirname, 'pos-tests.csv')
const csvContent = fs.readFileSync(csvPath, 'utf-8')
const records: Array<Record<string, string>> = parse(csvContent, {
	columns: true,
	skip_empty_lines: true,
})

test.describe('POS Order Tests', { tag: ['@POS'] }, () => {
	test.describe.configure({ mode: 'parallel' })

	let apiContext: APIRequestContext

	test.beforeAll(async ({ request }) => {
		apiContext = request
	})

	for (const row of records) {
		test(
			`POS Existing Order - ${row['Test Name']}`,
			{ tag: ['@POSexisting'] },
			async ({ page, browserName }, workerInfo) => {
				const ageGatePage = new AgeGatePage(page)
				const listPassword = new ListPasswordPage(page)
				const createAccountPage = new CreateAccountPage(page, apiContext)
				const shopPage = new ShopPage(page, browserName, workerInfo)
				const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
				const checkOutPage = new CheckoutPage(page, apiContext)
				const myAccountPage = new MyAccountPage(page)
				const loginPage = new LoginPage(page)

				const mobile = workerInfo.project.name === 'Mobile Chrome'
				test.skip(mobile, 'Skipping Mobile Chrome tests')

				await ageGatePage.passAgeGate()
				await listPassword.submitPassword('qatester')

				const nameUserTestCase = `${row['POS']}+${row['Test ID']}+${row['Round']}`

				// Create POS user using CSV data
				// await createAccountPage.createPOS(
				// 	nameUserTestCase, // name
				// 	POS_LIST_PASSWORD ?? '', // password
				// 	row['Zipcode'], // zipcode
				// 	1, // type (update to row['Type'] if CSV includes it)
				// 	false, // logout
				// 	row['Address'], // address
				// 	row['State'], // state (update to row['State'] if CSV includes it)
				// 	row['Exp Month'], // expMonth
				// 	row['Exp Day'], // expDay
				// 	row['Exp Year'], // expYear
				// )

				await loginPage.login(`${nameUserTestCase}@test.com`, POS_LIST_PASSWORD ?? '')

				// Optionally add address before checkout
				// if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				//   await myAccountPage.addAddress();
				// }

				await shopPage.addProductsToCart(4, false, 'Pickup', 'Medical')
				await cartPage.goToCheckout()
				await checkOutPage.posCheckout()
			},
		)
	}
})
