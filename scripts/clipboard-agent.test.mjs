import { EventEmitter } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { copy, tick } from "./clipboard-agent.mjs";

test("completes when wl-copy daemonizes without closing inherited stderr", async () => {
  let call;
  const spawn = (command, args, options) => {
    call = { command, args, options, input: undefined };
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      end(input) {
        call.input = input;
        Promise.resolve().then(() => child.emit("exit", 0));
      },
    };
    return child;
  };
  await copy(
    { type: "text", mimeType: "text/plain", value: "$(touch /tmp/nope)" },
    spawn,
  );
  assert.deepEqual(call, {
    command: "wl-copy",
    args: ["--type", "text/plain"],
    options: { stdio: ["pipe", "ignore", "pipe"] },
    input: "$(touch /tmp/nope)",
  });
});

test("resolves image payloads inside the shared directory and cleans them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "passthrough-agent-"));
  const id = "image-job",
    payload = `${id}.payload`;
  await writeFile(join(dir, payload), "image");
  await writeFile(
    join(dir, `${id}.json`),
    JSON.stringify({
      id,
      type: "image",
      mimeType: "image/png",
      value: payload,
    }),
  );

  await tick(dir, async (job) => {
    assert.equal(job.value, join(dir, payload));
  });

  await assert.rejects(readFile(join(dir, payload)));
  assert.equal(
    JSON.parse(await readFile(join(dir, `${id}.result.json`), "utf8")).success,
    true,
  );
});

test("converts JPEG payloads to PNG for clipboard compatibility", async () => {
  const dir = await mkdtemp(join(tmpdir(), "passthrough-agent-"));
  const id = "jpeg-job",
    payload = join(dir, `${id}.payload`),
    converted = `${payload}.png`;
  await writeFile(payload, "jpeg");
  await writeFile(
    join(dir, `${id}.json`),
    JSON.stringify({
      id,
      type: "image",
      mimeType: "image/jpeg",
      value: `${id}.payload`,
    }),
  );

  await tick(
    dir,
    async (job) => {
      assert.equal(job.value, converted);
      assert.equal(job.mimeType, "image/png");
      assert.equal(await readFile(job.value, "utf8"), "png");
    },
    async (source, target) => {
      assert.equal(source, payload);
      assert.equal(target, converted);
      await writeFile(target, "png");
    },
  );

  await assert.rejects(readFile(payload));
  await assert.rejects(readFile(converted));
  assert.equal(
    JSON.parse(await readFile(join(dir, `${id}.result.json`), "utf8")).success,
    true,
  );
});

test("rejects image payload paths outside the shared directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "passthrough-agent-"));
  const id = "unsafe-job";
  await writeFile(
    join(dir, `${id}.json`),
    JSON.stringify({
      id,
      type: "image",
      mimeType: "image/png",
      value: "../image.png",
    }),
  );

  await tick(dir, async () => assert.fail("unsafe job was copied"));

  assert.equal(
    JSON.parse(await readFile(join(dir, `${id}.result.json`), "utf8")).success,
    false,
  );
});
