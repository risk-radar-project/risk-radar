import { database } from "./database";
import { initialMigration, Migration } from "./migrations/001_initial";
import { logger } from "../utils/logger";

const migrations: Migration[] = [initialMigration];

async function ensureMigrationsTable(): Promise<void> {
    await database.query(`
        CREATE TABLE IF NOT EXISTS notification_service_migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

export async function runMigrations(): Promise<void> {
    await database.waitForConnection();
    await ensureMigrationsTable();

    const applied = await database.query<{ id: string }>(
        "SELECT id FROM notification_service_migrations"
    );
    const appliedSet = new Set(applied.rows.map((row: { id: string }) => row.id));

    for (const migration of migrations) {
        if (appliedSet.has(migration.id)) {
            logger.debug(`Migration ${migration.id} already applied`);
            continue;
        }

        logger.info(`Applying migration ${migration.id} - ${migration.name}`);
        const client = await database.getClient();
        try {
            await client.query("BEGIN");
            await client.query(migration.up);
            await client.query(
                "INSERT INTO notification_service_migrations (id, name) VALUES ($1, $2)",
                [migration.id, migration.name]
            );
            await client.query("COMMIT");
            logger.info(`Migration ${migration.id} applied successfully`);
        } catch (error) {
            await client.query("ROLLBACK");
            logger.error(`Migration ${migration.id} failed`, { error });
            throw error;
        } finally {
            client.release();
        }
    }
}

if (require.main === module) {
    runMigrations()
        .then(() => {
            logger.info("All migrations completed");
            process.exit(0);
        })
        .catch((error) => {
            logger.error("Migration process failed", { error });
            process.exit(1);
        });
}
