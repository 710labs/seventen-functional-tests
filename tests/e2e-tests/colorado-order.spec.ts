import { test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'
import { faker } from '@faker-js/faker'

test.describe('CO Order Tests', { tag: ['@CO'] }, () => {
	test.describe.configure({ mode: 'parallel' })
	test(
		`Basic Order - Existing Customer - Medical`,
		{ tag: ['@medical'] },
		async ({ page, browserName, qaClient }, workerInfo) => {
			const address = '933 Alpine Ave'
			const city = 'Boulder'
			const state = 'CO'
			const zipCode = '80304'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const myAccountPage = new MyAccountPage(page)
			const loginPage = new LoginPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'medical')
			const checkOutPage = new CheckoutPage(page, qaClient)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			var user = await createAccountPage.createApi('medical', 'current')
			await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			await loginPage.login(user.email, user.password)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addAddress(address, city, state, zipCode)
			}
			await myAccountPage.addMedicalExp()
			await shopPage.addProductsToCartPickup(6, mobile, 'Pickup', 'medical')
			var cartTotals = await cartPage.verifyCart(zipCode)
			await checkOutPage.confirmCheckoutColorado(zipCode, cartTotals, 'medical')
		},
	)
	test(
		`Basic Order - New Customer - Medical`,
		{ tag: ['@medical'] },
		async ({ page, browserName, qaClient }, workerInfo) => {
			const zipCode = '80304'
			const email = `test+${uuidv4()}@710labs-test.com`
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const myAccountPage = new MyAccountPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'medical')
			const checkOutPage = new CheckoutPage(page, qaClient)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			// await createAccountPage.createColoradoCustomer(email, 'test1234', zipCode, 1)
			const address = '933 Alpine Ave, Boulder, CO, 80304'
			var fakeFirstName = faker.name.firstName() + '_Test'
			var fakeLastName = faker.name.lastName() + '_Test'
			var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'

			await createAccountPage.create(
				fakeFirstName,
				fakeLastName,
				fakeEmail,
				'test1234',
				zipCode,
				'medical',
				false,
				address,
				'CO',
			)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addColoradoAddress()
			}
			await shopPage.addProductsToCartPickup(6, mobile, 'Pickup', 'medical')
			var cartTotals = await cartPage.verifyCart(zipCode)
			await checkOutPage.confirmCheckoutColorado(zipCode, cartTotals, 'medical')
		},
	)
	test(
		`Basic Order - Existing Customer - Recreational`,
		{ tag: ['@recreational'] },
		async ({ page, browserName, qaClient }, workerInfo) => {
			const zipCode = '80304'
			const address = '933 Alpine Ave'
			const city = 'Boulder'
			const state = 'CO'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const myAccountPage = new MyAccountPage(page)
			const loginPage = new LoginPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
			const checkOutPage = new CheckoutPage(page, qaClient)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			var user = await createAccountPage.createApi('recreational', 'current')
			await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			await loginPage.login(user.email, user.password)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addAddress(address, city, state, zipCode)
			}

			await shopPage.addProductsToCartPickup(6, mobile, 'Pickup', 'recreational')
			var cartTotals = await cartPage.verifyCart(zipCode)
			await checkOutPage.confirmCheckoutColorado(zipCode, cartTotals, 'recreational')
		},
	)
	test(
		`Basic Order - New Customer - Recreational`,
		{ tag: ['@recreational'] },
		async ({ page: page, browserName, qaClient }, workerInfo) => {
			const zipCode = '80304'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const myAccountPage = new MyAccountPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
			const checkOutPage = new CheckoutPage(page, qaClient)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			const address = '933 Alpine Ave, Boulder, CO, 80304'
			var fakeFirstName = faker.name.firstName() + '_Test'
			var fakeLastName = faker.name.lastName() + '_Test'
			var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'

			await createAccountPage.create(
				fakeFirstName,
				fakeLastName,
				fakeEmail,
				'test1234',
				zipCode,
				'recreational',
				false,
				address,
				'CO',
			)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addColoradoAddress()
			}
			await shopPage.addProductsToCartPickup(6, mobile, 'Pickup', 'recreational')
			var cartTotals = await cartPage.verifyCart(zipCode)
			await checkOutPage.confirmCheckoutColorado(zipCode, cartTotals, 'recreational')
		},
	)
})
