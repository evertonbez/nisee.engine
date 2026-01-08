import { eq } from "drizzle-orm";
import { Database } from "../client";
import { contacts } from "../schema";

export async function getContactByIdQuery(db: Database, id: string) {
  return db.query.contacts.findFirst({
    where: eq(contacts.id, id),
  });
}

export async function getContactByRefIdQuery(db: Database, id: string) {
  return db.query.contacts.findFirst({
    where: eq(contacts.refId, id),
  });
}

interface CreateContactParams {
  agentId: string;
  refId: string;
  phone: string;
  name?: string;
  picture?: string;
  userId?: string;
  active?: boolean;
}

export async function createContactQuery(
  db: Database,
  params: CreateContactParams,
) {
  const [result] = await db
    .insert(contacts)
    .values({
      refId: params.refId,
      agentId: params.agentId,
      name: params.name,
      picture: params.picture,
      phone: params.phone,
      active: params.active ?? true,
    })
    .returning();

  return result;
}
