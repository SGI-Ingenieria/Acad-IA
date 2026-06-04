import { serve } from "https://deno.land/std/http/server.ts";
import { XMLParser } from "npm:fast-xml-parser";

serve(async (req) => {
  try {
    const {
      titulo,
      autor,
      isbn,
    } = await req.json();

    if (!titulo && !isbn) {
      return Response.json(
        {
          error: "Debe enviarse titulo o isbn",
        },
        {
          status: 400,
        },
      );
    }

    let xml = "";

    // ===================================
    // 1. BUSQUEDA POR ISBN
    // ===================================

    if (isbn) {
      xml = await searchSRU(
        `bath.isbn="${isbn}"`,
      );

      if (hasResults(xml)) {
        console.log("Encontrado por ISBN");
      }
    }

    // ===================================
    // 2. BUSQUEDA POR TITULO LIMPIO
    // ===================================

    if (!hasResults(xml) && titulo) {
      const clean = cleanTitle(titulo);

      xml = await searchSRU(
        `dc.title="${clean}"`,
      );

      if (hasResults(xml)) {
        console.log(
          "Encontrado por título limpio",
        );
      }
    }

    // ===================================
    // 3. BUSQUEDA POR PALABRAS CLAVE
    // ===================================

    if (!hasResults(xml) && titulo) {
      const keywords =
        extractKeywords(titulo);

      const query = keywords
        .map(
          (word) =>
            `cql.anywhere="${word}"`,
        )
        .join(" AND ");

      xml = await searchSRU(query);

      console.log(
        "Busqueda fallback keywords:",
        query,
      );
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const json = parser.parse(xml);

    const records =
      json[
        "zs:searchRetrieveResponse"
      ]?.["zs:records"]?.[
        "zs:record"
      ] || [];

    const results = (
      Array.isArray(records)
        ? records
        : [records]
    ).map((r: any) => {
      const record =
        r["zs:recordData"]?.record;

      return {
        id: getControlField(
          record,
          "001",
        ),

        titulo: getSubfield(
          record,
          "245",
          "a",
        ),

        descripcion: getSubfield(
          record,
          "245",
          "c",
        ),

        autor: getSubfield(
          record,
          "100",
          "a",
        ),

        isbn: getSubfield(
          record,
          "020",
          "a",
        ),

        editorial:
          getSubfield(
            record,
            "264",
            "b",
          ) ??
          getSubfield(
            record,
            "260",
            "b",
          ),

        anio:
          getSubfield(
            record,
            "264",
            "c",
          ) ??
          getSubfield(
            record,
            "260",
            "c",
          ),
      };
    });

    const rankedResults = results
      .map((item) => {
        const titleScore =
          titulo
            ? similarity(
                titulo,
                item.titulo ?? "",
              )
            : 0;

        const authorScore =
          autor && item.autor
            ? similarity(
                autor,
                item.autor,
              )
            : 0;

        return {
          ...item,
          score:
            titleScore * 0.9 +
            authorScore * 0.1,
        };
      })
      .sort(
        (a, b) => b.score - a.score,
      )
      .slice(0, 10);

    return Response.json({
      total: rankedResults.length,
      results: rankedResults,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido",
      },
      {
        status: 500,
      },
    );
  }
});

// ====================================================
// SRU
// ====================================================

async function searchSRU(
  query: string,
) {
  const params =
    new URLSearchParams({
      version: "1.1",
      operation:
        "searchRetrieve",
      query,
      maximumRecords: "50",
      startRecord: "1",
      recordSchema: "marcxml",
    });

  const response = await fetch(
    `https://catalogo.biblioteca.lasalle.mx/sru/lasalle?${params}`,
  );

  return await response.text();
}

function hasResults(xml: string) {
  return (
    xml.includes(
      "<zs:numberOfRecords>",
    ) &&
    !xml.includes(
      "<zs:numberOfRecords>0</zs:numberOfRecords>",
    )
  );
}

// ====================================================
// RANKING
// ====================================================

function normalize(
  text: string,
) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^\w\s]/g,
      "",
    )
    .trim();
}

function similarity(
  search: string,
  candidate: string,
) {
  const searchWords =
    new Set(
      normalize(search).split(
        /\s+/,
      ),
    );

  const candidateWords =
    new Set(
      normalize(candidate).split(
        /\s+/,
      ),
    );

  let matches = 0;

  for (const word of searchWords) {
    if (
      candidateWords.has(word)
    ) {
      matches++;
    }
  }

  return (
    matches /
    Math.max(
      searchWords.size,
      1,
    )
  );
}

// ====================================================
// EXTRACCION
// ====================================================

function cleanTitle(
  title: string,
) {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(
      /[.,;:()[\]®]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(
  title: string,
) {
  const stopWords =
    new Set([
      "de",
      "del",
      "la",
      "las",
      "el",
      "los",
      "con",
      "para",
      "por",
      "en",
      "and",
      "the",
    ]);

  return cleanTitle(title)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !stopWords.has(
          word.toLowerCase(),
        ),
    );
}

// ====================================================
// MARC
// ====================================================

function getControlField(
  record: any,
  tag: string,
) {
  const fields =
    Array.isArray(
      record?.controlfield,
    )
      ? record.controlfield
      : [record?.controlfield];

  const field = fields.find(
    (f: any) =>
      f?.["@_tag"] === tag,
  );

  return (
    field?.["#text"] ?? null
  );
}

function getSubfield(
  record: any,
  tag: string,
  code: string,
) {
  const fields =
    Array.isArray(
      record?.datafield,
    )
      ? record.datafield
      : [record?.datafield];

  const field = fields.find(
    (f: any) =>
      f?.["@_tag"] === tag,
  );

  if (!field) {
    return null;
  }

  const subfields =
    Array.isArray(
      field.subfield,
    )
      ? field.subfield
      : [field.subfield];

  const subfield =
    subfields.find(
      (s: any) =>
        s?.["@_code"] === code,
    );

  return (
    subfield?.["#text"] ??
    null
  );
}