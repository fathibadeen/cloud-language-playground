import { describe, expect, it } from "vitest";
import { mapOmniSender } from "./whatsapp-omni-sync.server";
describe("omni sender mapping", () => {
  it("incoming is customer", () => expect(mapOmniSender({ message_type: 0 })).toBe("customer"));
  it("bot reply is ai", () => expect(mapOmniSender({ message_type: 1, sender_type: "AgentBot" })).toBe("ai"));
  it("staff reply is human", () => expect(mapOmniSender({ message_type: 1, sender_type: "User" })).toBe("human"));
  it("activity skipped", () => expect(mapOmniSender({ message_type: 2 })).toBeNull());
});
