import { OpenAPIHono } from "@hono/zod-openapi";
import { webhookUazapiRouter } from "./webhook-uazapi";

const routers = new OpenAPIHono();

routers.route("/webhook-uazapi", webhookUazapiRouter);

export { routers };
