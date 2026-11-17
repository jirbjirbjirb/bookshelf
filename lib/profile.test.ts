import {
  DidNotFoundError,
  PoorlyFormattedDidDocumentError,
  PoorlyFormattedDidError,
  UnsupportedDidMethodError,
} from "@atproto/identity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProfile } from "./profile";

const resolveHandle = vi.fn();
const resolveData = vi.fn();

vi.mock("./identity", () => ({
  idResolver: () => ({
    handle: { resolve: resolveHandle },
    did: { resolveAtprotoData: resolveData },
  }),
}));

const DID = "did:plc:abc";
const PDS = "https://pds.example.com";

describe("resolveProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("finds an account whose document names the handle", async () => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockResolvedValue({ handle: "alice.com", pds: PDS });
    expect(await resolveProfile("ALICE.com")).toEqual({
      status: "found",
      identity: { did: DID, handle: "alice.com", pds: PDS },
    });
  });

  it("accepts a document that spells the handle in another case", async () => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockResolvedValue({ handle: "Alice.com", pds: PDS });
    expect((await resolveProfile("alice.com")).status).toBe("found");
  });

  // A domain can point its DNS at any DID, so this is the impersonation case.
  it("refuses a handle the DID document does not name", async () => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockResolvedValue({ handle: "victim.com", pds: PDS });
    expect(await resolveProfile("attacker.com")).toEqual({ status: "unknown" });
  });

  it("does not call the resolver for a name that cannot be a handle", async () => {
    expect(await resolveProfile("foo.internal")).toEqual({ status: "unknown" });
    expect(resolveHandle).not.toHaveBeenCalled();
  });

  it("reads a handle with no DID as unknown", async () => {
    resolveHandle.mockResolvedValue(undefined);
    expect(await resolveProfile("alice.com")).toEqual({ status: "unknown" });
  });

  it("reads a missing DID document as unknown", async () => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockRejectedValue(new DidNotFoundError(DID));
    expect(await resolveProfile("alice.com")).toEqual({ status: "unknown" });
  });

  it.each([
    ["bad DID", new PoorlyFormattedDidError("x")],
    ["unsupported method", new UnsupportedDidMethodError("did:foo:x")],
    ["bad document", new PoorlyFormattedDidDocumentError("did:plc:abc", {})],
    ["tombstone", Object.assign(new Error("Gone"), { status: 410 })],
  ])("reads a permanent failure as unknown: %s", async (_, err) => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockRejectedValue(err);
    expect(await resolveProfile("alice.com")).toEqual({ status: "unknown" });
  });

  it("reads other failures as unavailable, not as a missing account", async () => {
    resolveHandle.mockResolvedValue(DID);
    resolveData.mockRejectedValue(new TypeError("fetch failed"));
    expect(await resolveProfile("alice.com")).toEqual({
      status: "unavailable",
    });
  });

  it("gives up on a lookup that never finishes", async () => {
    vi.useFakeTimers();
    resolveHandle.mockReturnValue(new Promise(() => {}));
    const lookup = resolveProfile("alice.com");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await lookup).toEqual({ status: "unavailable" });
  });
});
