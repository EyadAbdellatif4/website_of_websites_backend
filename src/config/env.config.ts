export interface EnvironmentVariables {
  port: number;
  nodeEnv: string;
  storageDriver: 'local' | 's3';
  localStorageDir: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    schema: string;
  };
}

export default (): EnvironmentVariables => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  storageDriver: (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
  localStorageDir: process.env.LOCAL_STORAGE_DIR ?? './uploads',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '1q2w3e4r5t',
    name: process.env.DB_NAME ?? 'website_of_websites',
    schema: process.env.DB_SCHEMA ?? 'public',
  },
});
