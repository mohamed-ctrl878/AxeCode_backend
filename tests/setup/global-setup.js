import { PostgreSqlContainer } from '@testcontainers/postgresql';

let postgresContainer;

export async function setup() {
  console.log('\n[Vitest Global Setup] Starting TestContainer PostgreSQL...');
  
  // Start a dynamic PostgreSQL container
  postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('strapi_test')
    .withUsername('test_admin')
    .withPassword('test_password')
    .start();

  const databaseUrl = postgresContainer.getConnectionUri();
  
  // Inject into process.env so Vitest workers and Strapi can read it
  process.env.TEST_DATABASE_URL = databaseUrl;
  console.log(`[Vitest Global Setup] PostgreSQL running at: ${databaseUrl}`);
}

export async function teardown() {
  if (postgresContainer) {
    console.log('\n[Vitest Global Teardown] Stopping TestContainer PostgreSQL...');
    await postgresContainer.stop();
  }
}
