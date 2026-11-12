import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_ROOT = path.resolve(__dirname, "..");
export const UPLOADS_DIR = process.env["API_DATA_DIR"]
  ? path.join(process.env["API_DATA_DIR"], "uploads")
  : path.join(ARTIFACT_ROOT, "data", "uploads");
const FRONTEND_DIR = path.resolve(ARTIFACT_ROOT, "..", "aitoolshubi", "dist", "public");

if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    logger.warn({ err }, "[app] Could not create uploads dir");
  }
}

const app: Express = express();

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://localhost:5000",
];

const envAllowed = (process.env["CORS_ALLOWED_ORIGINS"] || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...envAllowed]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOriginsSet.has(origin)) return true;
  // Local development origins are allowed. Add trusted merchant origins or
  // the isolated public demo origin to CORS_ALLOWED_ORIGINS explicitly.
  if (
    /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)
  ) {
    return true;
  }
  return false;
}

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  const requestId = req.id;
  if (typeof requestId === "string" || typeof requestId === "number") {
    res.setHeader("X-Request-Id", String(requestId));
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      logger.warn({ origin }, "[cors] origin rejected");
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Dev-Email",
      "X-Admin-Key",
      "x-admin-key",
      "X-User-Email",
      "x-user-email",
    ],
    maxAge: 86_400,
  }),
);

// PayPal signs exact request bytes. This parser runs before JSON parsing.
app.use("/api/paypal/webhook", express.raw({ type: "application/json", limit: "1mb" }));
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Statically serve uploaded campaign images and media assets
app.use("/api/uploads", express.static(UPLOADS_DIR, {
  maxAge: "7d",
  setHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
}));

app.get("/", (_req, res) => {
  res.json({
    status: "healthy",
    service: "Paylo Hackathon API",
    version: "1.0.0",
    endpoints: "/api",
    time: new Date().toISOString(),
  });
});

app.use("/api", router);

// The hackathon deployment serves both the isolated React app and API from
// one Render origin. This keeps the business domain and its PayPal app separate.
app.use(express.static(FRONTEND_DIR, { index: false, maxAge: "1h" }));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/") && !path.extname(req.path)) {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"), (error) => {
      if (error) next(error);
    });
    return;
  }
  next();
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.statusCode === "number" ? err.statusCode : typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) {
    logger.error({ err, requestId: req.id }, "Unhandled API error");
  } else {
    logger.warn({ err: err?.message, requestId: req.id }, "Client error");
  }
  if (res.headersSent) return;
  res.status(status).json({
    error: status === 400 ? (err?.message || "Invalid request body") : "Internal server error",
    requestId: req.id,
  });
});

export default app;
