import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.APP_AWS_REGION ?? "us-east-1";
const ACCESS_KEY_ID = process.env.APP_AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.APP_AWS_SECRET_ACCESS_KEY;

const client = new DynamoDBClient({
  region: REGION,
  credentials:
    ACCESS_KEY_ID && SECRET_ACCESS_KEY
      ? {
          accessKeyId: ACCESS_KEY_ID,
          secretAccessKey: SECRET_ACCESS_KEY,
        }
      : undefined,
});

export const ddb = DynamoDBDocumentClient.from(client);
export const TABLE_NAME = process.env.APP_SUBSCRIPTIONS_TABLE ?? "Subscriptions";
