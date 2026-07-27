import test, { expect, Locator, Page } from '@playwright/test'
import { AccountPage } from './account-page'

const cartDrawerSelector = [
	'.wpse-drawer[data-module="cart"]',
	'.wpse-drawer[data-module="cart-response"]',
].join(', ')

export class LiveNonProdAccountPage extends AccountPage {
	constructor(page: Page) {
		super(page)
	}

	private isWordPressLogoutConfirmation(url: URL) {
		return (
			url.pathname.endsWith('/wp-login.php') &&
			url.searchParams.get('action') === 'logout'
		)
	}

	private async refreshLogoutLink() {
		await this.page.reload({ waitUntil: 'domcontentloaded' })
		await expect(this.pageTitleSelector).toBeVisible()
		await expect(this.signOutLink).toBeVisible()
		await expect(this.signOutLink).toHaveAttribute('href', /_wpnonce=/)
	}

	private async elementIntersectsViewport(locator: ReturnType<Page['locator']>) {
		if ((await locator.count()) === 0) {
			return false
		}

		return locator
			.evaluate(element => {
				const rect = element.getBoundingClientRect()
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					rect.left < window.innerWidth &&
					rect.right > 0 &&
					rect.top < window.innerHeight &&
					rect.bottom > 0
				)
			})
			.catch(() => false)
	}

	private async getActiveCartDrawer() {
		const cartDrawers = this.page.locator(cartDrawerSelector)
		const cartDrawerCount = await cartDrawers.count()

		for (let index = 0; index < cartDrawerCount; index += 1) {
			const cartDrawer = cartDrawers.nth(index)

			if (await this.elementIntersectsViewport(cartDrawer)) {
				return cartDrawer
			}
		}

		return null
	}

	private async cartDrawerIsOpen() {
		return Boolean(await this.getActiveCartDrawer())
	}

	private async waitForCartDrawerState(isOpen: boolean, timeout = 5000) {
		const deadline = Date.now() + timeout

		while (Date.now() < deadline) {
			if ((await this.cartDrawerIsOpen()) === isOpen) {
				return true
			}

			await this.page.waitForTimeout(100)
		}

		return (await this.cartDrawerIsOpen()) === isOpen
	}

	private async clickActiveCartToggle() {
		const cartToggles = this.page.locator('a.wpse-cart-openerize')
		const cartToggleCount = await cartToggles.count()

		for (let index = 0; index < cartToggleCount; index += 1) {
			const cartToggle = cartToggles.nth(index)

			if (await this.elementIntersectsViewport(cartToggle)) {
				await cartToggle.evaluate((element: HTMLElement) => element.click())
				return true
			}
		}

		return false
	}

	private async getBlockingScrim() {
		const scrims = this.page.locator('.wpse-scrim-front')
		const scrimCount = await scrims.count()

		for (let index = 0; index < scrimCount; index += 1) {
			const scrim = scrims.nth(index)

			if (await this.elementIntersectsViewport(scrim)) {
				return scrim
			}
		}

		return null
	}

	private async getActiveAccountLink() {
		const accountLinks = this.page.locator('a[href*="/my-account"]')
		const accountLinkCount = await accountLinks.count()

		for (let index = 0; index < accountLinkCount; index += 1) {
			const accountLink = accountLinks.nth(index)

			if (await this.elementIntersectsViewport(accountLink)) {
				return accountLink
			}
		}

		return null
	}

	private async dismissBlockingStorefrontOverlay() {
		await this.page.waitForLoadState('domcontentloaded').catch(() => {})
		await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

		const activeCartDrawer = await this.getActiveCartDrawer()

		if (activeCartDrawer) {
			const drawerCloseButton = activeCartDrawer
				.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
				.first()

			if ((await drawerCloseButton.count()) > 0) {
				await drawerCloseButton.evaluate((element: HTMLElement) => element.click())
				await this.waitForCartDrawerState(false)
			}

			if ((await this.cartDrawerIsOpen()) && (await this.clickActiveCartToggle())) {
				await this.waitForCartDrawerState(false)
			}

			if (await this.cartDrawerIsOpen()) {
				throw new Error(
					`Unable to close the Live non-production cart drawer before account navigation. Current URL: ${this.page.url()}`,
				)
			}
		}

		const visibleScrim = await this.getBlockingScrim()

		if (visibleScrim) {
			await visibleScrim.evaluate((element: HTMLElement) => element.click())
			await this.page.waitForTimeout(500)
		}

		if (await this.getBlockingScrim()) {
			await this.page.keyboard.press('Escape')
			await this.page.waitForTimeout(500)
		}

		if (await this.getBlockingScrim()) {
			throw new Error(
				`A storefront scrim is still blocking Live non-production account navigation. Current URL: ${this.page.url()}`,
			)
		}
	}

	async goToAccountPage() {
		await this.dismissBlockingStorefrontOverlay()

		if (!(await this.signOutLink.isVisible().catch(() => false))) {
			const accountLink = await this.getActiveAccountLink()

			if (!accountLink) {
				throw new Error(
					`No active account link was available for Live non-production account navigation. Current URL: ${this.page.url()}`,
				)
			}

			const accountHref = await accountLink.getAttribute('href')
			await accountLink.evaluate((element: HTMLAnchorElement) => element.click())

			const navigationDeadline = Date.now() + 10000
			let accountPageAppeared = false

			while (Date.now() < navigationDeadline) {
				accountPageAppeared =
					(await this.signOutLink.isVisible().catch(() => false)) ||
					/\/my-account(?:\/|$|\?)/.test(this.page.url())

				if (accountPageAppeared) {
					break
				}

				await this.page.waitForTimeout(100)
			}

			if (!accountPageAppeared && accountHref) {
				await this.page.goto(new URL(accountHref, this.page.url()).toString())
			}
		}

		await this.page.waitForLoadState('domcontentloaded').catch(() => {})
		await expect(this.pageTitleSelector).toBeVisible()
		await expect(this.accountButtonNav).toBeVisible()
		await expect(this.signOutLink).toBeVisible()
	}

	override async logOut(page: Page) {
		await test.step('Log out User', async () => {
			await this.goToAccountPage()
			await this.refreshLogoutLink()

			const expectedOrigin = new URL(page.url()).origin

			await Promise.all([
				page.waitForURL(
					url =>
						this.isSignedOutDestination(url, expectedOrigin) ||
						this.isWordPressLogoutConfirmation(url),
					{ waitUntil: 'domcontentloaded', timeout: 30000 },
				),
				this.signOutLink.click(),
			])

			if (this.isWordPressLogoutConfirmation(new URL(page.url()))) {
				const confirmLogoutLink = page.getByRole('link', { name: /log out/i }).first()

				await expect(confirmLogoutLink).toBeVisible()
				await Promise.all([
					page.waitForURL(
						url =>
							url.origin === expectedOrigin &&
							!this.isWordPressLogoutConfirmation(url),
						{ waitUntil: 'domcontentloaded', timeout: 30000 },
					),
					confirmLogoutLink.click(),
				])

				if (!this.isSignedOutDestination(new URL(page.url()), expectedOrigin)) {
					await page.goto(new URL('/shop/', expectedOrigin).toString(), {
						waitUntil: 'domcontentloaded',
					})
				}
			}

			await this.verifySignedOut(page, expectedOrigin)
		})
	}

	private async getActiveDrawerContaining(content: Locator) {
		const matchingDrawers = this.page.locator('.wpse-drawer').filter({ has: content })
		const matchingDrawerCount = await matchingDrawers.count()

		for (let index = 0; index < matchingDrawerCount; index += 1) {
			const matchingDrawer = matchingDrawers.nth(index)

			if (await this.elementIntersectsViewport(matchingDrawer)) {
				return matchingDrawer
			}
		}

		return matchingDrawerCount > 0 ? matchingDrawers.first() : null
	}

	private async editPersonalInfoOnce(userType: string) {
		await expect(this.personalInfoHeader).toBeVisible()
		await expect(this.editPersonalInfoLink).toBeVisible()
		await this.editPersonalInfoLink.evaluate((element: HTMLElement) => element.click())

		if (!(await this.personalInfoDrawerHeader.isVisible().catch(() => false))) {
			await this.editPersonalInfoLink.evaluate((element: HTMLElement) => element.click())
		}

		await expect(this.personalInfoDrawerHeader).toBeVisible()
		const personalInfoDrawer = await this.getActiveDrawerContaining(this.personalInfoDrawerHeader)

		if (!personalInfoDrawer) {
			throw new Error('The Live personal-information drawer did not become available.')
		}

		const firstNameInput = personalInfoDrawer.locator('input#fasd_fname')
		const lastNameInput = personalInfoDrawer.locator('input#fasd_lname')
		const emailInput = personalInfoDrawer.locator('input#fasd_email')
		const phoneInput = personalInfoDrawer.locator('input#fasd_phone')
		const birthdayInput = personalInfoDrawer.locator('input#fasd_dob').first()
		const updateButton = personalInfoDrawer
			.locator('a.wpse-button-primary.fasd-form-submit')
			.first()
		await expect(firstNameInput).toBeVisible()

		const currentFirstName = await firstNameInput.inputValue()
		const currentLastName = await lastNameInput.inputValue()
		const newFirstName = `Edited ${currentFirstName}`
		const newLastName = `Edited ${currentLastName}`
		const now = new Date()
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
			2,
			'0',
		)}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(
			2,
			'0',
		)}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(
			2,
			'0',
		)}-${String(now.getMilliseconds()).padStart(3, '0')}`
		const newEmail = `edited_user_${userType}_${timestamp}@test.com`
		const newPhone = `555-${Math.floor(1000000 + Math.random() * 9000000)}`

		await firstNameInput.fill(newFirstName)
		await lastNameInput.fill(newLastName)
		await emailInput.fill(newEmail)
		await phoneInput.fill(newPhone)
		await birthdayInput.fill('1985-01-02')
		await expect(updateButton).toBeVisible()
		await updateButton.evaluate((element: HTMLElement) => element.click())

		const saveTransitionSettled = await expect
			.poll(
				async () =>
					!(await this.elementIntersectsViewport(personalInfoDrawer)) ||
					((await this.displayedUserFirstName.textContent().catch(() => '')) || '').trim() ===
						newFirstName,
				{ timeout: 20000 },
			)
			.toBeTruthy()
			.then(() => true)
			.catch(() => false)

		await this.page.reload({ waitUntil: 'domcontentloaded' })
		await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
		await expect(this.personalInfoHeader).toBeVisible()

		const displayedFirstName = (
			(await this.displayedUserFirstName.textContent().catch(() => '')) || ''
		).trim()
		const displayedLastName = (
			(await this.displayedUserLastName.textContent().catch(() => '')) || ''
		).trim()
		const displayedEmail = (
			(await this.displayedUserEmail.textContent().catch(() => '')) || ''
		).trim()
		const displayedDob = (
			(await this.displayedUserDOB.textContent().catch(() => '')) || ''
		).trim()
		const displayedPhone = await this.normalizePhoneNumber(
			(await this.displayedUserPhone.textContent().catch(() => '')) || '',
		)
		const expectedPhone = await this.normalizePhoneNumber(newPhone)
		const persisted =
			displayedFirstName === newFirstName &&
			displayedLastName === newLastName &&
			displayedEmail === newEmail &&
			displayedDob === '01/02/1985' &&
			displayedPhone === expectedPhone

		if (!persisted) {
			throw new Error(
				[
					'Live personal information did not persist after save.',
					`Save transition settled: ${saveTransitionSettled}.`,
					`Expected first name: ${newFirstName}; received: ${displayedFirstName || 'empty'}.`,
					`Expected last name: ${newLastName}; received: ${displayedLastName || 'empty'}.`,
					`Expected email: ${newEmail}; received: ${displayedEmail || 'empty'}.`,
					`Expected DOB: 01/02/1985; received: ${displayedDob || 'empty'}.`,
					`Expected phone: ${expectedPhone}; received: ${displayedPhone || 'empty'}.`,
					`Current URL: ${this.page.url()}`,
				].join('\n'),
			)
		}

		return newEmail
	}

	override async editPersonalInfo(userType: string) {
		let persistenceRetries = 0

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			try {
				return await this.editPersonalInfoOnce(userType)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				const isPersistenceError = /Live personal information did not persist after save/i.test(
					message,
				)
				const isTransientDomError =
					/not attached to the DOM|element is detached|cannot find context with specified id|execution context was destroyed/i.test(
						message,
					)

				if (isPersistenceError && persistenceRetries < 1) {
					persistenceRetries += 1
				} else if (!isTransientDomError || attempt === 3) {
					throw error
				}

				await this.page.reload({ waitUntil: 'domcontentloaded' })
				await expect(this.personalInfoHeader).toBeVisible()
			}
		}

		throw new Error('Unable to open Live personal information after three attempts.')
	}

	override async editPhotoId() {
		await expect(this.photoIdSection).toBeVisible()
		await expect(this.editPhotoIdLink).toBeVisible()
		await this.editPhotoIdLink.evaluate((element: HTMLElement) => element.click())
		await expect(this.photoDrawerHeader).toBeVisible()
		await this.uploadIDInput.setInputFiles('CA-DL.jpg')

		const expirationYear = new Date().getFullYear() + 1
		await this.expirationInput.fill(`${expirationYear}-04-10`)
		await expect(this.photoIDSaveAndContinueButton).toBeVisible()
		await this.photoIDSaveAndContinueButton.evaluate((element: HTMLElement) => element.click())
		await expect(this.dispalyedPhotoIDExp).toHaveText(`Exp: 04/10/${expirationYear}`)
	}

	override async editMedicalCard() {
		await expect(this.medicalCardSection).toBeVisible()
		await expect(this.editMedicalCardLink).toBeVisible()
		await this.editMedicalCardLink.evaluate((element: HTMLElement) => element.click())
		await expect(this.medDrawerHeader).toBeVisible()
		await this.medCardInput.setInputFiles('Medical-Card.png')
		await this.medStateDropDown.selectOption('CA')

		const expirationYear = new Date().getFullYear() + 1
		await this.medExpDateInput.fill(`${expirationYear}-04-10`)
		await this.page
			.locator('input#medcard_no')
			.fill(`${Math.floor(10000000 + Math.random() * 90000000)}`)
		await expect(this.medSaveAndContinueButton).toBeVisible()
		await this.medSaveAndContinueButton.evaluate((element: HTMLElement) => element.click())
		await expect(this.dispalyedMedIDExp).toHaveText(`Exp: 04/10/${expirationYear}`)
	}

	override async editPassword(currentPassword: string, newPassword: string) {
		await expect(this.passwordSection).toBeVisible()
		await expect(this.editPasswordLink).toBeVisible()
		await this.editPasswordLink.evaluate((element: HTMLElement) => element.click())
		await expect(this.passwordDrawerHeader).toBeVisible()
		await this.currentPasswordInput.fill(currentPassword)
		await this.newPasswordInput.fill(newPassword)
		await expect(this.changePasswordButton).toBeVisible()
		await this.changePasswordButton.evaluate((element: HTMLElement) => element.click())
		await this.page.waitForTimeout(1000)
		await this.refreshLogoutLink()
	}
}
