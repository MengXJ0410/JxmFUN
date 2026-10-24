#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  IMAGES_DIR,
  IMAGE_FILE,
  readState,
  removeEntry,
  syncConfig,
  updateEntry,
} from "./backgrounds-lib.mjs";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.BACKGROUNDS_GUI_PORT || DEFAULT_PORT);
const html = readFileSync(fileURLToPath(new URL("./backgrounds-gui.html", import.meta.url)), "utf8");

const CONTENT_TYPES = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function serveImage(response, file) {
  if (!IMAGE_FILE.test(file) || file !== basename(file)) {
    sendJson(response, 404, { error: "Image not found" });
    return;
  }
  const fullPath = join(IMAGES_DIR, file);
  if (!existsSync(fullPath)) {
    sendJson(response, 404, { error: "Image not found" });
    return;
  }
  const data = readFileSync(fullPath);
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": data.length,
    "Cache-Control": "no-store",
  });
  response.end(data);
}

async function handle(request, response) {
  const url = new URL(request.url || "/", `http://${HOST}:${port}`);

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/images/")) {
    serveImage(response, decodeURIComponent(url.pathname.slice("/images/".length)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, { ok: true, state: readState() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/update") {
    const body = await readBody(request);
    const file = typeof body.file === "string" ? body.file : "";
    const entry = updateEntry(file, {
      theme: typeof body.theme === "string" ? body.theme : undefined,
      platform: typeof body.platform === "string" ? body.platform : undefined,
    });
    sendJson(response, 200, { ok: true, entry, state: readState() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sync") {
    const body = await readBody(request);
    const result = syncConfig({ prune: body.prune === true });
    sendJson(response, 200, { ok: true, result, state: readState() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/remove") {
    const body = await readBody(request);
    if (typeof body.file !== "string" || !body.file) throw new Error("Missing background file");
    removeEntry(body.file);
    sendJson(response, 200, { ok: true, state: readState() });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function openBrowser(url) {
  try {
    const options = { detached: true, stdio: "ignore" };
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], options).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], options).unref();
    } else {
      spawn("xdg-open", [url], options).unref();
    }
  } catch {
    // The printed URL is enough if a desktop opener is unavailable.
  }
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) sendJson(response, 400, { error: message });
    else response.end();
  });
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`[backgrounds-gui] Port ${port} is already in use. Try --port ${port + 1}.`);
  } else {
    console.error("[backgrounds-gui]", error);
  }
  process.exitCode = 1;
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}`;
  console.log(`[backgrounds-gui] ${url}`);
  console.log("[backgrounds-gui] Ctrl+C to stop. Use --no-open to skip opening the browser.");
  if (!args.includes("--no-open")) openBrowser(url);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
