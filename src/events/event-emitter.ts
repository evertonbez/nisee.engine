import EM from "node:events";
import { TypedEventEmitter } from "../utils/event";

// import type { MessagesEvents } from "@worker/listeners/on-received-message";

class EventEmitterClass extends EM {}

type EventEmitterEvents = {};

const eventEmitter =
  new EventEmitterClass() as TypedEventEmitter<EventEmitterEvents>;

export { eventEmitter };
