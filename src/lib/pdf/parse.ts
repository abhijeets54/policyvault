// pdf-parse wrapper. The package's index.js auto-runs a debug block when
// invoked at the module root, so we deep-import the lib file.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;

export async function parsePdfText(buf: Buffer): Promise<string> {
  const out = await pdf(buf);
  return out.text ?? "";
}
