import { Redis } from "ioredis";
import { redisConnection } from "../cache/redis";
import { generateId } from "../../utils/id";

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
  private readonly THREAD_TTL_SECONDS = 4 * 60 * 60; // 4 horas

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getThreadKey(agentId: string, sender: string): string {
    return `${this.THREAD_KEY_PREFIX}${agentId}:${sender}`;
  }

  /**
   * Busca uma thread existente
   */
  async getThread(agentId: string, sender: string): Promise<ThreadData | null> {
    const threadKey = this.getThreadKey(agentId, sender);
    const data = await this.redis.get(threadKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to parse thread data", { agentId, sender, error });
      return null;
    }
  }

  /**
   * Cria ou atualiza uma thread
   * Retorna o threadId
   */
  async getOrCreateThread(agentId: string, sender: string): Promise<string> {
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
