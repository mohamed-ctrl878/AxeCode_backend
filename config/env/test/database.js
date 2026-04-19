module.exports = ({ env }) => {
  // If we are given a TEST_DATABASE_URL by Vitest Testcontainers global setup, use it!
  const connectionString = env('TEST_DATABASE_URL');
  
  if (connectionString) {
    return {
      connection: {
        client: 'postgres',
        connection: {
          connectionString,
        },
        pool: {
           min: 0,
           max: 5,
           acquireTimeoutMillis: 30000,
           createTimeoutMillis: 30000,
           idleTimeoutMillis: 10000
        },
      },
    };
  }

  // Fallback to in-memory sqlite if no testcontainer is spun up
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: '.tmp/test-fallback.db',
      },
      useNullAsDefault: true,
    },
  };
};
