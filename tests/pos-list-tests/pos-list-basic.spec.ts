import { test, request, APIRequestContext } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'

test.describe('POS Order Tests', { tag: ['@POS'] }, () => {
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	test(
		`POS Basic Order - New Customer - Medical`,
		{ tag: ['@POSmedical'] },
		async ({ page, browserName }, workerInfo) => {
			// const zipCode = '94020'
			// const name = `test+${uuidv4()}`
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			// const myAccountPage = new MyAccountPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
			const checkOutPage = new CheckoutPage(page, apiContext)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			await listPassword.submitPassword('qatester')
			await createAccountPage.createPOS(
				`test+${uuidv4()}`,
				'test1234',
				'94020',
				1,
				false,
				'440 Rodeo Dr. Los Angeles, CA',
				'CA',
				'12',
				'12',
				'2025',
			)
			// if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			// 	await myAccountPage.addAddress()
			// }
			await shopPage.addProductsToCart(6, mobile, 'Delivery', 'Medical')
			await cartPage.goToCheckout()
			// var cartTotals = await cartPage.verifyCart(zipCode)
			// await checkOutPage.confirmCheckout(zipCode, cartTotals, 1)
			await checkOutPage.posCheckout()
		},
	)
})
