import express from "express";
import multer from "multer";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { basename, extname, join, relative } from "node:path";
import {
  actionSchema,
  settingsSchema,
  type ShareResponse,
} from "@passthrough/shared";
import type { Config } from "./config.js";
import { getSettings, openDb } from "./db.js";

const safe = (name: string) =>
  basename(name)
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120) || "file";
export function createApp(c: Config) {
  mkdirSync(c.UPLOAD_CONTAINER_DIR, { recursive: true });
  mkdirSync(c.CLIPBOARD_DIR, { recursive: true });
  const db = openDb(c.DATABASE_PATH);
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const auth: express.RequestHandler = (req, res, next) => {
    const supplied = req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!timingSafeEqual(digest(supplied), digest(c.AUTH_TOKEN)))
      return res.status(401).json({
        success: false,
        error: {
          code: "unauthorized",
          message: "Valid bearer token required",
        },
      });
    next();
  };
  const syncResults = () => {
    for (const name of readdirSync(c.CLIPBOARD_DIR)) {
      if (!name.endsWith(".result.json")) continue;
      try {
        const result = JSON.parse(
          readFileSync(join(c.CLIPBOARD_DIR, name), "utf8"),
        ) as { success: boolean; error?: string };
        const id = name.slice(0, -".result.json".length);
        db.prepare(
          "UPDATE history SET clipboard_result=?,error_message=? WHERE transfer_id=?",
        ).run(result.success ? "copied" : "failed", result.error ?? "", id);
        unlinkSync(join(c.CLIPBOARD_DIR, name));
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "invalid clipboard result",
            file: name,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  };
  const agentStatus = () => {
    try {
      return Date.now() -
        statSync(join(c.CLIPBOARD_DIR, ".heartbeat")).mtimeMs <
        5000
        ? "running"
        : "stale";
    } catch {
      return "unavailable";
    }
  };
  app.get("/api/health", (_req, res) => {
    syncResults();
    res.json({
      status: "ok",
      clipboardAgent: { status: agentStatus() },
      uploadDirectory: c.UPLOAD_CONTAINER_DIR,
    });
  });
  app.use("/api", auth);
  const upload = multer({
    dest: c.UPLOAD_CONTAINER_DIR,
    limits: { fileSize: c.MAX_UPLOAD_BYTES, files: 20, fields: 10 },
  });
  const requestLimit: express.RequestHandler = (req, res, next) => {
    const size = Number(req.header("content-length"));
    if (Number.isFinite(size) && size > c.MAX_UPLOAD_BYTES)
      return res.status(413).json({
        success: false,
        error: {
          code: "request_too_large",
          message: "Upload exceeds configured maximum",
        },
      });
    next();
  };
  app.post(
    "/api/share",
    requestLimit,
    upload.array("files", 20),
    (req, res, next) => {
      try {
        const files = (req.files as Express.Multer.File[]) ?? [],
          text = typeof req.body.text === "string" ? req.body.text.trim() : "",
          url = typeof req.body.url === "string" ? req.body.url.trim() : "";
        const parsed = actionSchema.safeParse(
          req.body.action ?? getSettings(db).defaultAction,
        );
        const errors: string[] = [];
        if (!parsed.success)
          errors.push("action must be save, clipboard, or both");
        if (!files.length && !text && !url)
          errors.push("At least one file, text value, or URL is required");
        if (url) {
          try {
            new URL(url);
          } catch {
            errors.push("url must be valid");
          }
        }
        if (errors.length) {
          for (const f of files) unlinkSync(f.path);
          return res
            .status(400)
            .json({ success: false, validationErrors: errors });
        }
        const action = parsed.data!,
          transferId = randomUUID(),
          items: ShareResponse["processedItems"] = [],
          savedPaths: string[] = [];
        let compatible:
          | { type: "text" | "image"; value: string; mimeType: string }
          | undefined;
        for (const f of files) {
          const filename = `${randomUUID()}-${safe(f.originalname)}${extname(f.originalname) && safe(f.originalname).endsWith(extname(f.originalname)) ? "" : extname(f.originalname)}`;
          const target = join(c.UPLOAD_CONTAINER_DIR, filename);
          renameSync(f.path, target);
          const saved = action !== "clipboard";
          if (saved) savedPaths.push(relative(c.UPLOAD_CONTAINER_DIR, target));
          if (f.mimetype.startsWith("image/"))
            compatible = { type: "image", value: target, mimeType: f.mimetype };
          items.push({
            label: safe(f.originalname),
            mimeType: f.mimetype,
            size: f.size,
            ...(saved ? { savedPath: filename } : {}),
          });
        }
        if (text) {
          compatible = { type: "text", value: text, mimeType: "text/plain" };
          items.push({
            label: "Text",
            mimeType: "text/plain",
            size: Buffer.byteLength(text),
          });
        }
        if (url) {
          compatible = { type: "text", value: url, mimeType: "text/uri-list" };
          items.push({
            label: "URL",
            mimeType: "text/uri-list",
            size: Buffer.byteLength(url),
          });
        }
        const wants = action !== "save";
        const clipboardStatus =
          wants && compatible ? "queued" : wants ? "skipped" : "not_requested";
        if (clipboardStatus === "queued")
          writeFileSync(
            join(c.CLIPBOARD_DIR, `${transferId}.json`),
            JSON.stringify({ id: transferId, ...compatible }),
          );
        const stmt = db.prepare(
          "INSERT INTO history(transfer_id,timestamp,label,saved_filename,mime_type,byte_size,action,save_result,clipboard_result,error_message) VALUES(?,?,?,?,?,?,?,?,?,?)",
        );
        for (const item of items)
          stmt.run(
            transferId,
            new Date().toISOString(),
            item.label,
            item.savedPath ?? "",
            item.mimeType,
            item.size,
            action,
            item.savedPath ? "saved" : "not_saved",
            clipboardStatus,
            "",
          );
        res.status(201).json({
          success: true,
          transferId,
          action,
          processedItems: items,
          savedPaths,
          clipboardStatus,
          validationErrors: [],
        } satisfies ShareResponse);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/history", (req, res) => {
    syncResults();
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = getSettings(db).historyPageSize;
    const items = db
      .prepare("SELECT * FROM history ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, (page - 1) * limit);
    const total = (
      db.prepare("SELECT count(*) total FROM history").get() as {
        total: number;
      }
    ).total;
    res.json({ items, page, pageSize: limit, total });
  });
  app.get("/api/settings", (_req, res) => res.json(getSettings(db)));
  app.put("/api/settings", (req, res) => {
    const p = settingsSchema.safeParse(req.body);
    if (!p.success)
      return res.status(400).json({
        success: false,
        validationErrors: p.error.issues.map((i) => i.message),
      });
    const s = db.prepare(
      "INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",
    );
    s.run("defaultAction", p.data.defaultAction);
    s.run("historyPageSize", String(p.data.historyPageSize));
    res.json(p.data);
  });
  // Express recognizes error middleware by its four arguments.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction,
    ) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      const large =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
      res.status(large ? 413 : 500).json({
        success: false,
        error: {
          code: large ? "request_too_large" : "internal_error",
          message: large
            ? "Upload exceeds configured maximum"
            : "Internal server error",
        },
      });
    },
  );
  return { app, db };
}
