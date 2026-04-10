export type DefaultCategory = {
  slug: string;
  name: string;
  description: string;
};

export type CategoryOption = DefaultCategory;

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    slug: "ai-art",
    name: "AI Art",
    description: "AI image generation, digital illustration, prompt sharing, style references, and art workflows.",
  },
  {
    slug: "ai-video",
    name: "AI Video",
    description: "AI video generation, animation workflows, motion studies, cinematic clips, and video model prompts.",
  },
  {
    slug: "llms",
    name: "LLMs",
    description: "Large language models, model releases, evaluations, reasoning, fine-tuning, and model comparisons.",
  },
  {
    slug: "ai-agents",
    name: "AI Agents",
    description: "Agentic systems, tool-using assistants, automation loops, orchestration, and autonomous workflows.",
  },
  {
    slug: "prompting",
    name: "Prompting",
    description: "Prompt engineering, system prompts, prompt templates, structured prompting, and prompting techniques.",
  },
  {
    slug: "software-engineering",
    name: "Software Engineering",
    description: "Programming techniques, architecture, frameworks, debugging, code quality, and implementation patterns.",
  },
  {
    slug: "developer-tools",
    name: "Developer Tools",
    description: "IDEs, CLIs, libraries, SDKs, coding tools, and developer productivity infrastructure.",
  },
  {
    slug: "design-ux",
    name: "Design & UX",
    description: "Product design, interface systems, UX critique, typography, branding, and visual direction.",
  },
  {
    slug: "photography-film",
    name: "Photography & Film",
    description: "Photography, portrait work, cinematography, camera techniques, composition, and fashion/editorial shoots.",
  },
  {
    slug: "hardware-performance",
    name: "Hardware & Performance",
    description: "Apple Silicon, GPUs, inference speed, systems tuning, benchmarks, and low-level performance optimization.",
  },
  {
    slug: "data-science",
    name: "Data Science",
    description: "Data pipelines, OCR, information extraction, analytics, datasets, evaluation, and experimentation.",
  },
  {
    slug: "science-research",
    name: "Science & Research",
    description: "Scientific papers, experiments, technical discoveries, research results, and academic analysis.",
  },
  {
    slug: "health-medicine",
    name: "Health & Medicine",
    description: "Medicine, health research, cancer research, biotech, clinical findings, and life-science discoveries.",
  },
  {
    slug: "startups-business",
    name: "Startups & Business",
    description: "Startups, founder strategy, company building, business models, product bets, and market positioning.",
  },
  {
    slug: "marketing-growth",
    name: "Marketing & Growth",
    description: "Growth strategy, funnels, conversion, audience building, content distribution, and go-to-market ideas.",
  },
  {
    slug: "economics-policy",
    name: "Economics & Policy",
    description: "Economics, regulation, public policy, incentives, macro analysis, and geopolitical industry context.",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CategoryClient = any;

export async function ensureDefaultCategories(db: CategoryClient): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      update: {
        name: category.name,
        description: category.description,
      },
    });
  }
}

export async function getCategoryOptions(db: CategoryClient): Promise<CategoryOption[]> {
  let categories = await db.category.findMany({
    select: { slug: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  if (categories.length === 0) {
    await ensureDefaultCategories(db);
    categories = await db.category.findMany({
      select: { slug: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
  }

  return categories;
}
