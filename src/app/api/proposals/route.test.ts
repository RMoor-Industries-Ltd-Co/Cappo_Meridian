import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Exercises the explicit session gate on /api/proposals at the route-handler
 * level — independent of (and in addition to) the sitewide middleware.ts
 * redirect, which this test setup doesn't run. The Notion-facing connector
 * itself is mocked; its own behavior is covered by
 * src/lib/connectors/proposals.test.ts and proposalsApi.test.ts.
 */

const { authMock, listProposals, submitProposal, isProposalsConfigured, authConfiguredRef } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listProposals: vi.fn(),
  submitProposal: vi.fn(),
  isProposalsConfigured: vi.fn(() => true),
  authConfiguredRef: { value: true },
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isAuthConfigured: () => authConfiguredRef.value };
});

vi.mock("@/lib/connectors/proposals", () => ({
  listProposals,
  submitProposal,
  isProposalsConfigured,
  groupByTab: (proposals: unknown[]) => ({ overview: [], ideas: proposals, reviewed: [] }),
}));

import { GET, POST } from "./route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authConfiguredRef.value = true;
  authMock.mockReset();
  listProposals.mockReset();
  submitProposal.mockReset();
  isProposalsConfigured.mockReset();
  isProposalsConfigured.mockReturnValue(true);
});

describe("GET /api/proposals — authorization", () => {
  it("returns 401 without calling Notion when auth is configured and there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listProposals).not.toHaveBeenCalled();
  });

  it("returns the proposal tabs for an authenticated session", async () => {
    authMock.mockResolvedValue({ user: { email: "partner@apex-meridian-group.com" } });
    listProposals.mockResolvedValue([{ notionId: "a" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.tabs.ideas).toHaveLength(1);
  });

  it("bypasses the gate when auth isn't configured at all — matches the sitewide middleware's own always-browsable fallback", async () => {
    authConfiguredRef.value = false;
    listProposals.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/proposals — authorization", () => {
  it("returns 401 without touching Notion when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(postReq({ title: "New idea" }));
    expect(res.status).toBe(401);
    expect(submitProposal).not.toHaveBeenCalled();
  });

  it("submits the proposal for an authenticated session", async () => {
    authMock.mockResolvedValue({ user: { email: "partner@apex-meridian-group.com" } });
    submitProposal.mockResolvedValue({ proposal: { notionId: "new-page" }, duplicate: false });
    const res = await POST(postReq({ title: "New idea" }));
    expect(res.status).toBe(200);
    expect(submitProposal).toHaveBeenCalledTimes(1);
  });

  it("still 400s on a missing title even when authenticated — validation happens after the auth gate, not instead of it", async () => {
    authMock.mockResolvedValue({ user: { email: "partner@apex-meridian-group.com" } });
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(submitProposal).not.toHaveBeenCalled();
  });
});
