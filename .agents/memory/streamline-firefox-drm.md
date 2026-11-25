---
name: Streamline Firefox DRM
description: Firefox profile DRM settings that affect streaming playback in the Streamline kiosk.
---

For Apple TV+ playback in Streamline, enable Firefox's “Play DRM-controlled content” setting in the dedicated kiosk profile. The user confirmed that enabling it resolved playback.

**Why:** The kiosk profile's DRM setting is separate from the user's phone or other browser profiles; when disabled, protected playback fails even though the dashboard link works.

**How to apply:** When DRM-protected streaming fails in Streamline, first check `about:preferences#general` in the kiosk Firefox profile before assuming the provider URL is wrong or changing the browser configuration.
