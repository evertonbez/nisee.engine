import { redisConnection } from "./redis";

export interface CacheOptions {
  ttl?: number;
}

export async function getCacheValue(key: string): Promise<string | null> {
  try {
    const value = await redisConnection.get(key);
    return value;
  } catch (error) {
    console.error(`Erro ao obter cache para chave ${key}:`, error);
    return null;
  }
}

export async function getCacheJSON<T>(key: string): Promise<T | null> {
  try {
    const value = await redisConnection.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Erro ao obter cache JSON para chave ${key}:`, error);
    return null;
  }
}

export async function setCacheValue(
  key: string,
  value: string,
  options?: CacheOptions,
): Promise<boolean> {
  try {
    if (options?.ttl) {
      await redisConnection.setex(key, options.ttl, value);
    } else {
      await redisConnection.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`Erro ao definir cache para chave ${key}:`, error);
    return false;
  }
}

export async function setCacheJSON(
  key: string,
  value: unknown,
  options?: CacheOptions,
): Promise<boolean> {
  try {
    const jsonString = JSON.stringify(value);
    return await setCacheValue(key, jsonString, options);
  } catch (error) {
    console.error(`Erro ao definir cache JSON para chave ${key}:`, error);
    return false;
  }
}

export async function deleteCacheKey(key: string): Promise<boolean> {
  try {
    const result = await redisConnection.del(key);
    return result > 0;
  } catch (error) {
    console.error(`Erro ao deletar cache para chave ${key}:`, error);
    return false;
  }
}

export async function deleteCacheKeys(keys: string[]): Promise<number> {
  try {
    if (keys.length === 0) return 0;
    const result = await redisConnection.del(...keys);
    return result;
  } catch (error) {
    console.error(`Erro ao deletar múltiplas chaves do cache:`, error);
    return 0;
  }
}

export async function cacheKeyExists(key: string): Promise<boolean> {
  try {
    const result = await redisConnection.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`Erro ao verificar existência da chave ${key}:`, error);
    return false;
  }
}

export async function getCacheTTL(key: string): Promise<number> {
  try {
    return await redisConnection.ttl(key);
  } catch (error) {
    console.error(`Erro ao obter TTL da chave ${key}:`, error);
    return -2;
  }
}

export async function setCacheTTL(key: string, ttl: number): Promise<boolean> {
  try {
    const result = await redisConnection.expire(key, ttl);
    return result === 1;
  } catch (error) {
    console.error(`Erro ao definir TTL para chave ${key}:`, error);
    return false;
  }
}

export async function clearAllCache(): Promise<boolean> {
  try {
    await redisConnection.flushdb();
    console.info("Cache completamente limpo");
    return true;
  } catch (error) {
    console.error("Erro ao limpar o cache:", error);
    return false;
  }
}

export async function getCacheInfo(): Promise<Record<string, unknown> | null> {
  try {
    const info = await redisConnection.info();
    return { connected: true, info };
  } catch (error) {
    console.error("Erro ao obter informações do Redis:", error);
    return null;
  }
}
