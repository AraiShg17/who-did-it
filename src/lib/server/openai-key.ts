import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const DEFAULT_SECRET_NAME = "OPENAI_API_KEY";

let cachedKey: string | null = null;

const readFromSecretManager = async (): Promise<string | null> => {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required");
  }
  const secretName = process.env.OPENAI_API_KEY_SECRET_NAME || DEFAULT_SECRET_NAME;
  const version = process.env.OPENAI_API_KEY_SECRET_VERSION || "latest";

  const client = new SecretManagerServiceClient();
  const name = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
  const [accessResponse] = await client.accessSecretVersion({ name });
  const key = accessResponse.payload?.data?.toString();

  if (!key) {
    return null;
  }

  return key;
};

export const getOpenAiApiKey = async (): Promise<string | null> => {
  if (cachedKey) {
    return cachedKey;
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      cachedKey = envKey;
      return cachedKey;
    }
  }

  try {
    const secretKey = await readFromSecretManager();
    if (secretKey) {
      cachedKey = secretKey;
      return cachedKey;
    }
  } catch (error) {
    if (isProduction) {
      throw error;
    }
  }

  return null;
};
