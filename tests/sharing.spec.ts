/**
 * The property ezshare exists for: a shared folder's files reach its members
 * and nobody else.
 *
 *   owner    creates a folder, uploads a file, copies an editor invite link
 *   stranger knows the folder URL and the file's download URL, and gets nothing
 *   member   opens the invite link, then sees the file live and downloads it
 *
 * Downloads are fetched from inside the page so the browser sends the session
 * cookie with `Sec-Fetch-Site: same-origin`, exactly like a real click.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

const usable = loadAllTestAccounts().length
test.skip(usable < 3, `Needs 3 usable test accounts, found ${usable}. See tests/collab.spec.ts for how to create them.`)

const FILE_TEXT = `ezshare sharing test ${Date.now()}`

async function fetchStatus(page: Page, url: string): Promise<{ status: number; body: string }> {
  return page.evaluate(async (u) => {
    const res = await fetch(u)
    return { status: res.status, body: await res.text() }
  }, url)
}

test('only folder members can see and download a shared file', async ({ users }) => {
  test.setTimeout(120_000)
  const [owner, stranger, member] = await users(3)
  await owner.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  // Owner: create a shared folder and upload a file.
  await owner.page.goto('/drive')
  await owner.page.getByRole('button', { name: 'New shared folder' }).click()
  await owner.page.getByLabel('Folder name').fill('Sharing test')
  await owner.page.getByRole('button', { name: 'Create' }).click()
  await expect(owner.page.getByTestId('folder-title')).toHaveText('Sharing test', { timeout: 20_000 })
  const folderUrl = owner.page.url()

  await owner.page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(FILE_TEXT),
  })
  const download = owner.page.getByRole('link', { name: 'Download notes.txt' })
  await expect(download).toBeVisible({ timeout: 30_000 })
  const downloadPath = (await download.getAttribute('href'))!
  expect(await fetchStatus(owner.page, downloadPath)).toEqual({ status: 200, body: FILE_TEXT })

  // Owner: copy the editor invite link. Wide screens show the People panel
  // beside the files; narrower ones put it behind a tab.
  const peopleTab = owner.page.getByRole('tab', { name: /People/ })
  if (await peopleTab.isVisible()) await peopleTab.click()
  await owner.page.getByRole('button', { name: 'Editor link' }).click()
  await expect(owner.page.getByText('Editor link copied')).toBeVisible()
  const invite = await owner.page.evaluate(() => navigator.clipboard.readText())
  expect(invite).toMatch(/\/join\/[a-f0-9]{64}$/)

  // Stranger: knows both URLs, gets neither the folder nor the bytes.
  await stranger.page.goto(folderUrl)
  await expect(stranger.page.getByText('Folder not found')).toBeVisible({ timeout: 20_000 })
  const denied = await fetchStatus(stranger.page, downloadPath)
  expect(denied.status).toBe(404)
  expect(denied.body).not.toContain(FILE_TEXT)

  // Member: joins with the link, then sees the file and can download it.
  await member.page.goto(new URL(invite).pathname)
  await expect(member.page.getByTestId('folder-title')).toHaveText('Sharing test', { timeout: 20_000 })
  await expect(member.page.getByRole('link', { name: 'Download notes.txt' })).toBeVisible({ timeout: 20_000 })
  expect(await fetchStatus(member.page, downloadPath)).toEqual({ status: 200, body: FILE_TEXT })

  // Live sync: a second upload by the member appears for the owner without a reload.
  await member.page.getByTestId('file-input').setInputFiles({
    name: 'from-member.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(`member upload ${Date.now()}`),
  })
  await expect(owner.page.getByRole('link', { name: 'Download from-member.txt' })).toBeVisible({ timeout: 30_000 })

  // Clean up so repeated runs don't fill the app's storage.
  await owner.page.getByRole('button', { name: 'Delete folder' }).click()
  await owner.page.getByRole('button', { name: 'Delete folder' }).last().click()
  await expect(owner.page).toHaveURL(/\/f\/me-/, { timeout: 20_000 })
  expect((await fetchStatus(owner.page, downloadPath)).status).toBe(404)
})

// Regression: Google/GitHub sign-in returns to the app, not to the invite page,
// so an invite opened while signed out must survive signing in somewhere else.
test('an invite opened while signed out still joins after signing in', async ({ users, page }) => {
  test.setTimeout(120_000)
  const [owner] = await users(1)
  const joiner = loadAllTestAccounts().find((a) => a.email !== owner.email)!
  await owner.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  await owner.page.goto('/drive')
  await owner.page.getByRole('button', { name: 'New shared folder' }).click()
  await owner.page.getByLabel('Folder name').fill('Signed-out invite test')
  await owner.page.getByRole('button', { name: 'Create' }).click()
  await expect(owner.page.getByTestId('folder-title')).toHaveText('Signed-out invite test', { timeout: 20_000 })
  const peopleTab = owner.page.getByRole('tab', { name: /People/ })
  if (await peopleTab.isVisible()) await peopleTab.click()
  await owner.page.getByRole('button', { name: 'Viewer link' }).click()
  await expect(owner.page.getByText('Viewer link copied')).toBeVisible()
  const invite = await owner.page.evaluate(() => navigator.clipboard.readText())

  // Signed out: the invite page explains itself and asks to sign in.
  await page.goto(new URL(invite).pathname)
  await page.getByRole('button', { name: 'Sign in to join' }).click()

  // Sign in from a different page, the way an OAuth round trip lands.
  await page.goto('/drive')
  await page.getByTestId('nav-sign-in-button').click()
  await page.getByRole('button', { name: 'Sign in with email' }).click()
  await page.getByPlaceholder('Email').fill(joiner.email)
  await page.getByPlaceholder('Password').fill(joiner.password)
  await page.locator('form').filter({ has: page.getByPlaceholder('Password') }).getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByTestId('folder-title')).toHaveText('Signed-out invite test', { timeout: 30_000 })
  await expect(page.getByText('You can view and download files here.')).toBeVisible()

  await owner.page.getByRole('button', { name: 'Delete folder' }).click()
  await owner.page.getByRole('button', { name: 'Delete folder' }).last().click()
  await expect(owner.page).toHaveURL(/\/f\/me-/, { timeout: 20_000 })
})
