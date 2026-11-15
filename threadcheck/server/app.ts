import express from "express";
import { browserBridge } from "./bridge";
import { vaultRouter, VaultOptions, VaultError } from "./vault";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { Store } from "./database";
import { ComparePhotos } from "./vision";
import { ExtractFit } from "./fit";
import { createPhotoScan, verifyTag } from "./verification";
import { parseTag } from "../shared/tags";
import { itemInputSchema, photoSchema, scanInputSchema } from "../shared/model";

export function createApp(
  store: Store,
  pairingCode: string,
  comparePhotos: ComparePhotos | null,
  vaultOptions: VaultOptions,
  extractFit: ExtractFit | null = null,
  demoAutoConnect = false,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "64mb" }));
  app.get("/api/health", (_request, response) =>
    response.json({ status: "ok", name: "Threadcheck Vault" }),
  );
  app.post(
    "/api/pair",
    rateLimit({ windowMs: 60_000, limit: 10 }),
    async (request, response) => {
      const input = z
        .object({ code: z.string().regex(/^\d{6}$/) })
        .parse(request.body);
      const actual = Buffer.from(input.code);
      const expected = Buffer.from(pairingCode);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        response.status(401).json({
          error:
            "That pairing code doesn’t match. Check the code in your store server terminal.",
        });
        return;
      }
      const token = randomBytes(32).toString("hex");
      await store.database.query(
        'DELETE FROM sessions WHERE "expiresAt" <= $1',
        [Date.now()],
      );
      await store.database.query("INSERT INTO sessions VALUES ($1,$2)", [
        createHash("sha256").update(token).digest("hex"),
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ]);
      response.json({ token });
    },
  );
  const bridge = browserBridge(
    store,
    vaultOptions.encryptionKey,
    demoAutoConnect,
  );
  app.use("/api/browser", bridge.browser);
  app.use("/api", async (request, response, next) => {
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    const tokenHash = token
      ? createHash("sha256").update(token).digest("hex")
      : "";
    const session = await store.database.query(
      'SELECT token FROM sessions WHERE token=$1 AND "expiresAt">$2',
      [tokenHash, Date.now()],
    );
    if (!session.rowCount) {
      response
        .status(401)
        .json({ error: "Connect to your vault in Settings to continue." });
      return;
    }
    response.locals.tokenHash = tokenHash;
    next();
  });
  app.use("/api/bridge", bridge.phone);
  app.get("/api/store", (_request, response) =>
    response.json({
      name: "Threadcheck Vault",
      visionEnabled: Boolean(comparePhotos),
    }),
  );
  app.post(
    "/api/drip/fit",
    rateLimit({ windowMs: 60_000, limit: 4 }),
    async (request, response) => {
      const { photo } = z.object({ photo: photoSchema }).parse(request.body);
      if (!extractFit) {
        response.status(503).json({
          error: "Clothing detection is not configured on your vault.",
        });
        return;
      }
      try {
        response.json(await extractFit(photo));
      } catch (failure) {
        response.status(502).json({
          error:
            failure instanceof Error
              ? failure.message
              : "Could not scan your fit. Please retry.",
        });
      }
    },
  );
  app.delete("/api/session", async (request, response) => {
    await store.database.query("DELETE FROM sessions WHERE token=$1", [
      response.locals.tokenHash,
    ]);
    response.status(204).end();
  });
  const listSchema = z.object({
    search: z.string().trim().max(100).default(""),
    category: z.string().max(30).default(""),
    offset: z.coerce.number().int().min(0).default(0),
  });
  app.get("/api/items", async (request, response) => {
    const query = listSchema.parse(request.query);
    response.json(
      await store.listItems(query.search, query.category, query.offset),
    );
  });
  app.get("/api/items/:id", async (request, response) => {
    const item = await store.getItem(request.params.id);
    response
      .status(item ? 200 : 404)
      .json(item ?? { error: "This item no longer exists." });
  });
  app.post("/api/items", async (request, response) => {
    const input = itemInputSchema.parse(request.body);
    try {
      const identity = parseTag(input.barcode);
      if (identity.serial && input.serial && identity.serial !== input.serial) {
        response.status(400).json({
          error: "The scanned serial number and entered serial number differ.",
        });
        return;
      }
      input.barcode = identity.barcode;
      if (identity.serial) input.serial = identity.serial;
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "This tag could not be read.",
      });
      return;
    }
    if (await store.lookup(input.barcode, input.serial)) {
      response.status(409).json({
        error:
          "This barcode and serial number are already registered. Open the existing item instead.",
      });
      return;
    }
    response.status(201).json(await store.createItem(input));
  });
  app.patch("/api/items/:id/photo", async (request, response) => {
    const photo = photoSchema.parse(request.body.photo);
    if (!(await store.getItem(request.params.id))) {
      response.status(404).json({ error: "This item no longer exists." });
      return;
    }
    await store.database.query("UPDATE items SET photo=$1 WHERE id=$2", [
      photo,
      request.params.id,
    ]);
    response.json(await store.getItem(request.params.id));
  });
  app.post("/api/scans", async (request, response) => {
    const input = scanInputSchema.parse(request.body);
    try {
      response.status(201).json(await verifyTag(store, input));
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error ? error.message : "Unable to read this tag.",
      });
    }
  });
  app.get("/api/scans", async (request, response) =>
    response.json(
      await store.listScans(listSchema.parse(request.query).offset),
    ),
  );
  app.post(
    "/api/photo-checks",
    rateLimit({ windowMs: 60_000, limit: 12 }),
    async (request, response) => {
      const input = z
        .object({
          itemId: z.string(),
          photo: photoSchema,
          scanId: z.string().optional(),
        })
        .parse(request.body);
      const item = await store.getItem(input.itemId);
      if (!item) {
        response.status(404).json({ error: "This item no longer exists." });
        return;
      }
      if (!item.photo) {
        response
          .status(409)
          .json({ error: "Add a reference photo on the item’s page first." });
        return;
      }
      if (!comparePhotos) {
        response.status(503).json({
          error:
            "Photo checks aren’t configured. Add the Backboard key on your store server.",
        });
        return;
      }
      const previous = input.scanId
        ? await store.getScan(input.scanId)
        : undefined;
      if (
        input.scanId &&
        (!previous || previous.itemId !== item.id || previous.tag !== "matched")
      ) {
        response.status(400).json({
          error: "Scan this item’s matching tag before adding its photo check.",
        });
        return;
      }
      try {
        const review = await comparePhotos(item, input.photo);
        const record = {
          ...(previous ?? createPhotoScan(item)),
          photo: review.verdict,
          explanation: review.explanation,
          observations: review.observations,
        };
        response.json(
          previous
            ? await store.updateScan(record)
            : await store.saveScan(record),
        );
      } catch (error) {
        console.error(
          "Photo comparison failed:",
          error instanceof Error ? error.message : "Unknown failure",
        );
        response.status(502).json({
          error:
            error instanceof Error
              ? error.message
              : "The photo check failed. Please retry.",
        });
      }
    },
  );
  app.use("/api/vault", vaultRouter(store, comparePhotos, vaultOptions));
  const errorHandler: express.ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    if (error instanceof VaultError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: "The request could not be read." });
      return;
    }
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : "Unknown failure",
    );
    response.status(500).json({
      error: "The store couldn’t complete that request. Please retry.",
    });
  };
  app.use(errorHandler);
  return app;
}
