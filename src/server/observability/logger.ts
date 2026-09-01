import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const redact = (context: Context): Context => Object.fromEntries(Object.entries(context).map(([key, value]) => [key, /password|secret|token|authorization|cookie/i.test(key) ? "[REDACTED]" : value]));

const write = (level: LogLevel, message: string, context: Context = {}) => {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redact(context) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
};

export const logger = {
  debug: (message: string, context?: Context) => write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  error: (message: string, context?: Context) => write("error", message, context)
};

