import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
let ctx: ReturnType<typeof createApp>, root: string;
const token = "0123456789abcdef";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pt-"));
  ctx = createApp({
    PORT: 8787,
    UPLOAD_CONTAINER_DIR: join(root, "up"),
    DATABASE_PATH: join(root, "db.sqlite"),
    CLIPBOARD_DIR: join(root, "clip"),
    AUTH_TOKEN: token,
    MAX_UPLOAD_BYTES: 1000,
  });
});
afterEach(() => ctx.db.close());
describe("API", () => {
  it("allows health and rejects unauthenticated API", async () => {
    expect((await request(ctx.app).get("/api/health")).status).toBe(200);
    expect((await request(ctx.app).get("/api/history")).status).toBe(401);
  });
  it("validates empty input", async () =>
    expect(
      (
        await request(ctx.app)
          .post("/api/share")
          .set("Authorization", `Bearer ${token}`)
          .field("action", "save")
      ).status,
    ).toBe(400));
  it("uploads multiple files safely, creates a job, and reconciles its result", async () => {
    const r = await request(ctx.app)
      .post("/api/share")
      .set("Authorization", `Bearer ${token}`)
      .field("action", "both")
      .attach("files", Buffer.from("a"), "../../a.txt")
      .attach("files", Buffer.from("b"), "b.png");
    expect(r.status).toBe(201);
    expect(r.body.processedItems).toHaveLength(2);
    expect(r.body.savedPaths.every((p: string) => !p.includes(".."))).toBe(
      true,
    );
    const jobs = readFileSync(
      join(root, "clip", `${r.body.transferId}.json`),
      "utf8",
    );
    expect(JSON.parse(jobs).type).toBe("image");
    writeFileSync(
      join(root, "clip", `${r.body.transferId}.result.json`),
      JSON.stringify({ success: true }),
    );
    const history = await request(ctx.app)
      .get("/api/history")
      .set("Authorization", `Bearer ${token}`);
    expect(history.body.total).toBe(2);
    expect(history.body.items[0].clipboard_result).toBe("copied");
  });
  it("enforces aggregate request size", async () =>
    expect(
      (
        await request(ctx.app)
          .post("/api/share")
          .set("Authorization", `Bearer ${token}`)
          .field("action", "save")
          .attach("files", Buffer.alloc(1001), "x")
      ).status,
    ).toBe(413));
});
