import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";
import {
  createProposal,
  findRecentDuplicateTitle,
  isProposalsConfigured,
  submitProposal,
  updateProposalReview,
} from "./proposals";

/**
 * Exercises the Notion-writing side of proposals.ts (create/update/duplicate
 * detection) against a mocked `@notionhq/client` — there is no live Notion
 * workspace reachable from this sandbox, so these assert the request shape
 * and defaulting logic, not a verified live write.
 */

const dataSourcesQuery = vi.fn();
const pagesCreate = vi.fn();
const pagesUpdate = vi.fn();

vi.mock("@notionhq/client", () => ({
  Client: class {
    dataSources = { query: dataSourcesQuery };
    pages = { create: pagesCreate, update: pagesUpdate };
  },
}));

function configureNotion() {
  env.NOTION_API_KEY = "secret_test_token";
}
function unconfigureNotion() {
  env.NOTION_API_KEY = undefined;
}

describe("proposals — Notion write layer", () => {
  const originalKey = env.NOTION_API_KEY;

  beforeEach(() => {
    dataSourcesQuery.mockReset();
    pagesCreate.mockReset();
    pagesUpdate.mockReset();
  });
  afterEach(() => {
    env.NOTION_API_KEY = originalKey;
  });

  describe("not configured", () => {
    beforeEach(() => unconfigureNotion());

    it("isProposalsConfigured() is false and createProposal rejects without calling Notion", async () => {
      expect(isProposalsConfigured()).toBe(false);
      await expect(createProposal({ title: "X" })).rejects.toThrow("NOTION_API_KEY");
      expect(pagesCreate).not.toHaveBeenCalled();
    });
  });

  describe("createProposal — governance defaults", () => {
    beforeEach(() => configureNotion());

    it("defaults Status/Review Status/Decision so a new submission is never left unclassified", async () => {
      pagesCreate.mockResolvedValue({ id: "new-page", url: "https://notion.so/new-page", properties: {} });

      await createProposal({ title: "New idea" });

      expect(pagesCreate).toHaveBeenCalledTimes(1);
      const call = pagesCreate.mock.calls[0][0];
      expect(call.properties.Status).toEqual({ select: { name: "Inbox" } });
      expect(call.properties["Review Status"]).toEqual({ select: { name: "Not Reviewed" } });
      expect(call.properties.Decision).toEqual({ select: { name: "Pending" } });
      expect(call.properties.Title).toEqual({ title: [{ text: { content: "New idea" } }] });
    });

    it("rejects an empty/whitespace-only title without calling Notion", async () => {
      await expect(createProposal({ title: "   " })).rejects.toThrow("title required");
      expect(pagesCreate).not.toHaveBeenCalled();
    });

    it("includes optional fields only when provided", async () => {
      pagesCreate.mockResolvedValue({ id: "p2", url: "https://notion.so/p2", properties: {} });

      await createProposal({ title: "With extras", submittedBy: "Jane", driveLink: "https://drive/x" });

      const call = pagesCreate.mock.calls[0][0];
      expect(call.properties["Submitted By"]).toEqual({ rich_text: [{ text: { content: "Jane" } }] });
      expect(call.properties["Drive Link"]).toEqual({ url: "https://drive/x" });
      expect(call.properties.Brand).toBeUndefined();
      expect(call.properties.Domain).toBeUndefined();
    });
  });

  describe("findRecentDuplicateTitle — retry/double-submit guard", () => {
    beforeEach(() => configureNotion());

    it("finds a same-title record created moments ago, keyed on Notion's system created_time", async () => {
      dataSourcesQuery.mockResolvedValue({
        results: [
          {
            id: "existing",
            url: "https://notion.so/existing",
            created_time: new Date().toISOString(),
            properties: {
              Title: { title: [{ plain_text: "Duplicate Me" }] },
            },
          },
        ],
        next_cursor: null,
      });

      const dup = await findRecentDuplicateTitle("duplicate me");
      expect(dup?.notionId).toBe("existing");
    });

    it("still catches a recent duplicate even when the manual 'Created' property is blank — the exact gap being fixed", async () => {
      dataSourcesQuery.mockResolvedValue({
        results: [
          {
            id: "existing-no-manual-date",
            url: "https://notion.so/existing-no-manual-date",
            created_time: new Date().toISOString(),
            properties: {
              Title: { title: [{ plain_text: "No Manual Date" }] },
              // No "Created" property on this row at all.
            },
          },
        ],
        next_cursor: null,
      });

      const dup = await findRecentDuplicateTitle("no manual date");
      expect(dup?.notionId).toBe("existing-no-manual-date");
    });

    it("does not flag a same-title record created long ago", async () => {
      dataSourcesQuery.mockResolvedValue({
        results: [
          {
            id: "old",
            url: "https://notion.so/old",
            created_time: "2020-01-01T00:00:00.000Z",
            properties: {
              Title: { title: [{ plain_text: "Old Idea" }] },
            },
          },
        ],
        next_cursor: null,
      });

      expect(await findRecentDuplicateTitle("old idea")).toBeNull();
    });

    it("returns null when no title matches", async () => {
      dataSourcesQuery.mockResolvedValue({ results: [], next_cursor: null });
      expect(await findRecentDuplicateTitle("nothing here")).toBeNull();
    });
  });

  describe("submitProposal — concurrent-request coalescing", () => {
    beforeEach(() => configureNotion());

    it("two simultaneous submissions of the identical title result in exactly one Notion page create", async () => {
      dataSourcesQuery.mockResolvedValue({ results: [], next_cursor: null });
      pagesCreate.mockResolvedValue({ id: "created-once", url: "https://notion.so/created-once", properties: {} });

      // Fired back-to-back, with neither awaited first — the in-flight map
      // entry for this title is set synchronously inside submitProposal
      // before either call's first `await` yields, so the second call sees
      // the first's in-flight promise already registered and joins it
      // rather than racing it with its own independent read-then-create.
      const first = submitProposal({ title: "Race Condition Idea" });
      const second = submitProposal({ title: "race condition idea" }); // different case, same normalized key

      const [a, b] = await Promise.all([first, second]);
      expect(pagesCreate).toHaveBeenCalledTimes(1);
      expect(a.proposal.notionId).toBe("created-once");
      expect(b.proposal.notionId).toBe("created-once");
      expect(a.duplicate).toBe(false);
      expect(b.duplicate).toBe(false);
    });

    it("a second submission after the first has already landed is reported as a duplicate, not a second create", async () => {
      dataSourcesQuery.mockResolvedValue({ results: [], next_cursor: null });
      pagesCreate.mockResolvedValue({ id: "landed", url: "https://notion.so/landed", properties: {} });

      await submitProposal({ title: "Sequential Idea" });

      // Now the "database" has the record — a fresh query reflects it.
      dataSourcesQuery.mockResolvedValue({
        results: [
          {
            id: "landed",
            url: "https://notion.so/landed",
            created_time: new Date().toISOString(),
            properties: { Title: { title: [{ plain_text: "Sequential Idea" }] } },
          },
        ],
        next_cursor: null,
      });

      const result = await submitProposal({ title: "Sequential Idea" });
      expect(result.duplicate).toBe(true);
      expect(pagesCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateProposalReview — review-decision persistence", () => {
    beforeEach(() => configureNotion());

    it("writes only the fields provided, leaving others untouched", async () => {
      pagesUpdate.mockResolvedValue({});

      await updateProposalReview("page-1", { reviewStatus: "Reviewed", decision: "Approved Direction" });

      expect(pagesUpdate).toHaveBeenCalledTimes(1);
      const call = pagesUpdate.mock.calls[0][0];
      expect(call.page_id).toBe("page-1");
      expect(call.properties["Review Status"]).toEqual({ select: { name: "Reviewed" } });
      expect(call.properties.Decision).toEqual({ select: { name: "Approved Direction" } });
      expect(call.properties["Decision Rationale"]).toBeUndefined();
    });

    it("is a no-op (no Notion call) when given no fields", async () => {
      await updateProposalReview("page-1", {});
      expect(pagesUpdate).not.toHaveBeenCalled();
    });
  });
});
