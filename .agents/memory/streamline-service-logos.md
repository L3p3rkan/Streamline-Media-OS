---
name: Streamline service logos
description: How provider logos are sourced and loaded for the Streamline kiosk.
---

Bundle service icons from each provider's published favicon or app-icon URL instead of loading them from external sites at runtime. Keep the source URL inventory with the dashboard and retain a text fallback for every tile.

**Why:** The kiosk serves a locally bundled dashboard with restrictive same-origin image rules; local assets avoid runtime third-party image requests and keep the tiles available offline.

**How to apply:** When adding or refreshing a provider logo, update the local asset, the dashboard's logo map, and the brand asset source inventory together.
