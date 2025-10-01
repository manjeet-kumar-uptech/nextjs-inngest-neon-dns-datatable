import { inngest } from "../client";
import Papa from "papaparse";
import { sql } from "@/lib/db";
import { lookupDMARC, lookupMX, lookupSPF, normalizeDomain } from "@/lib/dns";

export const parseCsvFn = inngest.createFunction(
  { id: "parse-csv-and-enrich" },
  { event: "csv.uploaded" },
  async ({ event, step }) => {
    const { url, fileName, uploadedAt } = event.data;

    console.log('🚀 Processing uploaded CSV:', fileName);
    console.log('📁 File URL:', url);

    // 1) Download and parse CSV from blob URL
    const csvContent = await step.run("download csv", async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.statusText}`);
      }
      return await response.text();
    });

    console.log('✅ CSV downloaded', csvContent);

    const rows: string[] = [];

    // 2) Parse CSV (1 column, or first column is domain/email/url)
    await step.run("parse csv", async () => {
      const parsed = Papa.parse<string[]>(csvContent, { skipEmptyLines: true });
      console.log('✅ CSV parsed data', parsed.data);
      for (const r of parsed.data) {
        const cell = Array.isArray(r) ? r[0] : String(r);
        if (cell && cell.trim()) {
          rows.push(cell.trim());
        }
      }
    });

    console.log('✅ CSV parsed', rows);

    // 2) Normalize + de-dupe
    const domains = Array.from(
      new Set(
        rows
          .map((r) => normalizeDomain(r))
          .filter((v): v is string => !!v)
      )
    ).slice(0, 2000); // guardrail for demo

    console.log('✅ Domains normalized and de-duped', domains);

    if (domains.length === 0) return { success: true, processed: 0, domains: 0 };

    // 3) Enrich with DNS (parallel but with small batch to avoid resolver flood)
    const BATCH = 10;
    const out: { raw: string; domain: string; has_mx: boolean; mx: { exchange: string; priority: number }[]; spf: string | null; dmarc: string | null }[] = [];

    for (let i = 0; i < domains.length; i += BATCH) {
      const slice = domains.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(async (domain) => {
          const [mx, spf, dmarc] = await Promise.all([
            lookupMX(domain),
            lookupSPF(domain),
            lookupDMARC(domain),
          ]);
          return {
            raw: domain,
            domain,
            has_mx: mx.hasMX,
            mx: mx.mx,
            spf: spf ?? null,
            dmarc: dmarc ?? null,
          };
        })
      );
      out.push(...results);
      // tiny breath
      await new Promise((r) => setTimeout(r, 50));
    }

    // 4) Bulk insert into Neon using UNNEST
    // Build arrays for each column
    const rawArr = out.map((o) => o.raw);
    const domainArr = out.map((o) => o.domain);
    const hasMxArr = out.map((o) => o.has_mx);
    const mxArr = out.map((o) => JSON.stringify(o.mx));
    const spfArr = out.map((o) => o.spf);
    const dmarcArr = out.map((o) => o.dmarc);

    await step.run("bulk insert", async () => {
      // language=PostgreSQL
      await sql`
        INSERT INTO domains (raw, domain, has_mx, mx, spf, dmarc)
        SELECT * FROM unnest(
          ${rawArr}::text[],
          ${domainArr}::text[],
          ${hasMxArr}::boolean[],
          ${mxArr}::jsonb[],
          ${spfArr}::text[],
          ${dmarcArr}::text[]
        )`;
    });

    console.log('✅ Bulk insert completed');

    return {
      success: true,
      fileName,
      url,
      processed: out.length,
      domains: domains.length
    };
  }
);
