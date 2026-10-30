import { test, expect } from '@playwright/test';

test.describe('Game catalog filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('filters by multiple categories with keyboard controls', async ({ page }) => {
    const categoryCheckboxes = page.getByRole('checkbox');
    const categoryCount = await categoryCheckboxes.count();
    expect(categoryCount).toBeGreaterThan(1);

    const selectedCheckboxes = [categoryCheckboxes.nth(0), categoryCheckboxes.nth(1)];
    const selectedCategoryIds = await Promise.all(
      selectedCheckboxes.map((checkbox) => checkbox.getAttribute('value')),
    );
    const categoryIds = selectedCategoryIds.filter((id): id is string => id !== null);
    const cards = page.getByTestId('game-card');
    const gameCategoryIds = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-game-category-id')),
    );
    const expectedVisibleCount = gameCategoryIds.filter(
      (id): id is string => id !== null && categoryIds.includes(id),
    ).length;

    await test.step('Select two categories by keyboard', async () => {
      for (const checkbox of selectedCheckboxes) {
        await checkbox.focus();
        await page.keyboard.press('Space');
      }
    });

    await test.step('Show games from either selected category', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedVisibleCount);
      await expect(page.getByTestId('filter-results-count')).toHaveText(
        `Showing ${expectedVisibleCount} of ${gameCategoryIds.length} games`,
      );
    });
  });

  test('filters by publisher', async ({ page }) => {
    const cards = page.getByTestId('game-card');
    const firstCard = cards.first();
    const publisherId = await firstCard.getAttribute('data-game-publisher-id');
    const publisherName = await firstCard.getByTestId('game-publisher').innerText();
    const publisherIds = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-game-publisher-id')),
    );
    const expectedVisibleCount = publisherIds.filter((id) => id === publisherId).length;

    await page.getByLabel('Publisher').selectOption({ label: publisherName });

    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedVisibleCount);
    await expect(page.getByTestId('filter-results-count')).toHaveText(
      `Showing ${expectedVisibleCount} of ${publisherIds.length} games`,
    );
  });

  test('combines category and publisher filters', async ({ page }) => {
    const cards = page.getByTestId('game-card');
    const firstCard = cards.first();
    const categoryName = await firstCard.getByTestId('game-category').innerText();
    const publisherName = await firstCard.getByTestId('game-publisher').innerText();
    const categoryId = await firstCard.getAttribute('data-game-category-id');
    const publisherId = await firstCard.getAttribute('data-game-publisher-id');
    const gameMetadata = await cards.evaluateAll((elements) =>
      elements.map((element) => ({
        categoryId: element.getAttribute('data-game-category-id'),
        publisherId: element.getAttribute('data-game-publisher-id'),
      })),
    );
    const expectedVisibleCount = gameMetadata.filter(
      (game) => game.categoryId === categoryId && game.publisherId === publisherId,
    ).length;

    await page.getByRole('checkbox', { name: categoryName, exact: true }).check();
    await page.getByLabel('Publisher').selectOption({ label: publisherName });

    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedVisibleCount);
    await expect(page.getByTestId('filter-results-count')).toHaveText(
      `Showing ${expectedVisibleCount} of ${gameMetadata.length} games`,
    );
  });

  test('clears selected filters and restores all games', async ({ page }) => {
    const cards = page.getByTestId('game-card');
    const firstCard = cards.first();
    const categoryName = await firstCard.getByTestId('game-category').innerText();
    const publisherName = await firstCard.getByTestId('game-publisher').innerText();
    const cardCount = await cards.count();
    const categoryCheckbox = page.getByRole('checkbox', { name: categoryName, exact: true });
    const publisherSelect = page.getByLabel('Publisher');
    const clearButton = page.getByRole('button', { name: 'Clear filters' });

    await categoryCheckbox.check();
    await publisherSelect.selectOption({ label: publisherName });
    await clearButton.click();

    await expect(categoryCheckbox).not.toBeChecked();
    await expect(publisherSelect).toHaveValue('');
    await expect(clearButton).toBeDisabled();
    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(cardCount);
    await expect(page.getByTestId('filter-results-count')).toHaveText(
      `Showing ${cardCount} of ${cardCount} games`,
    );
  });
});
