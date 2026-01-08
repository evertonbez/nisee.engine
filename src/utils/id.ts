import { customAlphabet } from "nanoid";
const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  22,
);

export const generateId = (): string => nanoid();
