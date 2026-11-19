/**
 * "Ask this folder" end to end: upload a document containing a made-up fact,
 * wait for indexing, ask about it, and expect a cited answer.
 *
 * It spends the app owner's DeepSpace credits (indexing + search + Claude),
 * so it only runs when RUN_AI_TESTS=1.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(process.env.RUN_AI_TESTS !== '1', 'Set RUN_AI_TESTS=1 to run the paid AI test')
test.skip(loadAllTestAccounts().length < 1, 'Needs 1 test account')

test('ask this folder answers from the folder’s files with a citation', async ({ users }) => {
  test.setTimeout(300_000)
  const [user] = await users(1)
  const code = `HARBOR-${Math.floor(Math.random() * 90000 + 10000)}`

  await user.page.goto('/drive')
  await user.page.getByRole('button', { name: 'New shared folder' }).click()
  await user.page.getByLabel('Folder name').fill('AI test')
  await user.page.getByRole('button', { name: 'Create' }).click()
  await expect(user.page.getByTestId('folder-title')).toHaveText('AI test', { timeout: 20_000 })

  await user.page.getByTestId('file-input').setInputFiles({
    name: 'trip-plan.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      `# Team offsite plan\n\nThe offsite is in Lisbon. The door code for the rented house is ${code}.\n` +
        'Check-in is after 3pm on Friday. Bring a laptop charger.\n',
    ),
  })
  await expect(user.page.getByRole('link', { name: 'Download trip-plan.md' })).toBeVisible({ timeout: 30_000 })
  // The AskPanel polls refreshIndex while files are indexing; wait for the badge.
  await expect(user.page.getByText('AI ready')).toBeVisible({ timeout: 240_000 })

  await user.page.getByLabel('Question about this folder').fill('What is the door code for the house?')
  await user.page.getByRole('button', { name: 'Ask' }).click()
  const answer = user.page.getByTestId('ask-answer')
  await expect(answer).toContainText(code, { timeout: 60_000 })
  await expect(answer.getByRole('link', { name: 'trip-plan.md' })).toBeVisible()

  await user.page.getByRole('button', { name: 'Delete folder' }).click()
  await user.page.getByRole('button', { name: 'Delete folder' }).last().click()
  await expect(user.page).toHaveURL(/\/f\/me-/, { timeout: 20_000 })
})

test('ask this folder reads PDFs', async ({ users }) => {
  test.setTimeout(300_000)
  const [user] = await users(1)

  await user.page.goto('/drive')
  await user.page.getByRole('button', { name: 'New shared folder' }).click()
  await user.page.getByLabel('Folder name').fill('PDF test')
  await user.page.getByRole('button', { name: 'Create' }).click()
  await expect(user.page.getByTestId('folder-title')).toHaveText('PDF test', { timeout: 20_000 })

  // tests/fixtures/budget-memo.pdf: a one-page text PDF stating the Q3 budget.
  await user.page.getByTestId('file-input').setInputFiles('tests/fixtures/budget-memo.pdf')
  await expect(user.page.getByText('AI ready')).toBeVisible({ timeout: 240_000 })

  await user.page.getByLabel('Question about this folder').fill('What is the approved Q3 marketing budget?')
  await user.page.getByRole('button', { name: 'Ask' }).click()
  const answer = user.page.getByTestId('ask-answer')
  await expect(answer).toContainText(/48,?250/, { timeout: 60_000 })
  await expect(answer.getByRole('link', { name: 'budget-memo.pdf' })).toBeVisible()

  await user.page.getByRole('button', { name: 'Delete folder' }).click()
  await user.page.getByRole('button', { name: 'Delete folder' }).last().click()
  await expect(user.page).toHaveURL(/\/f\/me-/, { timeout: 20_000 })
})
