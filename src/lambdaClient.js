import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

export function createAwsLambdaInvoker({ region, functionName }) {
  const client = new LambdaClient({ region });
  return async function invoke(payload) {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(payload))
    });

    const response = await client.send(command);
    const rawPayload = Buffer.from(response.Payload ?? []).toString("utf8");
    const parsed = rawPayload ? JSON.parse(rawPayload) : {};

    if (response.FunctionError) {
      throw new Error(`Lambda error: ${response.FunctionError}`);
    }

    if (parsed.statusCode && parsed.statusCode >= 400) {
      throw new Error(`Lambda rejected request: ${parsed.body ?? parsed.statusCode}`);
    }

    return parsed.body && typeof parsed.body === "string" ? JSON.parse(parsed.body) : parsed;
  };
}
