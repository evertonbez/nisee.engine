import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "../types";
import { handlerUazapiMessage } from "../../app/functions/handler-uazapi-message";
import { handlerUazapiPresence } from "../../app/functions/handler-uazapi-presence";

const app = new OpenAPIHono<Context>();

app.openapi(
  createRoute({
    method: "post",
    path: "/:agentId/messages",
    summary: "Webhook para receber mensagens do Uazapi",
    operationId: "webhookUazapiMessages",
    "x-speakeasy-name-override": "webhookUazapiMessages",
    description: "Webhook para receber mensagens do Uazapi",
    tags: ["Webhook"],
    request: {
      params: z.object({
        agentId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Spending metrics for the authenticated team.",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { agentId } = c.req.valid("param");
    const body = c.req.valid("json");

    const payload = {
      agentId,
      sender: body.message.sender,
      chat: {
        name: body.chat.name,
        picture: body.chat.image,
      },
      message: {
        id: body.message.messageid,
        text: body.message.text,
        fromMe: body.message.fromMe,
        timestamp: body.message.messageTimestamp,
        mediaType: body.message.mediaType,
        type: body.message.type,
      },
      token: body.token,
    };

    const result = await handlerUazapiMessage(payload);

    if (!result) {
      return c.json({ message: "Internal server error" }, 500);
    }

    const { message } = result;

    return c.json({ message }, 200);
  },
);

app.openapi(
  createRoute({
    method: "post",
    path: "/:agentId/presence",
    summary: "Webhook para receber status de presença do WhatsApp",
    operationId: "webhookUazapiPresence",
    "x-speakeasy-name-override": "webhookUazapiPresence",
    description: "Webhook para receber status de presença do WhatsApp",
    tags: ["Webhook"],
    request: {
      params: z.object({
        agentId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Spending metrics for the authenticated team.",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { agentId } = c.req.valid("param");
    const body = c.req.valid("json");

    const payload = {
      agentId,
      sender: body.event.Sender,
      state: body.event.State,
      token: body.token,
    };

    const result = await handlerUazapiPresence(payload);

    if (!result) {
      return c.json({ message: "Internal server error" }, 500);
    }

    const { message } = result;

    return c.json({ message }, 200);
  },
);
export const webhookUazapiRouter = app;
