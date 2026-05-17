import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

const host = process.env.EPHEMEROS_VPN_BIND_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.EPHEMEROS_VPN_TARGET_PORT ?? "8080", 10);
const targetFile = path.resolve(process.env.EPHEMEROS_VPN_TARGET_FILE ?? "vpn-target/ephemeros-vpn-health.txt");

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" || req.url !== "/ephemeros-vpn-health.txt") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found\n");
    return;
  }

  const body = await fs.readFile(targetFile, "utf8");
  res.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
});

server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    const url = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/ephemeros-vpn-health.txt`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const body = await response.text();
      if (response.ok && body.includes("Ephemeros VPN reachability proof")) {
        console.log(`Ephemeros VPN target already running at ${url}`);
        process.exit(0);
      }
    } catch {
      // Fall through to the normal error.
    }
  }

  console.error(error.message);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Ephemeros VPN target listening on http://${host}:${port}/ephemeros-vpn-health.txt`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
