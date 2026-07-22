// @types/pdf-parse only declares the package root ("pdf-parse"); this app
// deliberately imports the internal lib entry point instead (see the
// comment in src/app/api/candidate/resume-parse/route.ts for why: it
// skips a debug-mode check in the root index.js that can misfire under a
// bundler). Same function, just re-declared under the subpath so it isn't
// implicitly `any`.
declare module "pdf-parse/lib/pdf-parse.js" {
  import type PDFParse from "pdf-parse";
  const pdfParse: typeof PDFParse;
  export default pdfParse;
}
