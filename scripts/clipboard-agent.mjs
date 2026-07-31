#!/usr/bin/env node
import { readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const convertImage = promisify(execFile);

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
    child.on("exit", (code) =>
      code ? reject(new Error(error || `wl-copy exited ${code}`)) : resolve(),
    );
    child.stdin.end(input);
  });
}

export async function tick(
  dir = defaultDir,
  copyJob = copy,
  convert = (source, target) =>
    convertImage("magick", [`${source}[0]`, target]),
) {
  await writeFile(join(dir, ".heartbeat"), new Date().toISOString());
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json") || name.endsWith(".result.json")) continue;
    const path = join(dir, name),
      work = `${path}.working`,
      id = name.slice(0, -5);
    let payload, converted;
    try {
      await rename(path, work);
      const job = JSON.parse(await readFile(work, "utf8"));
      if (
        job.id !== id ||
        !["text", "image"].includes(job.type) ||
        typeof job.value !== "string" ||
        (job.type === "image" && basename(job.value) !== job.value)
      )
        throw new Error("Invalid job");
      if (job.type === "image") {
        payload = join(dir, job.value);
        if (job.mimeType !== "image/png") {
          converted = `${payload}.png`;
          await convert(payload, converted);
        }
      }
      await copyJob({
        ...job,
        value: converted ?? payload ?? job.value,
        mimeType: converted ? "image/png" : job.mimeType,
      });
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
      if (payload) await unlink(payload).catch(() => {});
      if (converted) await unlink(converted).catch(() => {});
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
