import path from "node:path";

export function loadConfig(env = process.env) {
  return {
    awsRegion: env.AWS_REGION ?? "ap-southeast-1",
    lambdaFunctionName: env.EPHEMEROS_LAMBDA_FUNCTION ?? "EphemeralTunnelConnector",
    port: Number.parseInt(env.EPHEMEROS_PORT ?? "3000", 10),
    host: env.EPHEMEROS_HOST ?? "127.0.0.1",
    authToken: env.EPHEMEROS_AUTH_TOKEN,
    requireAuth: env.EPHEMEROS_ALLOW_UNAUTHENTICATED !== "true",
    contextDir: path.resolve(env.EPHEMEROS_CONTEXT_DIR ?? ".bob_restricted_context"),
    maxContextBytes: Number.parseInt(env.EPHEMEROS_MAX_CONTEXT_BYTES ?? "262144", 10)
  };
}
