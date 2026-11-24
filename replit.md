# Streamline OS

Debian Live image sources for an Intel x86-64 living-room media PC, with a TV-friendly streaming launcher and WPA-Enterprise Wi-Fi support.

## Build

- Read `streamline-os/README.md` for prerequisites, the ISO build command, hardware notes, and known streaming-service limits.
- `streamline-os/build-iso.sh` builds the image on a supported Debian host. It requires root privileges and Debian Live build tools.
- Build outputs are ignored under `streamline-os/`.

## Product

- Boots to a simple browser launcher with official links for Netflix, Hulu, Plex, Paramount+, and other services.
- Uses Firefox ESR for browser-based playback; each provider controls its own DRM, resolution, and device restrictions.
- Uses NetworkManager for WPA2/WPA3-Enterprise (802.1X), including EAP-TLS, PEAP, and TTLS through the network settings UI.
- Initial hardware target: HP EliteDesk computers with 7th-generation Intel Core i5 processors.

## Security and support boundaries

- The image does not bundle service credentials, proprietary provider applications, or DRM workarounds.
- Enterprise Wi-Fi passwords and certificates are configured by the owner; do not commit them to this project.
- Validate the live image on the target hardware before installing it or relying on it as a daily-use system.
