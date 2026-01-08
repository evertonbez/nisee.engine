import { UazapiApi } from "../../sdks/uazapi/uazapi-api";
import { bufferMessageService, RedisBufferMessage } from "../message/buffer";
import { getAgentById } from "./get-agent-by-id";
import { getOrCreateContact } from "./get-or-create-contact";
import { createHash } from "node:crypto";
import { redisThreadManager } from "../thread/redis-thread";

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
  const agentResult = await getAgentById(payload.agentId);

  if (agentResult.isErr()) {
    return {
      message: agentResult.error.message,
      status: 1,
    };
  }

  const agent = agentResult.value;

  if (!agent) {
    return {
      message: "Agent not found",
      status: 0,
    };
  }

  if (agent.active === false) {
    return {
      message: "Agent is inactive",
      status: 0,
    };
  }

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
    return {
      message: contactResult.error.message,
      status: 0,
    };
  }

  const contact = contactResult.value;

  if (!contact) {
    return {
      message: "Contact error",
      status: 4,
    };
  }

  if (contact.active === false) {
    return {
      message: "Contact is inactive",
      status: 0,
    };
  }

  const { message, token, lid } = payload;

  // Get or create thread com TTL de 4 horas e salva mapeamento LID
  const threadId = await redisThreadManager.getOrCreateThread(
    payload.agentId,
    payload.sender,
    lid,
  );

  // Define status como "paused" imediatamente ao receber mensagem
  await bufferMessageService.setUserActivityStatus(threadId, "paused");

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
    2000,
  );

  return {
    message: "Message handled successfully",
    status: 0,
  };
};
