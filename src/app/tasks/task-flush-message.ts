import { RuntimeContext } from "@mastra/core/runtime-context";
import { AgentRuntime, mainAgent } from "../../mastra/agents/main-agent";
import { FlushEvent } from "../message/buffer";
import { UazapiApi } from "../../sdks/uazapi/uazapi-api";
import { baseLogger } from "../../observability/logger";
import { eventEmitter } from "../../events/event-emitter";

const logger = baseLogger.child({ component: "TaskFlushMessage" });

export const taskFlushMessage = async (payload: FlushEvent): Promise<any> => {
  logger.info(
    {
      threadId: payload.threadId,
      messageCount: payload.messageCount,
    },
    "Starting flush message task",
  );

  const { agent, contact, uazapi } = payload.metadata ?? {};

  if (!agent || !contact || !uazapi) {
    logger.warn(
      {
        threadId: payload.threadId,
        hasAgent: !!agent,
        hasContact: !!contact,
        hasUazapi: !!uazapi,
      },
      "Missing metadata, skipping flush",
    );
    return;
  }

  logger.debug(
    {
      threadId: payload.threadId,
      agentId: agent.id,
      agentName: agent.name,
      contactId: contact.id,
      contactPhone: contact.phone,
    },
    "Metadata loaded",
  );

  const messagesJoined = payload.messages
    .filter((message) => !!message.text)
    .map((message) => message.text)
    .join("\n");

  logger.debug(
    {
      threadId: payload.threadId,
      messagesCount: payload.messages.length,
      textLength: messagesJoined.length,
    },
    "Messages joined for processing",
  );

  if (!contact.phone) {
    logger.error(
      { threadId: payload.threadId, contactId: contact.id },
      "No phone number found for contact",
    );
    return;
  }

  const runtimeContext = new RuntimeContext<AgentRuntime>();

  runtimeContext.set("model", agent.llm?.model);
  runtimeContext.set(
    "instructions",
    agent.systemPrompt || "You are a helpful assistant",
  );

  logger.debug(
    {
      threadId: payload.threadId,
      model: agent.llm?.model,
      hasSystemPrompt: !!agent.systemPrompt,
    },
    "Generating AI response",
  );

  const response = await mainAgent.generate(messagesJoined, {
    runtimeContext,
    memory: {
      resource: contact.id,
      thread: payload.threadId,
    },
  });

  const totalTokens = response.totalUsage.totalTokens || 0;
  const totalCost =
    (response?.providerMetadata?.openrouter?.usage as any).cost || 0;

  logger.info(
    {
      threadId: payload.threadId,
      responseLength: response.text.length,
    },
    "AI response generated",
  );

  eventEmitter.emit("onRegisterUsage", {
    agentId: agent.id,
    model: agent.llm?.model || "unknown",
    totalTokens,
    totalCost,
  });

  const uazapiApi = new UazapiApi({
    baseUrl: process.env.UAZAPI_BASE_URL!,
    adminToken: process.env.UAZAPI_ADMIN_TOKEN!,
    instanceToken: uazapi.token,
  });

  const sendMessagePayload = {
    number: contact.phone,
    text: response.text,
    delay: 1500,
    readchat: false,
    readmessages: false,
  };

  logger.debug(
    {
      threadId: payload.threadId,
      contactPhone: contact.phone,
      messageLength: response.text.length,
      delay: 1500,
    },
    "Sending message via Uazapi",
  );

  await uazapiApi.sendTextMessage({
    ...sendMessagePayload,
    text: response.text,
  });

  logger.info(
    {
      threadId: payload.threadId,
      contactPhone: contact.phone,
      responseLength: response.text.length,
    },
    "Message sent successfully",
  );

  return response;
};
