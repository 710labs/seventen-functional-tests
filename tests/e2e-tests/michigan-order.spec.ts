import { test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'
import { fictionalAreacodes } from '../../utils/data-generator'

test.describe('MI Order Tests', { tag: ['@MI'] }, () => {
	test.describe.configure({ mode: 'parallel' })

	test(
		`Basic Order - New Customer - In State - Recreational`,
		{ tag: ['@recreational', '@InState'] },
		async ({ page, browserName, qaClient }, workerInfo) => {
			const address = '123 Eight Mile Rd MI'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
			const checkOutPage = new CheckoutPage(page, qaClient)
			test.skip(workerInfo.project.name === 'Mobile Chrome')

			await test.step(`Pass Age Gate`, async () => {
				await ageGatePage.passAgeGate()
			})

			await test.step(`Enter List Password`, async () => {
				await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			})

			await test.step(`Create Account`, async () => {
				var fakeFirstName = faker.name.firstName()
				var fakeLastName = faker.name.lastName()
				var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'
				// 'fakeFirstName_fakeLastName@test_710labs_playwright.com'
				await createAccountPage.createMichiganCustomer(
					fakeFirstName,
					fakeLastName,
					fakeEmail,
					faker.internet.password(),
					faker.datatype.number({ min: 1, max: 28 }),
					faker.datatype.number({ min: 10, max: 12 }),
					faker.datatype.number({ min: 1975, max: 2001 }),
					faker.phone.phoneNumber('555-###-####'),
					'recreational',
					address,
					faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
					faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
				)
			})

			await test.step(`Load Shopping Cart`, async () => {
				await shopPage.addProductsToCart(6, false, 'Pickup', 'recreational')
			})

			await test.step(`Navigate to Checkout`, async () => {
				await cartPage.goToCheckout()
			})

			await test.step(`Choose Acuity Slot`, async () => {
				await checkOutPage.selectSlot()
			})

			await test.step(`Complete Order`, async () => {
				await checkOutPage.placeOrderButton.click()
			})
		},
	)

	test(
		`Basic Order - New Customer - Out Of State - Recreational `,
		{ tag: ['@recreational', '@OutOfState'] },
		async ({ page, browserName, orders, qaClient }, workerInfo) => {
			const address = '123 Broadway New York'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, qaClient)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
			const checkOutPage = new CheckoutPage(page, qaClient)
			test.skip(workerInfo.project.name === 'Mobile Chrome')

			await test.step(`Pass Age Gate`, async () => {
				await ageGatePage.passAgeGate()
			})

			await test.step(`Enter List Password`, async () => {
				await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
			})

			await test.step(`Create Account`, async () => {
				var fakeFirstName = faker.name.firstName()
				var fakeLastName = faker.name.lastName()
				var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'
				// 'fakeFirstName_fakeLastName@test_710labs_playwright.com'
				await createAccountPage.createMichiganCustomer(
					fakeFirstName,
					fakeLastName,
					fakeEmail,
					faker.internet.password(),
					faker.datatype.number({ min: 1, max: 28 }),
					faker.datatype.number({ min: 10, max: 12 }),
					faker.datatype.number({ min: 1975, max: 2001 }),
					faker.phone.phoneNumber('555-###-####'),
					'recreational',
					address,
					faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
					faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
				)
			})
			await test.step(`Load Shopping Cart`, async () => {
				await shopPage.addProductsToCart(6, false, 'Pickup', 'recreational')
			})

			await test.step(`Navigate to Checkout`, async () => {
				await cartPage.goToCheckout()
			})

			await test.step(`Choose Acuity Slot`, async () => {
				await checkOutPage.selectSlot()
			})

			await test.step(`Complete Order`, async () => {
				await checkOutPage.placeOrderButton.click()
			})
		},
	)
})
