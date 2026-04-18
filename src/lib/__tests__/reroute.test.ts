import { describe, it, expect } from "vitest";
import { sortBucketsByPriority } from "@/lib/engine/reroute";

describe("sortBucketsByPriority", () => {
  type Bucket = { type: string; priority_order: number; id: string };

  it("sorts Debt→Savings→Food→Flex in canonical order", () => {
    const buckets: Bucket[] = [
      { id: "flex", type: "flex", priority_order: 0 },
      { id: "food", type: "food", priority_order: 0 },
      { id: "savings", type: "savings", priority_order: 0 },
      { id: "debt", type: "debt", priority_order: 0 },
    ];
    const sorted = sortBucketsByPriority(buckets);
    expect(sorted.map((b) => b.id)).toEqual(["debt", "savings", "food", "flex"]);
  });

  it("places custom buckets after flex, ordered by priority_order", () => {
    const buckets: Bucket[] = [
      { id: "custom-b", type: "custom", priority_order: 2 },
      { id: "flex", type: "flex", priority_order: 0 },
      { id: "custom-a", type: "custom", priority_order: 1 },
      { id: "debt", type: "debt", priority_order: 0 },
    ];
    const sorted = sortBucketsByPriority(buckets);
    expect(sorted.map((b) => b.id)).toEqual(["debt", "flex", "custom-a", "custom-b"]);
  });

  it("does not mutate the original array", () => {
    const buckets: Bucket[] = [
      { id: "flex", type: "flex", priority_order: 0 },
      { id: "debt", type: "debt", priority_order: 0 },
    ];
    const original = [...buckets];
    sortBucketsByPriority(buckets);
    expect(buckets).toEqual(original);
  });

  it("handles single bucket", () => {
    const buckets: Bucket[] = [{ id: "savings", type: "savings", priority_order: 0 }];
    expect(sortBucketsByPriority(buckets)).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(sortBucketsByPriority([])).toEqual([]);
  });

  it("Debt is first even with high priority_order", () => {
    const buckets: Bucket[] = [
      { id: "savings", type: "savings", priority_order: 0 },
      { id: "debt", type: "debt", priority_order: 99 },
    ];
    const sorted = sortBucketsByPriority(buckets);
    expect(sorted[0].id).toBe("debt");
  });
});
