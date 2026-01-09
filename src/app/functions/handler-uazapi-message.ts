import { UazapiApi } from "../../sdks/uazapi/uazapi-api";
import { bufferMessageService, RedisBufferMessage } from "../message/buffer";
import { getAgentById } from "./get-agent-by-id";
import { getOrCreateContact } from "./get-or-create-contact";
import { createHash } from "node:crypto";
import { redisThreadManager } from "../thread/redis-thread";
import { baseLogger } from "../../observability/logger";

const logger = baseLogger.child({ component: "HandlerUazapiMessage" });

interface HandlerMessageUazapiInput {
  agentId: string;
  sender: string;
  lid?: string; // LID do WhatsApp para mapeamento
  chat: {
    name: string;
    picture: string;
  };
  message: {
    id: string;
    text: string;
    fromMe: boolean;
    timestamp: string;
    mediaType: string;
    type: string;
  };
  token: string;
}

interface Output {
  message: string;
  status: number;
}

export const handlerUazapiMessage = async (
  payload: HandlerMessageUazapiInput,
): Promise<Output> => {
  logger.info(
    {
      agentId: payload.agentId,
      sender: payload.sender,
      lid: payload.lid,
      messageId: payload.message.id,
      mediaType: payload.message.mediaType,
    },
    "Processing message",
  );

  const agentResult = await getAgentById(payload.agentId);

  if (agentResult.isErr()) {
    logger.error(
      { agentId: payload.agentId, error: agentResult.error },
      "Failed to get agent",
    );
    return {
      message: agentResult.error.message,
      status: 1,
    };
  }

  const agent = agentResult.value;

  if (!agent) {
    logger.warn({ agentId: payload.agentId }, "Agent not found");
    return {
      message: "Agent not found",
      status: 0,
    };
  }

  if (agent.active === false) {
    logger.warn({ agentId: payload.agentId }, "Agent is inactive");
    return {
      message: "Agent is inactive",
      status: 0,
    };
  }

  logger.debug(
    { agentId: payload.agentId, agentName: agent.name },
    "Agent found and active",
  );

  const contactId = createHash("sha1")
    .update(`${payload.agentId}_${payload.sender}`)
    .digest("hex");

  const contactResult = await getOrCreateContact(payload.agentId, {
    refId: contactId,
    phone: payload.sender,
    name: payload.chat.name,
    picture: payload.chat.picture,
  });

  if (contactResult.isErr()) {
    logger.error(
      {
        agentId: payload.agentId,
        sender: payload.sender,
        error: contactResult.error,
      },
      "Failed to get or create contact",
    );
    return {
      message: contactResult.error.message,
      status: 0,
    };
  }

  const contact = contactResult.value;

  if (!contact) {
    logger.error(
      { agentId: payload.agentId, sender: payload.sender },
      "Contact error",
    );
    return {
      message: "Contact error",
      status: 4,
    };
  }

  if (contact.active === false) {
    logger.warn(
      { agentId: payload.agentId, sender: payload.sender, contactId },
      "Contact is inactive",
    );
    return {
      message: "Contact is inactive",
      status: 0,
    };
  }

  logger.debug(
    {
      agentId: payload.agentId,
      sender: payload.sender,
      contactId,
      contactName: contact.name,
    },
    "Contact found and active",
  );

  const { message, token, lid } = payload;

  // Get or create thread com TTL de 4 horas e salva mapeamento LID
  const threadId = await redisThreadManager.getOrCreateThread(
    payload.agentId,
    payload.sender,
    lid,
  );

  logger.debug(
    { agentId: payload.agentId, sender: payload.sender, threadId, lid },
    "Thread obtained",
  );

  // Define status como "paused" imediatamente ao receber mensagem
  await bufferMessageService.setUserActivityStatus(threadId, "paused");
  logger.debug({ threadId }, "User activity status set to paused");

  bufferMessageService.addMessage(
    threadId,
    {
      mediaType: message.mediaType,
      text: message.text,
      type: message.type,
      messageId: message.id,
    },
    {
      agent: agent,
      contact: contact,
      uazapi: {
        token,
      },
    },
    3000,
  );

  logger.info(
    {
      agentId: payload.agentId,
      sender: payload.sender,
      threadId,
      messageId: message.id,
      mediaType: message.mediaType,
    },
    "Message handled successfully",
  );

  return {
    message: "Message handled successfully",
    status: 0,
  };
};
