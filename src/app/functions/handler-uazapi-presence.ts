import { bufferMessageService } from "../message/buffer";
import { redisThreadManager } from "../thread/redis-thread";
import { baseLogger } from "../../observability/logger";

const logger = baseLogger.child({ component: "HandlerUazapiPresence" });

interface PresencePayload {
  agentId: string;
  lid: string; // LID do WhatsApp (vem em body.event.Sender)
  state: string; // "composing" | "recording" | "paused"
  token: string;
}

export async function handlerUazapiPresence(
  payload: PresencePayload,
): Promise<{ message: string } | null> {
  try {
    const { agentId, lid, state } = payload;

    logger.info({ agentId, lid, state }, "Processing presence event");

    // Busca o threadId através do LID
    const threadId = await redisThreadManager.getThreadIdByLid(agentId, lid);

    if (!threadId) {
      logger.debug(
        { agentId, lid, state },
        "Thread not found, ignoring presence event",
      );
      return { message: "Thread not found, presence event ignored" };
    }

    logger.debug(
      { agentId, lid, threadId, state },
      "Thread found for presence event",
    );

    // Mapeia o estado do WhatsApp para o status de atividade do buffer
    if (state === "composing") {
      // Usuário está digitando - trava o buffer
      await bufferMessageService.setUserActivityStatus(threadId, "typing");
      logger.info({ threadId, agentId, lid }, "Buffer locked - user is typing");
    } else if (state === "recording") {
      // Usuário está gravando áudio - trava o buffer
      await bufferMessageService.setUserActivityStatus(threadId, "recording");
      logger.info(
        { threadId, agentId, lid },
        "Buffer locked - user is recording",
      );
    } else if (state === "paused" || state === "available") {
      // Usuário parou de digitar/gravar - reativa o buffer com delay de 3 segundos

      await bufferMessageService.setUserActivityStatus(threadId, "paused");
      logger.info({ threadId, agentId, lid }, "Buffer unlocked - user paused");
    }

    logger.info(
      { agentId, lid, threadId, state },
      "Presence event processed successfully",
    );
    return { message: "Presence event processed successfully" };
  } catch (error) {
    logger.error({ error, payload }, "Error processing presence event");
    return null;
  }
}
