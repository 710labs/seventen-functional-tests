import { test, expect, devices, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'
import flZipcodes from '../../utils/zipcodes-fl.json'
import miZipcodes from '../../utils/zipcodes-mi.json'
import caZipcodes from '../../utils/zipcodes-ca.json'

test(`Basic Order - New Customer #medical @MI`, async ({ page, browserName }, workerInfo) => {
	const apiContext = await request.newContext({
		baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
		extraHTTPHeaders: {
			'x-api-key': `${process.env.API_KEY}`,
		},
	})
	const address = '123 Eight Mile Rd'
	var index = await Math.floor(Math.random() * (miZipcodes.length - 0) + 0)
	const zipCode = miZipcodes[index]
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
	await createAccountPage.createMichiganCustomer(email, 'test1234', zipCode, 1, false, address, 'FL')
	await shopPage.addProductsToCart(6, mobile)
	var cartTotals = await cartPage.verifyCart(zipCode)
	await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true, address)
})
