export const cacheKeys = {
  agent: (id: string) => `agent:${id}`,
  agentInactive: (id: string) => `agent_inactive:${id}`,
  contact: (identifier: string) => `contact:${identifier}`,
  blacklistedContact: (agentId: string, identifier: string) =>
    `blacklisted_contact:${identifier}:${agentId}`,
  conversation: (contactId: string) => `conversation:${contactId}`,
};
