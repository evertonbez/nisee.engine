import { err, ok } from "neverthrow";
import { getCacheJSON, setCacheJSON } from "../cache";
import { cacheKeys } from "../cache/keys";
import { db } from "../../db/client";
import { createContactQuery, getContactByRefIdQuery } from "../../db/queries";
import { Contact } from "../../db/schema";

type ContactParams = {
  refId: string;
  phone: string;
  name?: string;
  picture?: string;
  userId?: string;
};

export async function getOrCreateContact(
  agentId: string,
  params: ContactParams,
) {
  try {
    const contactFound = await getCacheJSON<Contact>(
      cacheKeys.contact(params.refId),
    );

    if (!contactFound) {
      let contact = await getContactByRefIdQuery(db, params.refId);

      if (!contact) {
        contact = await createContactQuery(db, {
          agentId,
          ...params,
        });

        if (!contact) {
          return ok(null);
        }

        await setCacheJSON(cacheKeys.contact(params.refId), contact, {
          ttl: 60 * 60 * 24 * 1,
        });
      }

      return ok(contact);
    }

    return ok(contactFound);
  } catch (error) {
    return err(
      new Error(error instanceof Error ? error.message : "Unknown error"),
    );
  }
}
