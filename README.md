# KwikSel — Your WhatsApp Sales Desk

KwikSel is a local-first sales tracker for small businesses that manage
customers through WhatsApp. It helps you capture leads, move them through a
sales pipeline, reuse ready-made WhatsApp replies (English + Roman Urdu), and
never miss a follow-up — all from a single webpage, with no account, no
server, and no internet connection required after you first open it.

---

## How to run it

There is no install and no build step.

1. Unzip the project — keep the folder structure intact.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).

That's it. Everything runs in that one page.

> **Important:** `index.html` loads `css/styles.css` and the files inside
> `js/` using relative paths. Don't move or open `index.html` on its own,
> separate from the `css/` and `js/` folders — it needs them next to it to
> work.

Optional: if you prefer serving it over a local dev server instead of
`file://`, any static server works, e.g.:

```bash
cd kwiksel
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## What's inside

| Page | What it does |
|---|---|
| **Dashboard** | KPIs (total leads, follow-ups due today, overdue, potential revenue, won revenue), recent leads, and a pipeline summary. |
| **Leads** | A Kanban board (drag cards between stages, or use the arrow buttons) plus a searchable/sortable List view. Add, edit, delete leads. |
| **Templates** | Ready-made WhatsApp replies in English and Roman Urdu, organized by category (welcome, price inquiry, follow-up, payment reminder, order confirmation, etc.). Copy one with a click — placeholders like `{{name}}` and `{{price}}` are filled in automatically. |
| **Follow-ups** | Everything overdue, due today, coming up in 7 days, or recently completed — so nothing falls through the cracks. |
| **Settings** | Your business name (used in templates), light/dark/system theme, and data backup tools. |

---

## Where your data lives

KwikSel stores everything in your **browser's local storage** on the device
you're using — nothing is sent anywhere, there's no account, and no company
sees your customer list.

That also means:

- Data is tied to **one browser on one device**. Opening the file on your
  phone or a different browser starts you off with a fresh copy — it will
  not automatically sync with your laptop.
- Clearing your browser's site data/cache for this page will erase it.

### Backing up / moving your data

Go to **Settings → Data management**:

- **Export as JSON** — a full backup of everything (leads, templates,
  settings). Keep this file somewhere safe, or use it to move your data to
  another device via **Import**.
- **Export leads as CSV** — just your leads, for opening in Excel or Google
  Sheets.
- **Import from JSON** — loads a previously exported backup. This
  **replaces** all current data, so you'll be asked to confirm first.
- **Clear all local data** — wipes everything from this browser. Also asks
  for confirmation first, since it can't be undone.

---

## Project structure

```
kwiksel/
├── index.html          # entry point — open this
├── css/
│   └── styles.css      # design system (colors, layout, components, dark mode)
└── js/
    ├── data.js          # data model, seed/sample data, localStorage read/write
    ├── utils.js         # formatting, validation, icons, small helpers
    └── app.js            # app state, routing, rendering, and all interactions
```

Plain HTML/CSS/JavaScript — no frameworks, no build tools, no dependencies
to install.

---

## Notes

- Comes pre-loaded with sample data for a fictional clothing business
  (**StyleCart PK**) so you can see how it works immediately. Change the
  business name in Settings, or clear all data to start fresh.
- Works fully offline after the first load, except for the Google Fonts used
  for headings — those need an internet connection to load; the app falls
  back to your system's default font if unavailable.
