import EM from "node:events";
import { TypedEventEmitter } from "../utils/event";
import { EventsType } from "../listeners";

class EventEmitterClass extends EM {}

type EventEmitterEvents = EventsType & {};

const eventEmitter =
  new EventEmitterClass() as TypedEventEmitter<EventEmitterEvents>;

export { eventEmitter };
