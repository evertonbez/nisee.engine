import { bufferMessageService, FlushEvent } from "../app/message/buffer";
import { taskFlushMessage } from "../app/tasks/task-flush-message";
import { baseLogger } from "../observability/logger";
import { withRetry } from "../utils/retry";

const logger = baseLogger.child({ component: "Listener" });

logger.info("listener onFlush");

bufferMessageService.on("flush", async (payload: FlushEvent) => {
  const res = await withRetry(() => taskFlushMessage(payload), {
    maxRetries: 3,
    delay: 500,
  });
});
