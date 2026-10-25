import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, updateProposalReview, isProposalsConfigured, authConfiguredRef } = vi.hoisted(() => ({
  authMock: vi.fn(),
  updateProposalReview: vi.fn(),
  isProposalsConfigured: vi.fn(() => true),
  authConfiguredRef: { value: true },
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isAuthConfigured: () => authConfiguredRef.value };
});

vi.mock("@/lib/connectors/proposals", () => ({
  updateProposalReview,
  isProposalsConfigured,
}));

import { PATCH } from "./route";

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/proposals/page-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const params = Promise.resolve({ id: "page-1" });

beforeEach(() => {
  authConfiguredRef.value = true;
  authMock.mockReset();
  updateProposalReview.mockReset();
  isProposalsConfigured.mockReset();
  isProposalsConfigured.mockReturnValue(true);
});

describe("PATCH /api/proposals/[id] — authorization", () => {
  it("returns 401 without writing to Notion when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await PATCH(patchReq({ reviewStatus: "In Review" }), { params });
    expect(res.status).toBe(401);
    expect(updateProposalReview).not.toHaveBeenCalled();
  });

  it("persists the review update for an authenticated session", async () => {
    authMock.mockResolvedValue({ user: { email: "partner@apex-meridian-group.com" } });
    updateProposalReview.mockResolvedValue(undefined);
    const res = await PATCH(
      patchReq({ reviewStatus: "Reviewed", decision: "Approved Direction", decisionRationale: "Aligned." }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(updateProposalReview).toHaveBeenCalledWith("page-1", expect.objectContaining({
      reviewStatus: "Reviewed",
      decision: "Approved Direction",
    }));
  });

  it("bypasses the gate when auth isn't configured, matching the sitewide middleware fallback", async () => {
    authConfiguredRef.value = false;
    updateProposalReview.mockResolvedValue(undefined);
    const res = await PATCH(patchReq({ reviewStatus: "In Review" }), { params });
    expect(res.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid decision value even when authenticated, before writing", async () => {
    authMock.mockResolvedValue({ user: { email: "partner@apex-meridian-group.com" } });
    const res = await PATCH(patchReq({ decision: "Not A Real Decision" }), { params });
    expect(res.status).toBe(400);
    expect(updateProposalReview).not.toHaveBeenCalled();
  });
});
