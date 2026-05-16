import { loadDotEnv } from "./envFile.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createAwsLambdaInvoker } from "./lambdaClient.js";
import { invokeMockRestrictedContext } from "./mockRestrictedContext.js";

loadDotEnv();

const config = loadConfig();
const invokeLambda =
  process.env.EPHEMEROS_MOCK_CONTEXT === "true"
    ? invokeMockRestrictedContext
    : createAwsLambdaInvoker({
        region: config.awsRegion,
        functionName: config.lambdaFunctionName
      });
const app = createApp({ config, invokeLambda });

app.listen(config.port, config.host, () => {
  console.log(`Ephemeros listening on http://${config.host}:${config.port}`);
});
