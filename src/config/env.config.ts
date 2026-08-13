export interface EnvironmentVariables {
  port: number;
  nodeEnv: string;
  storageDriver: 'local' | 's3';
  localStorageDir: string;
  maxDesignZipSize: number;
  maxZipEntries: number;
  maxZipUncompressedSize: number;
  maxSingleExtractedFileSize: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    schema: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
}

export default (): EnvironmentVariables => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  storageDriver: (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
  localStorageDir:
    process.env.FILE_STORAGE_PATH ??
    process.env.LOCAL_STORAGE_DIR ??
    './storage',
  maxDesignZipSize: parseInt(process.env.MAX_DESIGN_ZIP_SIZE ?? '52428800', 10), // 50 MB
  maxZipEntries: parseInt(process.env.MAX_ZIP_ENTRIES ?? '500', 10),
  maxZipUncompressedSize: parseInt(
    process.env.MAX_ZIP_UNCOMPRESSED_SIZE ?? '209715200',
    10,
  ), // 200 MB
  maxSingleExtractedFileSize: parseInt(
    process.env.MAX_SINGLE_EXTRACTED_FILE_SIZE ?? '52428800',
    10,
  ), // 50 MB
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '1q2w3e4r5t',
    name: process.env.DB_NAME ?? 'website_of_websites',
    schema: process.env.DB_SCHEMA ?? 'public',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'super-secret-jwt-key-for-dev',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
  },
});
