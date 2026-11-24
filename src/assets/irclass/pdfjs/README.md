# pdf.js (IRClass)

Mozilla pdf.js 6.5.438, legacy build (pdfjs-dist), Apache License 2.0 (see LICENSE and the licence files in the
subfolders). Used by the app's own viewer for view-only PDFs (src/core/irclass/pdf-viewer), so they work on older
Android WebViews without depending on the website's viewer.

- pdf.min.js and pdf.worker.min.js are legacy/build/pdf.min.mjs and pdf.worker.min.mjs renamed to .js, because the
  app's local file servers on Android and iOS may not send a JavaScript type for .mjs files.
- standard_fonts, cmaps, iccs and wasm (without the QuickJS scripting engine, PDF scripts are disabled) as published.
