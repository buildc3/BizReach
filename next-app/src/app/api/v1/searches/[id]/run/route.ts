import { NextRequest } from "next/server";
import * as searchesRepo from "@/lib/repo/searches";
import * as leadsRepo from "@/lib/repo/leads";
import * as groupsRepo from "@/lib/repo/groups";
import * as scraper from "@/lib/services/scraper";
import { ok, withRoute } from "@/lib/errors";
import { parseUuid } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

/**
 * Kick off scraping for a search. Returns immediately; the scrape runs in the
 * background and updates the search status (running → done | error) as it goes.
 */
export const POST = withRoute(async (_req: NextRequest, { params }: Params) => {
  const id = parseUuid((await params).id);
  const search = await searchesRepo.getSearch(id);
  await searchesRepo.updateSearchStatus(id, "running");

  void (async () => {
    try {
      const leads = await scraper.searchBusinesses(search.id, search.bizType, search.area);
      let inserted = 0;
      for (const lead of leads) {
        try {
          await leadsRepo.insertLead(lead);
          inserted++;
        } catch (e) {
          console.warn(`insert_lead failed for search ${search.id}:`, e);
        }
      }
      console.info(`search ${search.id} done: ${inserted} leads`);
      try {
        await groupsRepo.autoGroupByContact(search.id);
      } catch (e) {
        console.warn(`auto-group failed for search ${search.id}:`, e);
      }
      await searchesRepo.updateSearchStatus(search.id, "done");
    } catch (e) {
      console.error(`scrape failed for search ${search.id}:`, e);
      await searchesRepo.updateSearchStatus(search.id, "error").catch(() => {});
    }
  })();

  return ok("started");
});
