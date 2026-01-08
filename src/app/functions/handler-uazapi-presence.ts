import { bufferMessageService } from "../message/buffer";
import { redisThreadManager } from "../thread/redis-thread";

interface PresencePayload {
  agentId: string;
  sender: string;
  state: string; // "composing" | "recording" | "paused"
  token: string;
}

export async function handlerUazapiPresence(
  payload: PresencePayload,
): Promise<{ message: string } | null> {
  try {
    const { agentId, sender, state } = payload;

    // Verifica se a thread existe e obtém os dados
    const thread = await redisThreadManager.getThread(agentId, sender);

    if (!thread) {
      console.log(
        `Thread not found for agentId: ${agentId}, sender: ${sender}. Ignoring presence event.`,
      );
      return { message: "Thread not found, presence event ignored" };
    }

    // Obtém o threadId da thread existente
    const threadId = thread.threadId;

    // Mapeia o estado do WhatsApp para o status de atividade do buffer
    if (state === "composing") {
      // Usuário está digitando - trava o buffer
      await bufferMessageService.setUserActivityStatus(threadId, "typing");
      console.log(`Buffer locked for thread ${threadId} - user is typing`);
    } else if (state === "recording") {
      // Usuário está gravando áudio - trava o buffer
      await bufferMessageService.setUserActivityStatus(threadId, "recording");
      console.log(`Buffer locked for thread ${threadId} - user is recording`);
    } else if (state === "paused" || state === "available") {
      // Usuário parou de digitar/gravar - reativa o buffer com delay de 3 segundos
      setTimeout(async () => {
        await bufferMessageService.setUserActivityStatus(threadId, "paused");
        console.log(
          `Buffer unlocked for thread ${threadId} after 3s delay - user paused`,
        );
      }, 3000);
    }

    return { message: "Presence event processed successfully" };
  } catch (error) {
    console.error("Error processing presence event", error);
    return null;
  }
}
