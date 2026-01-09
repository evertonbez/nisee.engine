import { Redis } from "ioredis";
import { redisConnection } from "../cache/redis";
import { generateId } from "../../utils/id";
import { baseLogger } from "../../observability/logger";

const logger = baseLogger.child({ component: "RedisThreadManager" });

interface ThreadData {
  threadId: string;
  agentId: string;
  sender: string;
  createdAt: number;
  lastMessageAt: number;
}

export class RedisThreadManager {
  private redis: Redis;
  private readonly THREAD_KEY_PREFIX = "thread:";
  private readonly LID_MAPPING_PREFIX = "lid_to_thread:";
  private readonly THREAD_TTL_SECONDS = 4 * 60 * 60; // 4 horas

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getThreadKey(agentId: string, sender: string): string {
    return `${this.THREAD_KEY_PREFIX}${agentId}:${sender}`;
  }

  private getLidMappingKey(agentId: string, lid: string): string {
    return `${this.LID_MAPPING_PREFIX}${agentId}:${lid}`;
  }

  /**
   * Busca uma thread existente
   */
  async getThread(agentId: string, sender: string): Promise<ThreadData | null> {
    const threadKey = this.getThreadKey(agentId, sender);
    logger.debug({ agentId, sender, threadKey }, "Getting thread");

    const data = await this.redis.get(threadKey);

    if (!data) {
      logger.debug({ agentId, sender }, "Thread not found");
      return null;
    }

    try {
      const threadData = JSON.parse(data);
      logger.debug(
        { agentId, sender, threadId: threadData.threadId },
        "Thread found",
      );
      return threadData;
    } catch (error) {
      logger.error({ agentId, sender, error }, "Failed to parse thread data");
      return null;
    }
  }

  /**
   * Cria ou atualiza uma thread
   * Retorna o threadId
   * Se lid for fornecido, cria também um mapeamento lid → threadId
   */
  async getOrCreateThread(
    agentId: string,
    sender: string,
    lid?: string,
  ): Promise<string> {
    logger.debug({ agentId, sender, lid }, "Getting or creating thread");

    const threadKey = this.getThreadKey(agentId, sender);
    const existingThread = await this.getThread(agentId, sender);

    const now = Date.now();

    if (existingThread) {
      // Atualiza o timestamp da última mensagem
      existingThread.lastMessageAt = now;

      await this.redis.setex(
        threadKey,
        this.THREAD_TTL_SECONDS,
        JSON.stringify(existingThread),
      );

      logger.info(
        { agentId, sender, threadId: existingThread.threadId, lid },
        "Thread updated",
      );

      // Se forneceu lid, atualiza o mapeamento
      if (lid) {
        const lidMappingKey = this.getLidMappingKey(agentId, lid);
        await this.redis.setex(
          lidMappingKey,
          this.THREAD_TTL_SECONDS,
          existingThread.threadId,
        );
        logger.debug(
          { agentId, lid, threadId: existingThread.threadId },
          "LID mapping updated",
        );
      }

      return existingThread.threadId;
    }

    // Cria nova thread
    const threadId = generateId();
    const threadData: ThreadData = {
      threadId,
      agentId,
      sender,
      createdAt: now,
      lastMessageAt: now,
    };

    await this.redis.setex(
      threadKey,
      this.THREAD_TTL_SECONDS,
      JSON.stringify(threadData),
    );

    logger.info(
      { agentId, sender, threadId, lid, ttlSeconds: this.THREAD_TTL_SECONDS },
      "New thread created",
    );

    // Se forneceu lid, cria o mapeamento
    if (lid) {
      const lidMappingKey = this.getLidMappingKey(agentId, lid);
      await this.redis.setex(lidMappingKey, this.THREAD_TTL_SECONDS, threadId);
      logger.debug({ agentId, lid, threadId }, "LID mapping created");
    }

    return threadId;
  }

  /**
   * Busca o threadId através do LID
   */
  async getThreadIdByLid(agentId: string, lid: string): Promise<string | null> {
    logger.debug({ agentId, lid }, "Getting threadId by LID");

    const lidMappingKey = this.getLidMappingKey(agentId, lid);
    const threadId = await this.redis.get(lidMappingKey);

    if (threadId) {
      logger.debug({ agentId, lid, threadId }, "ThreadId found by LID");
    } else {
      logger.debug({ agentId, lid }, "ThreadId not found by LID");
    }

    return threadId;
  }

  /**
   * Verifica se uma thread existe
   */
  async threadExists(agentId: string, sender: string): Promise<boolean> {
    const threadKey = this.getThreadKey(agentId, sender);
    const exists = await this.redis.exists(threadKey);
    return exists === 1;
  }

  /**
   * Remove uma thread
   */
  async deleteThread(agentId: string, sender: string): Promise<void> {
    const threadKey = this.getThreadKey(agentId, sender);
    await this.redis.del(threadKey);
  }
}

export const redisThreadManager = new RedisThreadManager(redisConnection);
