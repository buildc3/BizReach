import { NextRequest } from "next/server";
import * as searchesRepo from "@/lib/repo/searches";
import * as leadsRepo from "@/lib/repo/leads";
import * as groupsRepo from "@/lib/repo/groups";
import * as scraper from "@/lib/services/scraper";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Kick off scraping for a search. Returns immediately; the scrape runs in the
 * background and updates the search status (running → done | error) as it goes.
 */
export const POST = withRoute(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser(req);
  const id = parseUuid((await params).id);
  const search = await searchesRepo.getSearch(id, userId);
  await searchesRepo.updateSearchStatus(id, userId, "running");

  void (async () => {
    try {
      const leads = await scraper.searchBusinesses(search.id, search.bizType, search.area);
      let inserted = 0;
      for (const lead of leads) {
        try {
          await leadsRepo.insertLead(userId, lead);
          inserted++;
        } catch (e) {
          console.warn(`insert_lead failed for search ${search.id}:`, e);
        }
      }
      console.info(`search ${search.id} done: ${inserted} leads`);
      try {
        await groupsRepo.autoGroupByContact(search.id, userId);
      } catch (e) {
        console.warn(`auto-group failed for search ${search.id}:`, e);
      }
      await searchesRepo.updateSearchStatus(search.id, userId, "done");
    } catch (e) {
      console.error(`scrape failed for search ${search.id}:`, e);
      await searchesRepo.updateSearchStatus(search.id, userId, "error").catch(() => {});
    }
  })();

  return ok("started");
});
