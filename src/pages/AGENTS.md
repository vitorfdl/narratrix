# Pages UI Consistency

These conventions apply to page-level React screens under `src/pages/`.

## Library Page Header

For collection/library pages such as Models, Characters, and Agents, prefer the `ModelsPage` header pattern:

- Use a sticky header with `border-b bg-background/95 backdrop-blur`.
- Use a simple accent bar beside the page title: `h-6 w-1 rounded-full bg-primary`.
- Do not use large icon tiles in page headers.
- Place the primary create/add action on the right side of the title row.
- Use a second toolbar row for search, refresh, import, sort, and clear filters.
- Keep search inputs visually consistent: `h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm`.
- Use icon-only outline buttons with `bg-background` for utility actions.

## Collection Layout

- Prefer responsive `auto-fill` grids over manual "cards per row" controls. Use `auto-fill` (not `auto-fit`) so cards stay near their min width when there are few items, instead of stretching to fill the row.
- Keep page-specific card size settings only when they already exist and affect minimum card width.
- Avoid showing low-value result text in headers unless it helps navigation; sidebars or tabs can carry counts.
- Empty and loading states should be centered, compact, and visually quiet.

## Cards

- Cards should prioritize the item's name, short description/context, and primary status.
- Avoid oversized metric blocks for secondary metadata; place counts like nodes, links, dates, and similar details in subtle footer metadata.
- Use destructive actions consistently: delete belongs in the top-right hover action area and must ask for confirmation.
- Use `DestructiveConfirmDialog` for destructive confirmations instead of native `window.confirm`.
- Avoid redundant badges when every item on the page shares the same type.

## Sidebars And Filters

- Tag sidebars should reserve enough width for labels and counts.
- Keep counts in separate shrink-safe elements so labels truncate before counts clip.
- Provide a clear active-filter control when tags are selected.
