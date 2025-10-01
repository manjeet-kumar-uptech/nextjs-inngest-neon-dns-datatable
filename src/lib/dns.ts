const CF_DOH = "https://cloudflare-dns.com/dns-query";

type DnsJsonAnswer = { name: string; type: number; TTL: number; data: string };

async function doh(name: string, type: string) {
  const url = CF_DOH + "?name=" + encodeURIComponent(name) + "&type=" + encodeURIComponent(type);
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) throw new Error("DoH " + type + " failed: " + res.status);
  const json = (await res.json()) as { Status: number; Answer?: DnsJsonAnswer[] };
  return json.Answer ?? [];
}

export function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  const at = s.lastIndexOf("@");
  if (at !== -1) s = s.slice(at + 1);
  if (s.startsWith("http://")) s = s.slice(7);
  if (s.startsWith("https://")) s = s.slice(8);
  if (s.startsWith("www.")) s = s.slice(4);
  const slash = s.indexOf("/");
  if (slash !== -1) s = s.slice(0, slash);
  // very lightweight validity: must contain a dot and a 2+ char TLD
  const lastDot = s.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === s.length - 1) return null;
  const tld = s.slice(lastDot + 1);
  if (tld.length < 2) return null;
  return s;
}

function stripQuotes(s: string): string {
  if (s.startsWith("\"") && s.endsWith("\"")) return s.slice(1, -1);
  return s;
}

export async function lookupMX(domain: string): Promise<{ hasMX: boolean; mx: { exchange: string; priority: number }[] }>{
  const ans = await doh(domain, "MX");
  const mx = ans
    .map((a) => a.data)
    .filter(Boolean)
    .map((d) => {
      const parts = d.split(" ");
      const prio = Number(parts[0]);
      const host = parts.slice(1).join(" ").replace(/\.$/, "");
      if (!isFinite(prio) || !host) return null;
      return { priority: prio, exchange: host };
    })
    .filter((v): v is { exchange: string; priority: number } => !!v);
  return { hasMX: mx.length > 0, mx };
}

export async function lookupSPF(domain: string): Promise<string | null> {
  const ans = await doh(domain, "TXT");
  for (const a of ans) {
    const txt = stripQuotes(a.data);
    if (txt.toLowerCase().startsWith("v=spf1")) return txt;
  }
  return null;
}

export async function lookupDMARC(domain: string): Promise<string | null> {
  const host = "_dmarc." + domain;
  const ans = await doh(host, "TXT");
  for (const a of ans) {
    const txt = stripQuotes(a.data);
    if (txt.toLowerCase().startsWith("v=dmarc1")) return txt;
  }
  return null;
}
