import { ResearchResult } from "../types";

export async function fetchSecFilings(
  ticker: string
): Promise<ResearchResult[]> {
  const email = process.env.SEC_EDGAR_EMAIL;
  if (!email) {
    console.warn("SEC_EDGAR_EMAIL not set, skipping SEC filings");
    return [];
  }

  // Search EDGAR full-text search for recent filings
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getThreeMonthsAgo()}&enddt=${getToday()}&forms=10-K,10-Q,8-K&from=0&size=5`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `PortfolioAnalyst/1.0 (${email})`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Fallback to EDGAR company search
      return await fetchEdgarCompanyFilings(ticker, email);
    }

    const data = await response.json();
    const hits = data.hits?.hits || [];

    return hits.slice(0, 5).map(
      (hit: {
        _source: {
          file_description?: string;
          form_type?: string;
          file_date?: string;
          file_url?: string;
        };
      }) => ({
        source: "SEC EDGAR",
        title: `${hit._source.form_type}: ${hit._source.file_description || ticker}`,
        summary: `${hit._source.form_type} filing for ${ticker}`,
        url: hit._source.file_url
          ? `https://www.sec.gov${hit._source.file_url}`
          : "",
        date: hit._source.file_date || "",
      })
    );
  } catch {
    return await fetchEdgarCompanyFilings(ticker, email);
  }
}

async function fetchEdgarCompanyFilings(
  ticker: string,
  email: string
): Promise<ResearchResult[]> {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(ticker)}&forms=10-K,10-Q,8-K&from=0&size=5`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `PortfolioAnalyst/1.0 (${email})`,
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const hits = data.hits?.hits || [];

    return hits.slice(0, 3).map(
      (hit: {
        _source: {
          file_description?: string;
          form_type?: string;
          file_date?: string;
        };
      }) => ({
        source: "SEC EDGAR",
        title: `${hit._source.form_type || "Filing"}: ${hit._source.file_description || ticker}`,
        summary: `SEC filing for ${ticker}`,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=&dateb=&owner=include&count=5`,
        date: hit._source.file_date || "",
      })
    );
  } catch {
    return [];
  }
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getThreeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}
