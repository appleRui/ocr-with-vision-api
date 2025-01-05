import { Hono } from "hono";
import dotenv from "dotenv";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { handleSlackEventsUseCase } from "./usecase/handleSlackEnvets.usecase.js";
import { createLogger } from "./logger.js";

const customLogger = createLogger('index.ts')

dotenv.config();

const app = new Hono();

app.use(logger())

app.get("/ping", (c) => c.json({ message: "OK" }));

app.post("/slack/events", handleSlackEventsUseCase);

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

customLogger.info(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
