import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "info";
const env = process.env.NODE_ENV || "development";

export function buildTransport(): pino.TransportMultiOptions {
  const stdOutTarget = {
    level: logLevel || "info",
    target: env === "development" ? "pino-pretty" : "pino/file",
    options:
      env === "development"
        ? {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          }
        : {},
  };

  return {
    targets: [stdOutTarget],
  };
}

export const baseLogger = pino({
  level: logLevel,
  transport: buildTransport(),
});
