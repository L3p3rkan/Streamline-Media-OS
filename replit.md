# Streamline

An easy-to-use streaming dashboard and lightweight Debian Live image for personal-use HP EliteDesk computers.

## Build

- `artifacts/streamline-dashboard` — full-screen dashboard for official streaming provider sites.
- `streamline-os/README.md` — image-build prerequisites, first-use steps, and playback limits.
- `streamline-os/build-dashboard.sh` builds and stages the dashboard for the Linux image.
- `streamline-os/build-iso.sh` builds the image on Debian x86-64 with root privileges and Debian Live tools.
- Generated bundles and ISO outputs are ignored by Git and deployment packaging.

## Product

- Boots to the Streamline dashboard in Firefox kiosk mode, with official links for major streaming providers.
- Uses a dedicated Firefox profile so browser password saving stays on the user's device; the dashboard never sees credentials.
- The Clear Login control erases the dedicated Firefox profile, including saved passwords, cookies, and site data, then starts a clean profile.
- Uses NetworkManager for WPA2/WPA3-Enterprise (802.1X), including EAP-TLS, PEAP, and TTLS through the network settings UI.
- Initial hardware target: HP EliteDesk computers with 7th-generation Intel Core i5 processors.

## Security and support boundaries

- The dashboard must not collect or store provider credentials; sign-in happens only on official provider sites in Firefox.
- Enterprise Wi-Fi passwords and certificates are configured by the owner; do not commit them to this project.
- Test provider DRM playback and disk-encryption/install flows on the actual EliteDesk model before distribution.
