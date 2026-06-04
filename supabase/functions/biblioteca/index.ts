import { serve } from "https://deno.land/std/http/server.ts";
import { XMLParser } from "npm:fast-xml-parser";

serve(async (req) => {
  
  const {
  titulo,
  autor,
  isbn,
} = await req.json()

  let query = ""

  if (isbn) {
    query = `bath.isbn="${isbn}"`
  } else if (titulo && autor) {
    query = `(dc.title="${titulo}") OR (dc.creator="${autor}")`
  } else if (autor) {
    query = `dc.creator="${autor}"`
  } else if (titulo) {
    query = `dc.title="${titulo}"`
  } else {
    throw new Error("Debe enviarse título o autor")
  }

  const params = new URLSearchParams({
    version: "1.1",
    operation: "searchRetrieve",
    query,
    maximumRecords: "10",
    startRecord: "1",
    recordSchema: "marcxml",
  });

  const response = await fetch(
    `https://catalogo.biblioteca.lasalle.mx/sru/lasalle?${params}`
  );

  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

 
  const json = parser.parse(xml);
  const records =
  json["zs:searchRetrieveResponse"]
    ?.["zs:records"]
    ?.["zs:record"] || []

      const results = records.map((r: any) => {
        const record = r["zs:recordData"].record

        return {
          id: getControlField(record, "001"),

          titulo: getSubfield(record, "245", "a"),

          descripcion: getSubfield(record, "245", "c"),

          autor: getSubfield(record, "100", "a"),

          isbn: getSubfield(record, "020", "a"),

          editorial:
            getSubfield(record, "264", "b") ??
            getSubfield(record, "260", "b"),

          anio:
            getSubfield(record, "264", "c") ??
            getSubfield(record, "260", "c"),
        }
      })

      return Response.json({
        total:
          json["zs:searchRetrieveResponse"]?.["zs:numberOfRecords"] ?? 0,
        results,
      });
});


function getControlField(record: any, tag: string) {
  const fields = record.controlfield || []

  const field = fields.find((f: any) => f["@_tag"] === tag)

  return field?.["#text"] ?? null
}

function getSubfield(record: any, tag: string, code: string) {
  const fields = record.datafield || []

  const field = fields.find((f: any) => f["@_tag"] === tag)

  if (!field) return null

  const subfields = Array.isArray(field.subfield)
    ? field.subfield
    : [field.subfield]

  const subfield = subfields.find(
    (s: any) => s["@_code"] === code
  )

  return subfield?.["#text"] ?? null
}