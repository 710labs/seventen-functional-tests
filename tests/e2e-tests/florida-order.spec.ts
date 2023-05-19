import { test, expect, devices, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'
import zipcodes from '../../utils/zipcodes-fl.json'
import { visualDiff, visualDiffWithMaskArray } from '../../utils/visual-diff'

test(`Basic Order - New Customer #medical @FL`, async ({ page, browserName }, workerInfo) => {
	const apiContext = await request.newContext({
		baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
		extraHTTPHeaders: {
			'x-api-key': `${process.env.API_KEY}`,
		},
	})
	const address = '3275 NW 24th Street Rd'
	var index = await Math.floor(Math.random() * (zipcodes.length - 0) + 0)
	const zipCode = zipcodes[index]
	const email = `test+${uuidv4()}@710labs-test.com`
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, apiContext)
	const myAccountPage = new MyAccountPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
	const checkOutPage = new CheckoutPage(page, apiContext)
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword('qatester')
	await createAccountPage.create(email, 'test1234', zipCode, 1, false, address, 'FL')
	const shopMasks = [shopPage.productImage]
	await visualDiffWithMaskArray(page, `store-landing-page-new-FL-med-${process.env.ENV}.png`, 1500, shopMasks)
	if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
		await myAccountPage.addAddress(address, 'Miami', 'FL', zipCode)
	}
	await shopPage.addProductsToCart(6, mobile)
	var cartMaskLocators = [cartPage.productName, cartPage.productImage, cartPage.productImage2, cartPage.reservationTimer]
	await visualDiffWithMaskArray(page, `cart-page-new-FL-med-${process.env.ENV}.png`, 1500, cartMaskLocators)
	var cartTotals = await cartPage.verifyCart(zipCode)
	var checkoutMaskLocators = [checkOutPage.personalInfoField, checkOutPage.reservationTimer, checkOutPage.AppointmentsSection, checkOutPage.FulfillmentMethodSection, checkOutPage.AddressSection]
	await visualDiffWithMaskArray(page, `checkout-page-new-FL-med-${process.env.ENV}.png`, 1500, checkoutMaskLocators)
	await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true, address)
})
