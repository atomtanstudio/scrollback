import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, getCategoryOptions } from "@/lib/default-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("uses unique slugs and names", () => {
    const slugs = DEFAULT_CATEGORIES.map((category) => category.slug);
    const names = DEFAULT_CATEGORIES.map((category) => category.name);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps category descriptions useful for classification", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.slug.length).toBeGreaterThanOrEqual(3);
      expect(category.description.length).toBeGreaterThan(20);
    }
  });

  it("seeds categories when none exist", async () => {
    const upserted: Array<{ slug: string }> = [];
    const db = {
      category: {
        findMany: async () => {
          if (upserted.length === 0) return [];
          return DEFAULT_CATEGORIES.map(({ slug, name, description }) => ({ slug, name, description }));
        },
        upsert: async ({ where }: { where: { slug: string } }) => {
          upserted.push({ slug: where.slug });
          return null;
        },
      },
    };

    const categories = await getCategoryOptions(db);
    expect(categories.length).toBe(DEFAULT_CATEGORIES.length);
    expect(upserted.length).toBe(DEFAULT_CATEGORIES.length);
  });
});
