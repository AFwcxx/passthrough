import { EventEmitter } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { copy } from "./clipboard-agent.mjs";

test("passes clipboard data through stdin without shell interpolation", async () => {
  let call;
  const spawn = (command, args, options) => {
    call = { command, args, options, input: undefined };
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      end(input) {
        call.input = input;
        Promise.resolve().then(() => child.emit("close", 0));
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
