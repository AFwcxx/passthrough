#!/usr/bin/env node
import { readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const defaultDir =
  process.env.PASSTHROUGH_CLIPBOARD_DIR ??
  join(
    process.env.XDG_DATA_HOME ?? join(process.env.HOME, ".local/share"),
    "passthrough/clipboard",
  );

export function copy(job, spawnProcess = spawn, loadFile = readFile) {
  return new Promise(async (resolve, reject) => {
    let input;
    try {
      input = job.type === "image" ? await loadFile(job.value) : job.value;
    } catch (error) {
      reject(error);
      return;
    }
    const child = spawnProcess("wl-copy", ["--type", job.mimeType], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let error = "";
    child.stderr.on("data", (data) => {
      error += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code ? reject(new Error(error || `wl-copy exited ${code}`)) : resolve(),
    );
    child.stdin.end(input);
  });
}

export async function tick(dir = defaultDir) {
  await writeFile(join(dir, ".heartbeat"), new Date().toISOString());
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json") || name.endsWith(".result.json")) continue;
    const path = join(dir, name),
      work = `${path}.working`,
      id = name.slice(0, -5);
    try {
      await rename(path, work);
      const job = JSON.parse(await readFile(work, "utf8"));
      if (
        !job.id ||
        !["text", "image"].includes(job.type) ||
        typeof job.value !== "string"
      )
        throw new Error("Invalid job");
      await copy(job);
      await writeFile(
        join(dir, `${job.id}.result.json`),
        JSON.stringify({
          success: true,
          completedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      await writeFile(
        join(dir, `${id}.result.json`),
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      await unlink(work).catch(() => {});
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  setInterval(() => tick().catch(console.error), 1000);
  tick().catch(console.error);
}
