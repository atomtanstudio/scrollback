import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { getClient, disconnectClient } from "@/lib/db/client";
import { DEFAULT_CATEGORIES, ensureDefaultCategories } from "@/lib/default-categories";

async function main() {
  try {
    const db = await getClient();
    await ensureDefaultCategories(db);

    console.log(`[ensure-categories] Ensured ${DEFAULT_CATEGORIES.length} categories.`);
  } catch (error) {
    console.error("[ensure-categories] Error:", error);
  } finally {
    await disconnectClient().catch(() => {});
  }
}

main();
