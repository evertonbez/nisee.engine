import { taskRegisterUsage } from "../app/tasks/task-register-usage";
import { eventEmitter } from "../events/event-emitter";
import { baseLogger } from "../observability/logger";
import { withRetry } from "../utils/retry";

const logger = baseLogger.child({ component: "Listener" });

logger.info("listener onRegisterUsage");

eventEmitter.on("onRegisterUsage", async (payload) => {
  const res = await withRetry(() => taskRegisterUsage(payload), {
    maxRetries: 3,
    delay: 500,
  });
});
