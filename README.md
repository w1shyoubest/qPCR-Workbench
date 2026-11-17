# qPCR Workbench

Plan qPCR plates, read the runs, and write up the results in the browser. Built for Applied Biosystems QuantStudio instruments and tested with QuantStudio 5 files from Design & Analysis v1.6.

**Open it:** https://w1shyoubest.github.io/qPCR-Workbench/

| Page | Use it to |
| --- | --- |
| **Plate Designer** | Plan each plate before the run: purpose, samples, the plate map well by well, reagents, cycling and a dated log. |
| **Reader** | Open the finished run: see the design next to the data (curves, Cts, QC, ΔCt), write results and conclusions, and export one report. |

**Your data never leaves your computer.** Files are read inside your browser, and nothing is uploaded, including on the hosted site.

---

## Quick start: from plan to report

1. **Plan the plate** in the [Plate Designer](https://w1shyoubest.github.io/qPCR-Workbench/designer.html).
   - Fill in **Design**: the experiment details and the design sheet (purpose, samples table, experiment, controls).
   - Lay out the **Plate layout**: select wells and set sample, target, task, group and a note.
   - Give the plate the same name you will give the run in QuantStudio (for example `2026-11-17_2nd`). The Reader uses that name to find the plate later.
2. **Run the plate** on the instrument. Export the results (`.xls`), or keep the `.eds` file.
3. **Open the run** in the [Reader](https://w1shyoubest.github.io/qPCR-Workbench/) by dropping the file on the page.
   - The Reader links the run to its design automatically, by name. Above the data you see the design sheet, the designed plate map, and a **Design and results by sample** table with each sample's Cts.
   - If the wrong design is linked, or none, choose the right one in the **Plate design** list.
4. **Write the conclusions** in **Results and conclusions**, below the data. They are saved with the design.
5. **Export the report** from the **Report** section as Word (.docx), PDF or Notes (.md). It is one document with the design, plate maps, curves, Ct tables, ΔCt, QC flags, conclusions and log.
6. **Keep a copy** with **Save project file**, on either page. It writes a `.qpcrplan.json` file with every plate, design and conclusion.

---

## Saving, backups and moving to another computer

- Both pages autosave in your browser and share the same plates. Plans made in the Designer appear in the Reader. Conclusions written in the Reader are saved with the plate, so they are in the project file too.
- Browser storage belongs to one browser on one computer. **Save project file** regularly; the file is your permanent copy.
- **Open project file** (on either page) loads a `.qpcrplan.json` file.
  - If a plate from the file is already in the browser, the Reader asks whether to keep or replace it.
  - If a run is linked to an empty design, the Reader switches it to the filled-in design from the file and keeps anything you already typed.
- A suggested folder for each project:

  ```
  my-project/
    my-project.qpcrplan.json   the project file (all plates, designs, conclusions)
    runs/                      QuantStudio exports (.xls) or .eds files
    lab log/                   notebook exports, protocols
    reports/                   Word / PDF / Markdown reports exported from the Reader
  ```

## Getting the newest version

- The page checks for a new version every time it loads, so a normal reload is enough. The version number is in the footer (for example `v2.6.1`).
- If a page still looks old, press **⌘ Shift R** (Mac) or **Ctrl Shift R** (Windows) once.
- **Install as an app:**
  - Chrome or Edge: use the install icon at the right of the address bar.
  - Safari (macOS 14+): choose File → Add to Dock.

  One app holds both pages and works offline after the first visit.
- **Fully offline:** download `docs/index.html` (Reader) or `docs/designer.html` (Plate Designer) and open it in a browser. Each is one self-contained file.

---

## Plate Designer guide

The sections below follow the page from top to bottom.
- Click a section title (▼) to fold that section away. **Plate layout** always stays open.
- **Show all sections** and **Hide all sections** sit under the tabs.

**Tabs:** one tab per plate.
- **+ New plate** and **Duplicate this plate** add plates.
- **Delete all plates** asks first, and Undo brings the plates back.
- The × on a tab deletes that plate.

**Design:**
- **Experiment details:** project, date, operator, instrument, block, chemistry, run file name, experiment type and passive reference.
- **Design sheet:** a rich-text box.
  - It has headings, bold and italic, lists and tables. Use **+ Row** and **+ Column** to grow a table, and Tab to move between cells.
  - Tables pasted from Google Docs or Excel stay tables.
  - **Outline** inserts Purpose / Samples / Experiment / Controls headings.
- **Markdown:** `# ` makes a heading, `- ` or `1. ` makes a list, and `**bold**` and `| tables |` also work. **Format Markdown** converts Markdown already in the box.
- **Symbols:**
  - `$\text{Ca}^{2+}$` → Ca²⁺ and `$\text{CaCl}_2$` → CaCl₂.
  - `\mu`, `\pm`, `\times`, `\Delta` and `^\circ` → µ, ±, ×, Δ and °.
  - Plain `Ca2+` and `Mg2+` become Ca²⁺ and Mg²⁺.
  - In one-line fields (log entries, well notes) the symbols become Unicode characters.

**Plate layout:**
- The bar on top sets the **Format** (96 or 384 wells) and **Color by** (sample, target, group or task).
- **Selecting wells:** click a well, drag across wells, Shift-click, or click a row letter or column number.
- **Filling wells:** set sample, target(s), task, reporter, quencher, quantity, group, template and note, then click **Apply to selection**. For multiplex wells, separate the targets with commas.
- **Helpers:** **Fill a sample series** (with replicates), **Fill a dilution series** (standards) and **Copy / paste wells**. ⌘Z or Ctrl Z undoes.

**Plate map summary:** each sample × target with its wells and n. **All wells in detail** lists every well.

**Protocol record:**
- master-mix calculator with overage
- thermal cycling program, with presets
- dated log with quick steps (time optional)

**Import run files:**
- Accepts `.eds` files, or exports with a *Sample Setup* sheet (`.xls`, `.xlsx`, `.ods`, `.txt`).
- Each file becomes one plate. The run details are filled in, and the run-finished and export times go into the log.
- Wells named "NTC" become NTCs.

**Export:**
- **This plate or all plates:** the plan as Word (.docx) or PDF.
- **Under the plate:** plate map (PNG), well list (CSV) and a QuantStudio-style sample setup (.txt).

---

## Reader guide

**Open runs:** drop files on the page, or choose them. Each run opens as a tab, and a **Compare plates** tab appears when two or more are open.

**Supported files:**
- `.eds` files (analyzed and saved in QuantStudio). They include the run method and multicomponent (FAM/ROX) data.
- Exported results (`.xls`, `.xlsx` or `.ods`) with *Amplification Data*, *Sample Setup* and *Results* sheets, and optionally *Multicomponent Data* or *Raw Data*.

The sections below follow the page from top to bottom.
- Click a section title (▼) to fold it. **Curves** always stays open.
- The page remembers which sections you folded.

**Design** (from the Plate Designer):
- **Plate design** list: the design linked to this run.
  - **Open project file…** loads designs from a `.qpcrplan.json` file.
  - **Create a design from this run** makes a design from the run's plate map.
  - **Edit in Plate Designer →** opens the design there.
- Experiment details and the design sheet. If the design sheet is empty, the page says so and tells you where to fill it in.
- **Designed plate map**, coloured by sample, target, group or task.
- **Design and results by sample:** each designed sample × target with its group, wells, amplified wells, mean Ct, SD and well notes.
  - Cts are matched by well position, so samples or targets renamed in the design still line up.
  - Where the run file uses a different name, it is shown as "in run: …".

**Data:**
- **Threshold:** shared, or per target like QuantStudio.
- **Baseline:** from the instrument, or fixed cycles.
- **Plate layout:** select wells, rows or columns, and exclude or include them. Hover over a well for its Ct, its QC flags, and its design group and note.
- **Curves:** amplification (ΔRn), Rn or multicomponent plots.
  - Log or linear scale.
  - Colour by target or sample.
  - Filter by target and sample.
- **QC flags**, modelled on QuantStudio: NOAMP, AMPNC, BADROX, DRNMIN, HIGHSD and outlier replicates.
- **ΔCt**, ΔΔCt and fold change against matched controls, with a bar chart and SD error bars. Fold change assumes 100% amplification efficiency (2^ΔΔCt).
- **Replicate summary** and **All wells**.

**Results and conclusions:** the same rich-text box as the design sheet. It saves automatically with the linked design. If no design is linked yet, typing creates one for this run.

**Report:** for this run or all open runs.
- **Word (.docx):** opens in Word, Google Docs and Pages.
- **PDF:** made through the print dialog; choose "Save as PDF".
- **Notes (.md):** text to paste into a lab notebook. The figures are only in the Word and PDF reports.

The report uses the current threshold, baseline, exclusions and plot. **Save project file** keeps every design with its conclusions.

**Export data:**
- ΔCt table, replicate summary and all wells (CSV)
- curve plot, ΔCt chart and plate layout (PNG)

**Compare plates:**
- run QC across plates, with a calibrator for each plate
- ΔCt across plates
- curves from different plates overlaid

---

## Repository layout

```
docs/                    the built site, served by GitHub Pages (generated; don't edit by hand)
  index.html             Reader
  designer.html          Plate Designer
  sw.js, manifest.webmanifest, icons/
src/
  build.py               builds docs/ from the sources below
  reader/                reader.html (page) + reader.js
  designer/              designer.html (page) + designer.js
  shared/core.js         QuantStudio parsing and analysis
  shared/rich.js         rich-text boxes (Markdown, symbols, safe HTML), foldable sections, Word/PDF/Markdown reports
  shared/plate.js        plate-map drawing for designs
  static/                service worker, web app manifest and icons, copied to docs/
  vendor/                pinned third-party libraries
```

## Develop

Edit files in `src/`, then rebuild:

```bash
python3 src/build.py
```

When releasing, bump `VERSION` in `src/static/sw.js` and the version in both page footers. GitHub Pages serves the `docs/` folder of `main`.

## Third-party libraries

These are bundled into the built pages:
- JSZip 3.10.1 (MIT or GPLv3)
- SheetJS Community Edition 0.18.5 (Apache-2.0)
- Chart.js 4.4.1 (MIT), Reader only

See `THIRD_PARTY_NOTICES.md`.

QuantStudio is a trademark of Thermo Fisher Scientific. This project is not affiliated with or endorsed by Thermo Fisher Scientific.
