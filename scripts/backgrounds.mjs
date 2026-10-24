#!/usr/bin/env node

import process from "node:process";
import {
  listImageFiles,
  readConfig,
  readState,
  removeEntry,
  syncConfig,
  updateEntry,
} from "./backgrounds-lib.mjs";

function fail(message) {
  console.error(`[backgrounds] ${message}`);
  process.exit(1);
}

function printList() {
  const config = readConfig();
  if (config.backgrounds.length === 0) {
    console.log("[backgrounds] no entries");
    return;
  }
  for (const entry of config.backgrounds) {
    console.log(`${entry.file}\ttheme=${entry.theme}\tplatform=${entry.platform}`);
  }
}

function printStatus() {
  const state = readState();
  console.log(`[backgrounds] images=${state.images.length} entries=${state.entries.length} missing=${state.missing.length}`);
  for (const entry of state.entries) {
    console.log(`${entry.exists ? "ok " : "!! "}${entry.file}\ttheme=${entry.theme}\tplatform=${entry.platform}`);
  }
  const configured = new Set(state.entries.map((entry) => entry.file));
  const unlisted = state.images.filter((image) => !configured.has(image.file));
  if (unlisted.length > 0) {
    console.log("[backgrounds] images not in config:");
    for (const image of unlisted) console.log(`  ${image.file}`);
  }
}

function printSync({ prune }) {
  const result = syncConfig({ prune });
  console.log(`[backgrounds] sync complete: +${result.added}, -${result.removed}, total=${result.total}`);
}

function setEntry(file, assignments) {
  if (!file || assignments.length === 0) fail("Usage: set <file> theme=... platform=...");
  const values = {};
  for (const assignment of assignments) {
    const separator = assignment.indexOf("=");
    if (separator < 0) fail(`Invalid assignment: ${assignment}`);
    const key = assignment.slice(0, separator).trim();
    const value = assignment.slice(separator + 1).trim();
    if (key !== "theme" && key !== "platform") fail(`Unsupported property: ${key}`);
    values[key] = value;
  }
  try {
    updateEntry(file, values);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  console.log(`[backgrounds] updated ${file}`);
}

function printHelp() {
  console.log(`Usage:
  npm run backgrounds -- sync [--prune]
  npm run backgrounds -- list
  npm run backgrounds -- status
  npm run backgrounds -- set <file> theme=<day|night|both> platform=<computer|phone|both>
  npm run backgrounds -- remove <file>
  npm run backgrounds:gui`);
  const files = listImageFiles();
  if (files.length > 0) {
    console.log("\nImages:");
    for (const file of files) console.log(`  ${file}`);
  }
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "sync":
    printSync({ prune: args.includes("--prune") });
    break;
  case "list":
    printList();
    break;
  case "status":
    printStatus();
    break;
  case "set":
    setEntry(args[0], args.slice(1));
    break;
  case "remove":
    if (!args[0]) fail("Usage: remove <file>");
    try {
      removeEntry(args[0]);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
    console.log(`[backgrounds] removed ${args[0]}`);
    break;
  default:
    printHelp();
    if (command) process.exitCode = 1;
}
