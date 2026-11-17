# Collection Management — complete user guide

This guide explains, from a user's point of view, how collections work in the CRM: the listing page, creating a collection, conditions, products, the details page and the whole lifecycle. It describes what the application does today (read from the code), including what it does **not** offer.

> **Two kinds of collection.**
> - **Custom** (a "manual" collection): you pick its products one by one.
> - **Smart** (an "automated" collection): you write conditions (rules) and Shopify puts every matching product in by itself.
>
> The type is chosen when the collection is created and **cannot be changed afterwards**.

> **Everything is also done in Shopify.** The CRM sends each create or change to the Shopify store (through our backend). A collection created or edited here appears in Shopify too, and the CRM shows what Shopify answered. Saving can take a few seconds.

> **Permissions.** Everyone who can open the page can look. Creating, editing, adding/removing products need the **Products → manage** permission. Without it the *Add collection* button, the pencils and the add/remove product controls are not shown. (The server still has the final say.)

---

## 1. Collection Listing Page (`Collections` in the sidebar, under *Shopify Management*)

### 1.1 What the page shows

The page is for **the store chosen in the top-bar store dropdown** (or every store with *All shops*). Above the table there is a strip of tabs: **All Collections** (this list), a history icon (recently opened collections) and one tab for every collection you have opened (up to 10; **Clear** closes them all). The list stays exactly as you left it (search, filters, page) when you come back from a collection.

### 1.2 Table columns (screens 768 px and wider)

| Column | What it shows | Sortable |
|---|---|---|
| **Collection** | The collection's picture (a grey tile when it has none) and its title. The title is a link that opens the collection. | Yes |
| **Condition** | For a smart collection, its first **two** conditions in the backend's wording (e.g. `Category_Food Packaging`). If there are more, **+ More Conditions** opens a small dropdown listing the rest. A custom collection shows a dash. | No |
| **Products** | How many products are in it. | Yes |
| **Store** | Which store it belongs to. Only shown when the top bar is on *All shops*. | No |
| **Updated** | When it was last updated in Shopify ("16 minutes ago", "Yesterday, 4:30 PM"…). Hover for the exact date and time. | Yes |
| **Actions** | An eye button (**View**) that opens the collection. | No |

On a phone the table becomes cards: picture, title, a **Custom / Smart** badge and the product count. Tapping a card opens the collection.

The type (Custom/Smart) is no longer a table column; it is shown on the collection's page and on phone cards, and can be filtered (see below).

### 1.3 Searching, filtering, sorting

| Control | What it does |
|---|---|
| **Search box** | Finds collections whose **name or handle** contains the text. It searches after you pause typing; ✕ clears it. Matches are highlighted in yellow in the rows. |
| **Filters** button | Opens the filter grid. |
| **Collection type** | *All collections*, *Custom* or *Smart*. |
| **Sort by** | *Title*, *Products* or *Last updated*. |
| **Order** | *Ascending* or *Descending*. |
| **Clicking a column heading** | Sorts by that column (Collection, Products, Updated). Clicking the same one again flips the direction. This is the same setting as *Sort by / Order*. |
| **Clear All** | Puts search, type, sort and order back to the defaults (the chosen store stays). Greyed out when nothing is changed. |
| **Page size / pages** | At the bottom: "Showing 1 to 50 of N entries", a page-size picker (10 / 25 / 50 / 100) and page buttons. The default is 50 per page, sorted by title in descending order (Z to A). |

### 1.4 Other actions

- **Add collection** — the primary button at the end of the search row (also shown in the empty state). Opens the creation form (section 2). Needs *manage* permission.
- **Refresh** (header, right of the clock) — reads the list again without reloading the page.
- **Opening a collection** — click its title, the eye button, or (on a phone) the card. It opens in the same page as a new tab (section 6).

### 1.5 States you can see

- *Loading* — placeholder rows.
- *Couldn't load the collections* — with a **Try again** button.
- *No collections found* — "Nothing matches the current search and filters" (with **Clear all filters**) or "This store has no collections yet" (with **Add collection**).
- While a new search loads, the previous rows stay on screen, dimmed, with a thin progress bar on top.

### 1.6 What you cannot do on the list

- There is **no delete**, **no activate/deactivate** (publish/unpublish) and **no bulk action** for collections anywhere in the CRM.
- There is no export or import for collections.

---

## 2. Adding a Collection

### 2.1 How to start

1. Pick the store in the top bar (if you are on *All shops*, the form uses the first connected store — its name is shown under the heading: "In *Store name*. It is made in Shopify too.").
2. Press **Add collection**. The form opens in place of the list at `/collections/new` and gets its own tab, **New collection**. You can switch to the list or another collection and come back: what you typed is kept. Closing the tab, **Back to list** or **Cancel** asks "Discard…?" if anything was typed.
3. Fill in the form and press **Create collection** (top right, or at the bottom).

### 2.2 The form, field by field

**Basics**

| Field | Required? | What to enter / what it is for |
|---|---|---|
| **Title** | **Required** (marked `*`). Up to 255 characters. Must be unique in the store. | The collection's name as customers see it, e.g. *Juice Bottles*. Shopify builds the web address (handle) from it. |
| **Description** | Optional | A rich-text editor (bold, headings, lists, links, images, tables…). Shown on the collection page of the online store. The HTML is cleaned before it is sent. |

**Collection type** (required choice — default **Custom**; cannot be changed later)

| Choice | Meaning |
|---|---|
| **Custom** | "Add products to this collection one by one." You can pick products now (optional) or add them later. |
| **Smart** | "Products that match the conditions are added on their own." You must define at least one condition. |

*If Custom:* **Products (optional)** — type a product name or SKU to search the store's products (nothing is listed until you type). Tick products to add them; they appear as removable chips and stay chosen while you search again. At most **250** products can be chosen at creation.

*If Smart:* the **conditions editor** (see section 3). Required: at least one valid condition.

**Search engine listing** (all optional) — how the collection appears in Google results

| Field | Limit | Purpose |
|---|---|---|
| **Page title** | 70 characters (counter shown) | The SEO title. |
| **Meta description** | 320 characters (counter shown) | The SEO description. |

**Image** (right column, optional)

| Field | Purpose |
|---|---|
| **Image address** | A public `https://` link to the collection's picture. A preview shows beside it. |
| **Alt text** | Describes the picture for people who cannot see it (accessibility/SEO). |

**Product order** (right column, optional)

| Field | Purpose |
|---|---|
| **Sort products** | How Shopify orders the products on the collection page: *Store default* (nothing is sent), or one of Shopify's orders — *Product title A–Z / Z–A*, *Best selling*, *Oldest first*, *Newest first*, *Manually*, *Most relevant*, *Lowest price*, *Highest price*. The list comes from the backend. |

### 2.3 Fields that are **not** on the create form

- **URL handle** — Shopify creates it from the title. You can change it afterwards on the details page.
- **Store** — chosen with the top-bar dropdown, not in the form.

### 2.4 Required vs optional — summary

| Required | Optional |
|---|---|
| Title; collection type (defaults to Custom); for **Smart**: at least one complete condition | Description, products (Custom), image address, alt text, page title, meta description, product order |

### 2.5 What happens when you press Create collection

1. **Checks.** Every field is checked first. If something is wrong, a red message "Fix the highlighted fields to create the collection." appears, the problems are shown under their fields and the first one gets the focus. Nothing is sent.
   Typical messages: *Give the collection a title.* · *At most 255 characters.* · *Use a public https:// address.* · *At most 70 / 320 characters.* · *At most 250 products at a time.* · *Add at least one condition.* · *Choose what to check.* · *Choose a condition.* · *Enter a value.* · *Enter a number.* · *Enter a whole number.*
2. **Question.** "Create “*Title*”?" — says the type and how many products/conditions, and "It is saved in Shopify first, which can take a few seconds." **Cancel** is focused; nothing is sent until **Yes, create**.
3. **Sending.** One request is sent (`products` for a custom collection, `rules` for a smart one — never both). The button shows "Saving to Shopify…".
4. **If the store refuses** (for example a duplicate title) the message appears inside the question, which stays open, and everything you typed is kept. Field-specific refusals are shown under their fields.
5. **If it works**, the form closes, a green banner shows the store's message, and **the new collection opens** in its own tab on its details page. The list is refreshed in the background.

---

## 3. Collection Conditions and Rules (Smart collections)

### 3.1 How a condition is built

Every condition is one row of three parts:

1. **What to check** (the *column*) — a property of a product.
2. **How** (the *relation*) — the operator, e.g. equals / contains / greater than.
3. **Value** — what to compare with.

Above the rows you choose how they combine: **Products must match: all conditions** (every condition must be true — "AND") or **any condition** (at least one — "OR").

**Important — the choices come from the backend.** The list of columns, the operators each column allows, and the type of value each column takes are loaded from the server (`GET /collections/rule-options`) when you open the form. The CRM does not hard-code them, so the dropdown always shows what Shopify supports today. (Shopify's standard collection rules cover things such as product title, type, vendor, tag, price, compare-at price, weight, inventory stock and variant title; use the dropdown for the authoritative list. An example from the project's tests: *Tag* · *equals* · `Category_Bags`.)

### 3.2 Value types

| Column's value type | What you see | Rule |
|---|---|---|
| **Text** | A text box | Required. |
| **Number** | A number box | Required, must be a number. The **inventory** column must be a **whole number**. |
| **Yes/No** | "No value needed" | Nothing to enter; the value is sent as empty. |

When you change the *what to check* choice, the operator list updates to what that column allows (your operator is kept if it is still valid; otherwise the first one is chosen, and a yes/no column clears the value).

### 3.3 Adding, editing and removing conditions

| Action | How |
|---|---|
| **Add** | **Add another condition** under the rows. A new row starts on the first column. The button is disabled at **60** conditions. |
| **Edit** | Change any of the three parts of a row. |
| **Remove** | The bin button on a row. The last remaining condition cannot be removed (a smart collection needs at least one) — the bin is greyed out. |
| **Save** | On the create form: with **Create collection**. On an existing collection: the pencil on the **Conditions** card (section 6.4). |

Limits: **1 to 60** conditions.

### 3.4 How the system decides which products belong

1. You save the conditions. The CRM sends the **whole set** (match mode plus every condition) to Shopify through our backend.
2. **Shopify evaluates the rules itself** against the store's products. The CRM does not calculate membership.
3. A product is in the collection when it satisfies **all** conditions (match = all) or **at least one** (match = any).
4. Membership is **automatic and continuous**: when a product's tags, price, stock, etc. change in Shopify so that it starts or stops matching, Shopify adds or removes it. The CRM shows the result the next time it reads the collection.
5. Shopify can take a few seconds to match the products after a save. Until then a new smart collection may show **0 products** — the Products tab says "No product matches the conditions yet. Shopify can take a few seconds — open the collection again shortly."
6. **You cannot add or remove products by hand in a smart collection.** The Products tab has no *Add products* button and no remove bins, and says so ("its products come from its conditions"). Change the conditions instead.

### 3.5 How products get into a Custom collection

Only by hand, with your explicit action:
- when you create it (**Products (optional)** picker), or
- later with **Add products** on the collection's Products tab (section 5).

Each added or removed product is confirmed with a question and is also changed in Shopify.

(There is a second way from the product side: on a product's page, the *Collections* area of its Product Specifications card can add the product to a custom collection by name — or create a new custom collection containing it. This is covered in the Products documentation.)

---

## 4. Viewing a Collection after it is created

| Where | How |
|---|---|
| **Straight after creating** | The CRM opens the new collection automatically in its own tab. |
| **From the list** | Search/sort/filter, then click the title or the eye button. Each opened collection gets a tab in the strip above ("Collection" + its name) — click a tab to switch, ✕ to close it, **Clear** to close all, the history icon for recently opened ones. |
| **By address** | `/collections/<id or handle>` opens it directly. |
| **How the list reflects it** | The new collection appears in the list (the list is re-read in the background; use the header **Refresh** if you want to be sure). The **Products** column shows its count and, for smart collections, **Condition** shows its first two conditions. |

**Seeing which products are in it:** open the collection → **Products** tab (the tab label carries the product count). It lists them in a table (section 5.1). In the list itself, only the *count* is visible.

---

## 5. Managing a collection's products — the **Products** tab

### 5.1 What the table shows

| Column | Content |
|---|---|
| **Position** | The product's place in the collection's own order in Shopify. |
| **Product** | Picture, title (a link), and under it vendor · product type. |
| **SKU** | The product's SKU. |
| **Status** | Active (green), Archived (red) or other (grey). |
| **Inventory** | Total stock. |
| **Price** | One price, or a range (£7.85 – £12.00). |
| **Actions** | **View** (eye) opens the product's own page as a tab (its **Back** returns to the collection). On a custom collection there is also a **bin** (remove). |

Above the table: **search** (product title or SKU, matches highlighted), **Sort by** (*Collection order, Title, Price, Inventory, Date created, Last updated*), **Order**, and — for a custom collection you may edit — **Add products**. Below: "Showing 1 to 20 of N entries", page size (default **20**; 10 / 20 / 25 / 50 / 100), and page buttons.

### 5.2 Adding products (Custom collections only)

1. Press **Add products**. A panel opens with a product search ("Type a product name or SKU…"). Products already in the collection are hidden.
2. Tick one or more products (they appear as chips).
3. Press **Add N to collection**.
4. A question lists the products and says "These changes will also be made in Shopify." Press **Yes, add** (or Cancel).
5. The table refreshes, the count updates and a green banner shows the store's message. If the store refuses, its message appears in the question and nothing is lost.

### 5.3 Removing a product

1. Press the **bin** on the product's row.
2. The question says: remove “Product” from “Collection”? **The product stays in the store; it is only taken out of this collection.** Confirm with **Remove**.
3. The row disappears and the count drops.

### 5.4 Smart collections

No add/remove controls: membership follows the conditions (section 3.4).

---

## 6. Collection Details Page

Opened at `/collections/<id>` in the same page. A bordered card with a header, two tabs (**Overview**, **Products**) and the content.

### 6.1 Header

| Element | Meaning |
|---|---|
| **Picture** | The collection's image (or a grey tile). |
| **Title** | The collection's name. |
| **Collection type** | A badge: **Custom** (green) or **Smart** (amber). |
| **Store name** | Which store it belongs to. |
| **"Updating…"** | Shown while the page is re-reading the collection. |
| **Chips** | *N products*; *Product order: …*; *Shopify updated at: date and time (AM/PM)*. |
| **Back to list** | Returns to the listing (the tab stays open). |

There is no Refresh, Delete or Activate/Deactivate button on this page.

### 6.2 Overview tab — sections and fields

**Left column**
- **Picture** — click it to open the image viewer. If the collection has a picture, you can edit its **alt text** inside the viewer (pencil, then confirm). If it has **no picture yet**, an **Image** card appears with a pencil to add an **Image address** and **Alt text**.

**Right column**

1. **Collection details**

| Field | Editable? | Notes |
|---|---|---|
| **Title** | Yes (pencil) | Required, up to 255 characters. |
| **Type** | **No** | Custom/Smart is fixed when the collection is created. |
| **Products** | **No** | The count; changes with the products (section 5) or the conditions (6.4). |
| **URL handle** | Yes (pencil) | Lower-case letters, numbers and dashes (e.g. `juice-bottles`). A change also **redirects the old address to the new one** (the confirmation tells you). Cannot be empty. |
| **Product order** | Yes (pencil → dropdown) | Shopify's orders (title A–Z, best selling, manually…). |
| **Store** | **No** | |
| **Shopify ID** | **No** | With a copy button. |
| **Last updated in Shopify** | **No** | Date and time. |

2. **Conditions** (smart collections only) — "Products must match **all conditions** / **any condition**:" and the list of conditions in the backend's wording ("No conditions." when empty). **Editable** (pencil; see 6.4). The pencil is available once the condition choices have loaded.
3. **Description** — the formatted description ("No description." when empty). **Editable** with the pencil (rich-text editor).
4. **Search engine listing** — **Page title** (max 70) and **Meta description** (max 320), each **editable** with its own pencil. Empty shows a dash; clearing the text clears it in Shopify.

### 6.3 How editing works (every edit)

1. Click the small **pencil** next to a value (or double-click the value; Enter also starts it). For a card (Conditions, Description, Image) the pencil is in its title row and turns the card into its editor with **✓ Save** and **✕ Discard**.
2. Change the value. It is checked straight away (title not empty, handle format, character limits, https image address, condition rules).
3. Press Enter / ✓. A question appears: **"Are you sure you want to update this?"** with the change shown as *old → new* (and a note that the old address will redirect, for a handle). **Cancel** is focused.
4. **Yes, update** sends **only that one change** to Shopify. A green message shows the store's answer and the page updates. If the store refuses, its message shows inside the question and nothing changes.
5. Escape or ✕ discards without sending.
6. Without *Products → manage* permission, values are plain text (no pencils).

### 6.4 Updating conditions (smart collections)

1. Press the pencil on the **Conditions** card. The editor shows "The full set replaces the old conditions when you save."
2. Change **all/any**, edit rows, add rows, remove rows (section 3.3).
3. ✓ Save → the question shows the change → **Yes, update**.
4. The **whole new set** replaces the old one in Shopify. Shopify then re-matches products; the **Products** tab and the product count follow (give it a few seconds, then reopen the collection if it still shows the old products).

### 6.5 Updating product assignments

- **Custom:** **Products** tab → **Add products** / bin (section 5).
- **Smart:** change the conditions (6.4).

### 6.6 What can and cannot be changed after creation

| Can be changed | Cannot be changed from the CRM |
|---|---|
| Title · URL handle (with redirect) · Product order · Description · Page title · Meta description · Image alt text · (Image address when none is set) · Conditions and match mode (smart) · Products (custom) | **Collection type** · **Store** · **Shopify ID** · **Last-updated date** · the product count (it follows the products/conditions) |

Also not offered in the CRM: **deleting** a collection, **activating / deactivating (publishing/unpublishing)** it, **replacing or removing an existing picture** from the page (the backend supports it, but the page currently only edits the alt text of an existing picture). Do those in Shopify.

---

## 7. Complete Collection Lifecycle — step by step

### A. Create

1. Open **Collections**. Choose the store in the top bar.
2. Press **Add collection**.
3. Enter the **Title** (required); optionally a description, image, SEO fields and product order.
4. Choose the type:
   - **Custom** → optionally search and tick products now.
   - **Smart** → choose **all / any**, then build at least one condition (what to check, how, value).
5. Press **Create collection**. Fix any highlighted problem. Confirm **Yes, create**.
6. The CRM sends it to Shopify. On success a green message appears and **the new collection opens in its own tab**.

### B. Check the result

1. On the details page, the header shows type, store, product count, order and "Shopify updated at".
2. **Overview** shows the saved values and (smart) the conditions as Shopify words them.
3. **Products** tab shows the products that are in it.
   - Custom: exactly the ones you picked (or none yet: "This collection has no products yet.").
   - Smart: the products Shopify matched. If the count is 0 right after saving, wait a few seconds and reopen — Shopify matches in the background.
4. The listing shows it too (name, first two conditions, product count, updated time). Use the header **Refresh** if it is not there yet.

### C. Maintain

| You want to… | Do this |
|---|---|
| Rename it | Overview → Title pencil → confirm. |
| Change its web address | Overview → URL handle pencil → confirm (old address redirects). |
| Change how products are ordered | Product order pencil → choose → confirm. |
| Edit the text people read | Description pencil → editor → ✓ → confirm. |
| Improve SEO | Page title / Meta description pencils. |
| Add a picture / alt text | Image card (no picture yet) or the viewer (alt text). |
| Add products (custom) | Products tab → **Add products** → tick → **Add N to collection** → confirm. |
| Remove a product (custom) | Products tab → bin → **Remove** (the product stays in the store). |
| Change which products a smart collection holds | Overview → Conditions pencil → edit → ✓ → confirm; then check the Products tab. |
| Find / review collections | Listing: search, type filter, sort by title/products/updated. |
| Turn it off or delete it | Not available in the CRM — use Shopify. |

### D. Where results are visible

- **CRM** — listing row (count, conditions, updated time), details header, Overview, Products tab, and the product's own page (its collections).
- **Shopify admin / online store** — the same collection with the same title, handle, description, image, SEO and products.
- **Messages** — every save shows the store's own answer (green) or its refusal (red, inside the confirmation) so you always know whether Shopify accepted the change.

---

## 8. Quick reference

| Topic | Value |
|---|---|
| Types | Custom (manual, you choose products) · Smart (automated, conditions) |
| Required on create | Title; for Smart, ≥ 1 complete condition |
| Title | ≤ 255 characters, unique in the store |
| URL handle | lower-case letters, numbers, dashes (`juice-bottles`); editable later |
| Image address | public `https://` link |
| Page title / Meta description | ≤ 70 / ≤ 320 characters |
| Products at creation (Custom) | ≤ 250 |
| Conditions (Smart) | 1 – 60; match **all** or **any** |
| List page size | 10 / 25 / 50 / 100 (default 50), sort title / products / updated |
| Products tab page size | 10 / 20 / 25 / 50 / 100 (default 20), sort collection order / title / price / inventory / created / updated |
| Not available | Delete, activate/deactivate, change type, bulk actions, export/import |

*Source of truth: `src/features/collections/` (page, list, toolbar, create form, details view, products tab, inline edits, draft/validation rules) and the collections section of `src/lib/api/endpoints.ts`. The available condition columns/operators and product orders are supplied by the backend at runtime.*
