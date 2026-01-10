import { TaskRegisterUsagePayload } from "../app/tasks/task-register-usage";

export * from "./on-flush-message";
export * from "./on-register-usage";

export type EventsType = {
  onRegisterUsage: (payload: TaskRegisterUsagePayload) => Promise<void>;
};
