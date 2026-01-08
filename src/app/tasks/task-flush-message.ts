import { RuntimeContext } from "@mastra/core/runtime-context";
import { AgentRuntime, mainAgent } from "../../mastra/agents/main-agent";
import { FlushEvent } from "../message/buffer";
import { UazapiApi } from "../../sdks/uazapi/uazapi-api";

export const taskFlushMessage = async (payload: FlushEvent): Promise<any> => {
  const { agent, contact, uazapi } = payload.metadata ?? {};

  if (!agent || !contact || !uazapi) {
    return;
  }

  const messagesJoined = payload.messages
    .map((message) => message.text)
    .join("\n");

  if (!contact.phone) {
    console.error("No phone number found for contact");
    return;
  }

  const runtimeContext = new RuntimeContext<AgentRuntime>();

  runtimeContext.set("model", agent.llm?.model);
  runtimeContext.set(
    "instructions",
    agent.systemPrompt || "You are a helpful assistant",
  );

  const response = await mainAgent.generate(messagesJoined, {
    runtimeContext,
    memory: {
      resource: contact.id,
      thread: payload.threadId,
    },
  });

  const uazapiApi = new UazapiApi({
    baseUrl: process.env.UAZAPI_BASE_URL!,
    adminToken: process.env.UAZAPI_ADMIN_TOKEN!,
    instanceToken: uazapi.token,
  });

  const sendMessagePayload = {
    number: contact.phone,
    text: response.text,
    delay: 1500,
    readchat: false,
    readmessages: false,
  };

  await uazapiApi.sendTextMessage({
    ...sendMessagePayload,
    text: response.text,
  });

  return response;
};
