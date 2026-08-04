import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
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
    const job = JSON.parse(
      readFileSync(join(root, "clip", `${r.body.transferId}.json`), "utf8"),
    );
    expect(job.type).toBe("image");
    expect(job.value).toBe(`${r.body.transferId}.payload`);
    expect(existsSync(join(root, "clip", job.value))).toBe(true);
    expect(readdirSync(join(root, "up"))).toHaveLength(2);
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
  it("stages clipboard images without retaining uploads", async () => {
    const r = await request(ctx.app)
      .post("/api/share")
      .set("Authorization", `Bearer ${token}`)
      .field("action", "clipboard")
      .attach("files", Buffer.from("image"), "shot.png");
    const job = JSON.parse(
      readFileSync(join(root, "clip", `${r.body.transferId}.json`), "utf8"),
    );

    expect(r.status).toBe(201);
    expect(r.body.savedPaths).toEqual([]);
    expect(readdirSync(join(root, "up"))).toEqual([]);
    expect(readFileSync(join(root, "clip", job.value), "utf8")).toBe("image");
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
  it("keeps PWA library files in SQLite and supports list, download, and delete", async () => {
    const uploaded = await request(ctx.app)
      .post("/api/library")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("first"), "same.txt")
      .attach("files", Buffer.from("second"), "same.txt");
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.items).toHaveLength(2);
    expect(readdirSync(join(root, "up"))).toEqual([]);

    const listed = await request(ctx.app)
      .get("/api/library?page=1")
      .set("Authorization", `Bearer ${token}`);
    expect(listed.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    expect(
      listed.body.items.map((item: { filename: string }) => item.filename),
    ).toEqual(["same.txt", "same.txt"]);
    expect(listed.body.items[0]).not.toHaveProperty("content");

    const id = listed.body.items[0].id,
      downloaded = await request(ctx.app)
        .get(`/api/library/${id}/download`)
        .set("Authorization", `Bearer ${token}`);
    expect(downloaded.text).toBe("second");
    expect(downloaded.headers["content-disposition"]).toContain("same.txt");
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");

    expect(
      (
        await request(ctx.app)
          .delete(`/api/library/${id}`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(ctx.app)
          .get(`/api/library/${id}/download`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(404);
  });
  it("paginates library metadata without loading file bodies", async () => {
    const insert = ctx.db.prepare(
      "INSERT INTO library_files(uploaded_at,filename,mime_type,byte_size,content) VALUES(?,?,?,?,?)",
    );
    for (let i = 1; i <= 21; i++)
      insert.run(
        new Date().toISOString(),
        `${i}.txt`,
        "text/plain",
        1,
        Buffer.from("x"),
      );

    const secondPage = await request(ctx.app)
      .get("/api/library?page=2")
      .set("Authorization", `Bearer ${token}`);
    expect(secondPage.body).toMatchObject({ page: 2, pageSize: 20, total: 21 });
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].filename).toBe("1.txt");
  });
  it("rejects an oversized library batch without storing part of it", async () => {
    const response = await request(ctx.app)
      .post("/api/library")
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.alloc(600), "a")
      .attach("files", Buffer.alloc(600), "b");
    expect(response.status).toBe(413);
    expect(
      (
        ctx.db.prepare("SELECT count(*) total FROM library_files").get() as {
          total: number;
        }
      ).total,
    ).toBe(0);
  });
});
