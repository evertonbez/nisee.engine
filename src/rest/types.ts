import type { auth } from "@api/lib/auth";

export type Context = {
  Variables: {
    session: typeof auth.$Infer.Session | null;
    user: typeof auth.$Infer.Session.user | null;
  };
};
