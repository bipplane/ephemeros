import fs from "node:fs/promises";

const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";
const WATSONX_GENERATION_URL =
  "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
const WATSONX_MODEL_ID = "ibm/granite-3-8b-instruct";

export async function readSecureEnclaveText(filePath) {
  return fs.readFile(filePath, "utf8");
}

export function localSchemaFilter(text, resourceId) {
  const normalized = resourceId.toLowerCase();
  if (!normalized.includes("bond_yields")) {
    throw new Error(`Local filter has no extraction rule for ${resourceId}`);
  }

  const tableMatch = text.match(/```sql\s+CREATE TABLE internal_quant\.bond_yields[\s\S]*?```/i);
  const accessRuleMatch = text.match(/Access rule:.*$/im);
  if (!tableMatch) {
    throw new Error("Bond yields schema not found in secure enclave text");
  }

  return [tableMatch[0], accessRuleMatch?.[0]].filter(Boolean).join("\n\n");
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms);
}

async function getIamToken({ apiKey, fetchImpl = fetch, timeoutMs = 30000 }) {
  const body = new URLSearchParams({
    grant_type: "urn:ibm:params:oauth:grant-type:apikey",
    apikey: apiKey
  });
  const response = await fetchImpl(IAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body,
    signal: timeoutSignal(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`IBM Cloud IAM token request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("IBM Cloud IAM token response missing access_token");
  }
  return payload.access_token;
}

export async function filterWithWatsonx({ text, resourceId, apiKey, projectId, fetchImpl = fetch, timeoutMs = 45000 }) {
  if (!apiKey) {
    throw new Error("IBM_API_KEY is required when EPHEMEROS_FILTER_PROVIDER=watsonx");
  }
  if (!projectId) {
    throw new Error("WATSONX_PROJECT_ID is required when EPHEMEROS_FILTER_PROVIDER=watsonx");
  }

  const token = await getIamToken({ apiKey, fetchImpl, timeoutMs });
  const prompt = [
    "Extract only the original schema definitions relevant to bond yields from this text.",
    "Return exactly the original CREATE TABLE block for internal_quant.bond_yields and the original access rule.",
    "Do not create examples. Do not add query samples. Do not infer missing fields.",
    "Remove synthetic personal-data-looking fields, unrelated tables, secrets, credentials, and boilerplate.",
    "",
    `Requested resource: ${resourceId}`,
    "",
    text
  ].join("\n");

  const response = await fetchImpl(WATSONX_GENERATION_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      model_id: WATSONX_MODEL_ID,
      project_id: projectId,
      input: prompt,
      parameters: {
        decoding_method: "greedy",
        max_new_tokens: 700,
        min_new_tokens: 1,
        temperature: 0
      }
    }),
    signal: timeoutSignal(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`watsonx.ai text generation request failed: ${response.status}`);
  }

  const payload = await response.json();
  const generatedText = payload.results?.[0]?.generated_text;
  if (!generatedText) {
    throw new Error("watsonx.ai response missing results[0].generated_text");
  }
  return generatedText.trim();
}

export async function filterSecureEnclaveContext({ text, resourceId, env = process.env, fetchImpl = fetch }) {
  if (env.EPHEMEROS_FILTER_PROVIDER === "watsonx") {
    const watsonxOutput = await filterWithWatsonx({
      text,
      resourceId,
      apiKey: env.IBM_API_KEY,
      projectId: env.WATSONX_PROJECT_ID,
      fetchImpl
    });
    try {
      return localSchemaFilter(watsonxOutput, resourceId);
    } catch {
      return localSchemaFilter(text, resourceId);
    }
  }

  return localSchemaFilter(text, resourceId);
}
