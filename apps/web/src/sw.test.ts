// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("caches the generated application shell during installation", async () => {
  type InstallEvent = { waitUntil: (promise: Promise<void>) => void };
  let install: ((event: InstallEvent) => void) | undefined;
  const cache = { put: vi.fn(), addAll: vi.fn() };
  const response = {
    clone: () => ({
      text: async () =>
        '<link href="/assets/index.css"><script src="/assets/index.js"></script>',
    }),
  };
  runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://passthrough.test" },
        addEventListener: (
          name: string,
          handler: (event: InstallEvent) => void,
        ) => {
          if (name === "install") install = handler;
        },
      },
      caches: { open: async () => cache },
      fetch: async () => response,
      URL,
      Set,
    },
  );
  let installation: Promise<void> | undefined;
  expect(install).toBeTypeOf("function");
  install!({ waitUntil: (promise) => (installation = promise) });
  await installation!;
  expect(cache.put).toHaveBeenCalledWith("/", response);
  expect(cache.addAll).toHaveBeenCalledWith([
    "/manifest.webmanifest",
    "/icon.svg",
    "/assets/index.css",
    "/assets/index.js",
  ]);
});
