# qPCR Workbench

Two browser tools for qPCR on Applied Biosystems QuantStudio instruments, built and tested with QuantStudio 5 files from Design & Analysis v1.6:

- **Plate Designer**: plan each plate well by well and keep its record with it: the design (purpose, samples, experiment), the plate map and the protocol (reagents, cycling, log).
- **Reader**: open finished runs to see each plate's design next to its data (plate layout, amplification curves, Cts, QC flags, ΔCt), write results and conclusions, save everything as one Word or PDF report, and compare plates side by side.

The two share their plates in the browser: plan in the Designer, run the plate, open the run file in the Reader, and the design, the data and your conclusions are on one page.

**Your data never leaves your computer.** Files are opened and analyzed entirely inside your browser. Nothing is uploaded, including when you use the hosted version.

## Use it

- **Online:** https://w1shyoubest.github.io/qPCR-Workbench/ opens the Reader. Use the header at the top of either page to switch to the Plate Designer.
- **Install as an app:** in Chrome or Edge, click the install icon at the right end of the address bar. In Safari (macOS 14+), choose File → Add to Dock. You get one app with both tools. It works offline after the first visit and updates itself when a new version is published.
- **Fully offline:** download `docs/index.html` (Reader) or `docs/designer.html` (Plate Designer) and open it in a browser. Each is a single self-contained file.

## Plate Designer

A typical plate, top to bottom:

1. **Design**: experiment details (date, operator, instrument, block, chemistry, run file) and a design sheet for the purpose, samples and experiment. The design sheet is a rich-text box with headings, lists and editable tables. Tab moves between table cells, and pasting from Google Docs or Excel keeps tables. New plates start with a Purpose / Samples / Experiment / Controls outline. Markdown works: type `# `, `- ` or `1. ` at the start of a line, or `**bold**`, or paste Markdown including `| tables |`. **Format Markdown** converts Markdown already in the box. LaTeX-style symbols become proper characters, as you type and in pasted text: `$\text{Ca}^{2+}$` → Ca²⁺, `$\text{CaCl}_2$` → CaCl₂, and `\mu`, `\pm`, `\times`, `\Delta`, `^\circ` → µ, ±, ×, Δ, °. Plain `Ca2+`, `Mg2+` and similar ions become Ca²⁺ and Mg²⁺ too. In single-line fields such as log entries and well notes, the same symbols become Unicode characters.
2. **Plate layout**: a 96- or 384-well map. The bar above it sets the format (96 or 384 wells) and what the colours show (sample, target, group or task).
   - To select wells, click one, drag across several, Shift-click, or click a row letter or column number.
   - For the selection, set sample, target(s), task, reporter, quencher, quantity, group, template and a note. Multiplex wells take several targets separated by commas.
   - Fill helpers make sample series (with replicates) and standard dilution series. Copy/paste and undo work too.
   - Hover over a well to see everything recorded for it.
3. **Plate map summary**: each sample × target combination with its wells and n, plus a full table of every well.
4. **Protocol record**:
   - master-mix calculator, with overage and a mix per target
   - thermal cycling program, with presets
   - dated log with quick steps (time optional)

You can keep several plates in one project. Work autosaves in the browser, and **Save project file** writes a `.qpcrplan.json`; reopen that file to keep editing. To share or archive a record, use **Export** for this plate or all plates:

- **Word (.docx)**: a real Word document with headings, tables, Ca²⁺-style formatting and a plate-map picture. It also opens in Google Docs and Pages.
- **PDF**: the same record, through the print dialog (choose "Save as PDF").

**Import run files** turns `.eds` files or exports with a *Sample Setup* sheet (`.xls`, `.xlsx`, `.ods`, `.txt`) into plates, one per file. It fills in the run details and the log's run-finished and export times. Wells named "NTC" become NTCs, and wells that have a target but no sample are skipped. Exports: plate map (PNG), well list (CSV), and a QuantStudio-style sample setup (.txt).

## Reader

**Supported files:**

- `.eds` (analyzed and saved in QuantStudio), which includes the run method and multicomponent (FAM/ROX) data
- exported results (`.xls`, `.xlsx` or `.ods`) containing *Amplification Data*, *Sample Setup* and *Results*, and optionally *Multicomponent Data* or *Raw Data*

**Design and results report:**

- When a run is opened, the Reader finds its plate design (same name as the file or the design's run file name) and shows the experiment details and design sheet above the data. Choose another design from the list, open a project file, or **Create a design from this run** if there is none yet; **Edit in Plate Designer** jumps to it.
- **Results and conclusions** sits below the data: the same rich-text box as the design sheet (tables, Markdown, Ca²⁺-style symbols). It is saved with the design, so it also appears in the Plate Designer's project file.
- **Report** → Word (.docx) or PDF, for this run or all open runs: design, plate layout with Cts, curves, replicate summary, ΔCt table and chart, QC flags, results and conclusions, and the log. It uses the current threshold, baseline, exclusions and plot.

**Data features:**

- Plate layout with well selection (wells, rows, columns), exclusion and QC highlighting
- Amplification (ΔRn), Rn and multicomponent (raw FAM and ROX) plots; log or linear scale; colour by target or sample
- Cts recalculated at a shared threshold or per-target thresholds; instrument or fixed-cycle baseline
- QC flags modelled on QuantStudio: NOAMP, AMPNC, BADROX, DRNMIN, HIGHSD, outlier replicates
- ΔCt, ΔΔCt and fold change against matched controls, with bar charts and error bars
- Multi-plate comparison: run QC table with a per-plate calibrator, ΔCt across plates, overlaid curves
- CSV and PNG exports

Fold change assumes 100% amplification efficiency (2^ΔΔCt).

## Repository layout

```
docs/                    the built site, served by GitHub Pages (generated; don't edit by hand)
  index.html             Reader
  designer.html          Plate Designer
  sw.js, manifest.webmanifest, icons/
src/
  build.py               builds docs/ from the sources below
  reader/                reader.html (page) + reader.js (interface)
  designer/              designer.html (page) + designer.js (interface)
  shared/core.js         QuantStudio parsing and analysis, used by both tools
  shared/rich.js         rich-text boxes (Markdown, symbols, safe HTML) and Word/PDF reports, used by both tools
  static/                service worker, web app manifest and icons, copied to docs/
  vendor/                pinned third-party libraries
```

## Develop

Edit files in `src/`, then rebuild:

```bash
python3 src/build.py
```

When releasing, bump `VERSION` in `src/static/sw.js` so installed copies pick up the new files. GitHub Pages serves the `docs/` folder of `main`.

## Third-party libraries

These are bundled into the built pages:

- JSZip 3.10.1 (MIT or GPLv3)
- SheetJS Community Edition 0.18.5 (Apache-2.0)
- Chart.js 4.4.1 (MIT), Reader only

See `THIRD_PARTY_NOTICES.md`.

QuantStudio is a trademark of Thermo Fisher Scientific. This project is not affiliated with or endorsed by Thermo Fisher Scientific.
