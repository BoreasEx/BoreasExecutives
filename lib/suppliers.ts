import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Fuse from "fuse.js";

export type SupplierRecord = {
  original: string;
  normalized: string;
};

export type SupplierMatchResult = {
  status: "match" | "uncertain" | "no_match";
  matchedName: string | null;
  confidence: number;
};

let cachedSuppliers: SupplierRecord[] | null = null;
let cachedFuse: Fuse<SupplierRecord> | null = null;

function normalizeSupplierName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(sa|sarl|sas|spa|llc|ltd|inc|co)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function loadSuppliersFromCsv(): SupplierRecord[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    "emcocal_egypt_iqf_suppliers.csv"
  );

  const csvContent = fs.readFileSync(filePath, "utf-8");

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows
    .map((row) => {
      const companyName = row["Company name"]?.trim();

      if (!companyName) {
        return null;
      }

      return {
        original: companyName,
        normalized: normalizeSupplierName(companyName),
      };
    })
    .filter((item): item is SupplierRecord => item !== null);
}

export function getSuppliers(): SupplierRecord[] {
  if (!cachedSuppliers) {
    cachedSuppliers = loadSuppliersFromCsv();
  }

  return cachedSuppliers;
}

export function getSuppliersFuse(): Fuse<SupplierRecord> {
  if (!cachedFuse) {
    cachedFuse = new Fuse(getSuppliers(), {
      keys: ["original", "normalized"],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
  }

  return cachedFuse;
}

export function validateSupplierName(input: string): SupplierMatchResult {
  const cleanInput = input?.trim();

  if (!cleanInput) {
    return {
      status: "no_match",
      matchedName: null,
      confidence: 0,
    };
  }

  const normalizedInput = normalizeSupplierName(cleanInput);
  const suppliers = getSuppliers();

  // 1) Exact match normalisé
  const exactNormalizedMatch = suppliers.find(
    (supplier) => supplier.normalized === normalizedInput
  );

  if (exactNormalizedMatch) {
    return {
      status: "match",
      matchedName: exactNormalizedMatch.original,
      confidence: 1,
    };
  }

  // 2) Inclusion : si l'input contient clairement le fournisseur
  const containsSupplierMatch = suppliers.find((supplier) => {
    return (
      supplier.normalized.length >= 4 &&
      normalizedInput.includes(supplier.normalized)
    );
  });

  if (containsSupplierMatch) {
    return {
      status: "match",
      matchedName: containsSupplierMatch.original,
      confidence: 0.9,
    };
  }

  // 3) Inclusion inverse : si le fournisseur contient l'input
  const containedBySupplierMatch = suppliers.find((supplier) => {
    return (
      normalizedInput.length >= 4 &&
      supplier.normalized.includes(normalizedInput)
    );
  });

  if (containedBySupplierMatch) {
    return {
      status: "uncertain",
      matchedName: containedBySupplierMatch.original,
      confidence: 0.75,
    };
  }

  // 4) Fuzzy matching en dernier recours
  const fuse = getSuppliersFuse();
  const results = fuse.search(cleanInput);

  if (results.length === 0) {
    return {
      status: "no_match",
      matchedName: null,
      confidence: 0,
    };
  }

  const best = results[0];
  const confidence = Number((1 - (best.score ?? 1)).toFixed(3));

  console.log("INPUT:", cleanInput);
  console.log("BEST MATCH:", best.item.original);
  console.log("CONFIDENCE:", confidence);

  if (confidence >= 0.75) {
    return {
      status: "match",
      matchedName: best.item.original,
      confidence,
    };
  }

  if (confidence >= 0.4) {
    return {
      status: "uncertain",
      matchedName: best.item.original,
      confidence,
    };
  }

  return {
    status: "no_match",
    matchedName: best.item.original,
    confidence,
  };
}