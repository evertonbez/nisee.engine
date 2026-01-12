import { EventEmitter } from "node:events";
import { Redis } from "ioredis";
import { redisConnection } from "../cache/redis";
import { Agent, Contact } from "../../db/schema";
import { baseLogger } from "../../observability/logger";

const logger = baseLogger.child({ component: "RedisBufferMessage" });

interface BufferedMessage {
  messageId: string;
  text: string;
  mediaType: string;
  type: string;
}

interface BufferData {
  messages: BufferedMessage[];
  expiresAt: number;
  awaitingUserInput?: boolean;
}

export type UserActivityStatus = "await" | "ready";

interface Metadata {
  agent: Agent;
  contact: Contact;
  uazapi: {
    token: string;
  };
}

export interface FlushEvent {
  threadId: string;
  messages: BufferedMessage[];
  messageCount: number;
  metadata: Metadata | null;
}

export class RedisBufferMessage extends EventEmitter {
  declare on: (event: "flush", listener: (payload: FlushEvent) => void) => this;
  declare emit: (event: "flush", payload: FlushEvent) => boolean;

  private redis: Redis;
  private subscriber: Redis;
  private expirySubscriber: Redis;

  private readonly BUFFER_KEY_PREFIX = "msg_buffer:";
  private readonly CHANNEL_PREFIX = "msg_buffer_flush:";
  private readonly BUFFER_DATA_PREFIX = "msg_buffer_data:";
  private readonly BUFFER_METADATA_PREFIX = "msg_buffer_metadata:";
  private readonly LOCK_KEY_PREFIX = "msg_buffer_lock:";
  private readonly ACTIVITY_STATUS_PREFIX = "msg_buffer_activity:";
  private readonly LOCK_TTL_MS = 30000;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.subscriber = redis.duplicate();
    this.expirySubscriber = redis.duplicate();
    logger.info("RedisBufferMessage initialized");

    this.setupSubscriber();
    this.setupExpiryNotifications();
  }

  private async setupSubscriber(): Promise<void> {
    await this.subscriber.psubscribe(`${this.CHANNEL_PREFIX}*`);

    this.subscriber.on("pmessage", async (_pattern, channel, _message) => {
      const threadId = channel.replace(this.CHANNEL_PREFIX, "");
      await this.handleFlushNotification(threadId);
    });
  }

  private async setupExpiryNotifications(): Promise<void> {
    try {
      await this.redis.config("SET", "notify-keyspace-events", "Ex");
      const expiryPattern = `__keyevent@0__:expired`;
      await this.expirySubscriber.psubscribe(expiryPattern);

      this.expirySubscriber.on("pmessage", async (_pattern, _channel, key) => {
        logger.debug({ key }, "Expiry notification received");
        if (key.startsWith(this.BUFFER_KEY_PREFIX)) {
          const threadId = key.replace(this.BUFFER_KEY_PREFIX, "");
          logger.debug({ threadId }, "Publishing flush for expired buffer");
          await this.redis.publish(this.getChannelName(threadId), "flush");
        }
      });
    } catch (error) {
      logger.error(
        { error },
        "Failed to setup expiry notifications, falling back to polling only",
      );
    }
  }

  private getBufferKey(threadId: string): string {
    return `${this.BUFFER_KEY_PREFIX}${threadId}`;
  }

  private getBufferDataKey(threadId: string): string {
    return `${this.BUFFER_DATA_PREFIX}${threadId}`;
  }

  private getBufferMetadataKey(threadId: string): string {
    return `${this.BUFFER_METADATA_PREFIX}${threadId}`;
  }

  private getChannelName(threadId: string): string {
    return `${this.CHANNEL_PREFIX}${threadId}`;
  }

  private getLockKey(threadId: string): string {
    return `${this.LOCK_KEY_PREFIX}${threadId}`;
  }

  private getActivityStatusKey(threadId: string): string {
    return `${this.ACTIVITY_STATUS_PREFIX}${threadId}`;
  }

  async getBufferData(threadId: string): Promise<BufferData | null> {
    const bufferDataKey = this.getBufferDataKey(threadId);
    const data = await this.redis.get(bufferDataKey);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async getMetadata(threadId: string): Promise<Metadata | null> {
    const bufferMetadataKey = this.getBufferMetadataKey(threadId);
    const data = await this.redis.get(bufferMetadataKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      logger.warn({ threadId, error }, "Failed to parse metadata");
      return null;
    }
  }

  private async acquireLock(
    threadId: string,
    ttlMs: number = this.LOCK_TTL_MS,
  ): Promise<boolean> {
    const lockKey = this.getLockKey(threadId);
    const lockValue = `${process.pid}-${Date.now()}`;

    const result = await this.redis.set(lockKey, lockValue, "PX", ttlMs, "NX");
    return result === "OK";
  }

  private async releaseLock(conversationId: string): Promise<void> {
    const lockKey = this.getLockKey(conversationId);
    await this.redis.del(lockKey);
  }

  private async handleFlushNotification(threadId: string): Promise<void> {
    logger.debug({ threadId }, "Handling flush notification");

    const lockAcquired = await this.acquireLock(threadId);

    if (!lockAcquired) {
      logger.debug({ threadId }, "Could not acquire lock, skipping flush");
      return;
    }

    try {
      await this.flush(threadId);
    } finally {
      await this.releaseLock(threadId);
    }
  }

  private async flush(threadId: string): Promise<void> {
    logger.info({ threadId }, "Starting buffer flush");
    const bufferKey = this.getBufferKey(threadId);
    const bufferDataKey = this.getBufferDataKey(threadId);
    const activityStatusKey = this.getActivityStatusKey(threadId);
    const bufferMetadataKey = this.getBufferMetadataKey(threadId);

    try {
      const [bufferData, activityStatus, bufferMetadata] = await Promise.all([
        this.getBufferData(threadId),
        this.redis.get(activityStatusKey),
        this.getMetadata(threadId),
      ]);

      if (!bufferData) {
        logger.debug({ threadId }, "No buffer data found, skipping flush");
        return;
      }

      if (bufferData.messages.length === 0) {
        logger.debug({ threadId }, "Buffer is empty, skipping flush");
        return;
      }

      // Se o usuário está digitando ou gravando áudio, não faz flush
      if (
        bufferData.awaitingUserInput ||
        activityStatus === "typing" ||
        activityStatus === "recording"
      ) {
        logger.info(
          {
            threadId,
            activityStatus,
            awaitingUserInput: bufferData.awaitingUserInput,
          },
          "Buffer flush paused - user is active",
        );

        // Renova o TTL do buffer para manter as mensagens
        const defaultTtlMs = 10000;
        const ttlSeconds = Math.ceil(defaultTtlMs / 1000);
        await this.redis.setex(bufferKey, ttlSeconds, threadId);

        return;
      }

      const flushEvent: FlushEvent = {
        threadId: threadId,
        messages: bufferData.messages,
        messageCount: bufferData.messages.length,
        metadata: bufferMetadata,
      };

      logger.info(
        { threadId, messageCount: bufferData.messages.length },
        "Emitting flush event",
      );

      this.emit("flush", flushEvent);

      await this.redis.del(
        bufferKey,
        bufferDataKey,
        activityStatusKey,
        bufferMetadataKey,
      );

      logger.debug({ threadId }, "Buffer cleaned after flush");
    } catch (error) {
      logger.error({ threadId, error }, "Error during flush");
    }
  }

  public async addMessage(
    threadId: string,
    message: BufferedMessage,
    metadata?: Metadata,
    ttlMs: number = 3000,
  ): Promise<void> {
    logger.debug(
      {
        threadId,
        messageId: message.messageId,
        mediaType: message.mediaType,
        ttlMs,
      },
      "Adding message to buffer",
    );

    const bufferKey = this.getBufferKey(threadId);
    const bufferDataKey = this.getBufferDataKey(threadId);
    const bufferMetadataKey = this.getBufferMetadataKey(threadId);

    try {
      const existingBuffer = await this.getBufferData(threadId);
      const isNewBuffer = !existingBuffer;

      const bufferData: BufferData = {
        expiresAt: Date.now() + ttlMs,
        messages: isNewBuffer
          ? [message]
          : [...existingBuffer.messages, message],
        awaitingUserInput: existingBuffer?.awaitingUserInput,
      };

      await this.redis.set(
        bufferDataKey,
        JSON.stringify(bufferData),
        "EX",
        3600,
      );

      const ttlSeconds = Math.ceil(ttlMs / 1000) + 2;

      await this.redis.setex(bufferKey, ttlSeconds, threadId);

      if (isNewBuffer && metadata) {
        await this.redis.set(bufferMetadataKey, JSON.stringify(metadata));
        logger.debug({ threadId }, "New buffer created with metadata");
      }

      logger.info(
        {
          threadId,
          messageId: message.messageId,
          totalMessages: bufferData.messages.length,
          ttlSeconds,
        },
        "Message added to buffer",
      );
    } catch (error) {
      logger.error(
        { threadId, messageId: message.messageId, error },
        "Failed to add message to buffer",
      );
      throw error;
    }
  }

  /**
   * Define o status de atividade do usuário (digitando, gravando áudio, pausado)
   * Chamado pelo webhook quando recebe eventos de status
   */
  public async setUserActivityStatus(
    threadId: string,
    status: UserActivityStatus,
  ): Promise<void> {
    logger.debug({ threadId, status }, "Setting user activity status");

    const activityStatusKey = this.getActivityStatusKey(threadId);
    const bufferDataKey = this.getBufferDataKey(threadId);

    try {
      if (status === "ready") {
        await this.redis.del(activityStatusKey);

        const existingBuffer = await this.getBufferData(threadId);
        if (existingBuffer) {
          existingBuffer.awaitingUserInput = false;
          await this.redis.set(
            bufferDataKey,
            JSON.stringify(existingBuffer),
            "EX",
            3600,
          );
        }

        const bufferKey = this.getBufferKey(threadId);
        const exists = await this.redis.exists(bufferKey);
        if (exists) {
          await this.redis.setex(bufferKey, 4, threadId);
          logger.debug({ threadId }, "Buffer TTL set to 4s for flush");
        }
      } else {
        await this.redis.set(activityStatusKey, status, "EX", 15);

        const existingBuffer = await this.getBufferData(threadId);
        if (existingBuffer) {
          existingBuffer.awaitingUserInput = true;
          await this.redis.set(
            bufferDataKey,
            JSON.stringify(existingBuffer),
            "EX",
            3600,
          );
        }
      }

      logger.info({ threadId, status }, "User activity status set");
    } catch (error) {
      logger.error(
        { threadId, status, error },
        "Failed to set user activity status",
      );
      throw error;
    }
  }

  /**
   * Obtém o status de atividade atual do usuário
   */
  public async getUserActivityStatus(
    threadId: string,
  ): Promise<UserActivityStatus | null> {
    const activityStatusKey = this.getActivityStatusKey(threadId);
    const status = await this.redis.get(activityStatusKey);
    return status as UserActivityStatus | null;
  }
}

export const bufferMessageService = new RedisBufferMessage(redisConnection);
