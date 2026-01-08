import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { routers } from "./rest/routers";
import type { Context } from "./rest/types";
import "./listeners";

const app = new OpenAPIHono<Context>();

app.use("*", requestId());
app.use(secureHeaders());
app.use(cors());

app.doc("/openapi", {
  openapi: "3.1.0",
  info: {
    version: "0.0.1",
    title: "Nisee API",
  },
  servers: [
    {
      url: "https://engine.nisee.com.br",
      description: "Production API",
    },
    {
      url: "http://localhost:3000",
      description: "Development API",
    },
  ],
});

app.get(
  "/docs",
  Scalar({
    pageTitle: "Nisee API",
    theme: "saturn",
    sources: [
      { url: "/openapi", title: "API" },
      { url: "/auth/open-api/generate-schema", title: "Auth" },
    ],
  }),
);

app.route("/", routers);

export default {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  fetch: app.fetch,
  host: "0.0.0.0",
};
