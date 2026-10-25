import { describe, expect, it } from "vitest";
import {
  groupByTab,
  mapProposal,
  tabFor,
  type NRow,
  type Proposal,
} from "./proposals";

function row(properties: NRow["properties"]): NRow {
  return { id: "row-1", url: "https://notion.so/row-1", properties };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    notionId: "p-1",
    url: "https://notion.so/p-1",
    title: "Some Proposal",
    type: "Idea",
    status: "Inbox",
    reviewStatus: "Not Reviewed",
    decision: "Pending",
    decisionRationale: "",
    submittedBy: "",
    reviewOwner: "",
    sourcePage: null,
    driveLink: null,
    notes: "",
    brandIds: [],
    domainIds: [],
    relatedInitiativeIds: [],
    created: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapProposal — real Notion-row parsing against the live Capture/Ideas schema", () => {
  it("maps a fully-populated row, preserving the Notion page id", () => {
    const mapped = mapProposal(
      row({
        Title: { title: [{ plain_text: "Financial Management Expansion" }] },
        Type: { select: { name: "Idea" } },
        Status: { select: { name: "Inbox" } },
        "Review Status": { select: { name: "Reviewed" } },
        Decision: { select: { name: "Approved Direction" } },
        "Decision Rationale": { rich_text: [{ plain_text: "Both Founders aligned." }] },
        "Submitted By": { rich_text: [{ plain_text: "Founder 88" }] },
        "Review Owner": { rich_text: [{ plain_text: "AMG Founders" }] },
        "Source Page": { url: "https://app.notion.com/p/402e4a15" },
        "Drive Link": { url: null },
        Brand: { relation: [{ id: "brand-1" }] },
        Domain: { relation: [{ id: "domain-1" }] },
        "Related Initiative": { relation: [] },
      }),
    );
    expect(mapped.notionId).toBe("row-1");
    expect(mapped.title).toBe("Financial Management Expansion");
    expect(mapped.reviewStatus).toBe("Reviewed");
    expect(mapped.decision).toBe("Approved Direction");
    expect(mapped.decisionRationale).toBe("Both Founders aligned.");
    expect(mapped.submittedBy).toBe("Founder 88");
    expect(mapped.sourcePage).toBe("https://app.notion.com/p/402e4a15");
    expect(mapped.driveLink).toBeNull();
    expect(mapped.brandIds).toEqual(["brand-1"]);
  });

  it("a row with no Review Status set maps to an empty string, never a fabricated value", () => {
    const mapped = mapProposal(row({ Title: { title: [{ plain_text: "Legacy idea" }] } }));
    expect(mapped.reviewStatus).toBe("");
    expect(mapped.decision).toBe("");
    expect(mapped.decisionRationale).toBe("");
  });

  it("a row with no title maps to an empty title, never dropped or guessed", () => {
    const mapped = mapProposal(row({ Status: { select: { name: "Inbox" } } }));
    expect(mapped.title).toBe("");
    expect(mapped.notionId).toBe("row-1");
  });
});

describe("tabFor / groupByTab — every proposal lands in exactly one tab", () => {
  it("'In Review' goes to Overview", () => {
    expect(tabFor(makeProposal({ reviewStatus: "In Review" }))).toBe("overview");
  });

  it("'Reviewed' goes to Reviewed", () => {
    expect(tabFor(makeProposal({ reviewStatus: "Reviewed" }))).toBe("reviewed");
  });

  it("'Not Reviewed' goes to Ideas", () => {
    expect(tabFor(makeProposal({ reviewStatus: "Not Reviewed" }))).toBe("ideas");
  });

  it("an empty/legacy Review Status also goes to Ideas — directive's 'is empty' clause", () => {
    expect(tabFor(makeProposal({ reviewStatus: "" }))).toBe("ideas");
  });

  it("groupByTab partitions a mixed set with no proposal appearing twice or nowhere", () => {
    const proposals = [
      makeProposal({ notionId: "a", reviewStatus: "In Review" }),
      makeProposal({ notionId: "b", reviewStatus: "Reviewed" }),
      makeProposal({ notionId: "c", reviewStatus: "Not Reviewed" }),
      makeProposal({ notionId: "d", reviewStatus: "" }),
    ];
    const tabs = groupByTab(proposals);
    expect(tabs.overview.map((p) => p.notionId)).toEqual(["a"]);
    expect(tabs.reviewed.map((p) => p.notionId)).toEqual(["b"]);
    expect(tabs.ideas.map((p) => p.notionId)).toEqual(["c", "d"]);
    const total = tabs.overview.length + tabs.ideas.length + tabs.reviewed.length;
    expect(total).toBe(proposals.length);
  });

  it("the Founder-aligned Financials proposal (Reviewed + Approved Direction) surfaces in Reviewed", () => {
    const financials = makeProposal({
      notionId: "financials-proposal",
      title: "Cappo Meridian — Financial Management Expansion",
      reviewStatus: "Reviewed",
      decision: "Approved Direction",
      decisionRationale:
        "Both AMG Founders aligned on the Financials concept in the 2026-10-25 meeting.",
    });
    const tabs = groupByTab([financials]);
    expect(tabs.reviewed).toHaveLength(1);
    expect(tabs.reviewed[0].decision).toBe("Approved Direction");
    expect(tabs.overview).toHaveLength(0);
    expect(tabs.ideas).toHaveLength(0);
  });
});
