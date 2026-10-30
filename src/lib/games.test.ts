import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<{
    strategyId: number;
    partyId: number;
    pubOneId: number;
    pubTwoId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [party] = await db
        .insert(categories)
        .values({ name: 'Party', description: 'Party games' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'First publisher' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'Second publisher' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'Strategy by Pub One',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Bravo Party',
            description: 'Party by Pub Two',
            starRating: 4.2,
            categoryId: party.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Charlie Strategy',
            description: 'Strategy by Pub Two',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        partyId: party.id,
        pubOneId: pubOne.id,
        pubTwoId: pubTwo.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters by any selected category and keeps title ordering', async () => {
        const { strategyId, partyId } = await seedFilterGames(db);

        const filtered = await getGamesByFilters(db, { categoryIds: [partyId, strategyId] });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Party',
            'Charlie Strategy',
        ]);
    });

    it('filters by publisher', async () => {
        const { pubTwoId } = await seedFilterGames(db);

        const filtered = await getGamesByFilters(db, { publisherId: pubTwoId });

        expect(filtered.map((game) => game.title)).toEqual(['Bravo Party', 'Charlie Strategy']);
    });

    it('combines category and publisher filters', async () => {
        const { strategyId, pubTwoId } = await seedFilterGames(db);

        const filtered = await getGamesByFilters(db, {
            categoryIds: [strategyId],
            publisherId: pubTwoId,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Charlie Strategy']);
    });

    it('returns all games when no filters are selected', async () => {
        await seedFilterGames(db);

        const filtered = await getGamesByFilters(db, {});

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Party',
            'Charlie Strategy',
        ]);
    });
});
