import express from "express";
import { ZodError } from "zod";
import { cleanupContext, fetchContext } from "./bridgeService.js";

function requireBearerToken(config) {
  return (req, res, next) => {
    if (!config.requireAuth) {
      next();
      return;
    }

    if (!config.authToken) {
      res.status(503).json({
        success: false,
        error: "EPHEMEROS_AUTH_TOKEN must be set, or EPHEMEROS_ALLOW_UNAUTHENTICATED=true for local demo only"
      });
      return;
    }

    const expected = `Bearer ${config.authToken}`;
    if (req.get("authorization") !== expected) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    next();
  };
}

export function createApp({ config, invokeLambda }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "ephemeros", contextDir: config.contextDir });
  });

  app.post("/fetch-context", requireBearerToken(config), async (req, res, next) => {
    try {
      const result = await fetchContext({ requestBody: req.body, config, invokeLambda });
      const response = { ...result };
      delete response.content;
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.post("/cleanup", requireBearerToken(config), async (req, res, next) => {
    try {
      res.json(await cleanupContext({ requestBody: req.body ?? {}, config }));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
      return;
    }

    res.status(error.statusCode ?? 500).json({ success: false, error: error.message });
  });

  return app;
}
