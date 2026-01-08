import { bufferMessageService, FlushEvent } from "../app/message/buffer";
import { taskFlushMessage } from "../app/tasks/task-flush-message";
import { withRetry } from "../utils/retry";

console.log("listener on-flush-message");

bufferMessageService.on("flush", async (payload: FlushEvent) => {
  const res = await withRetry(() => taskFlushMessage(payload), {
    maxRetries: 3,
    delay: 500,
  });
});
