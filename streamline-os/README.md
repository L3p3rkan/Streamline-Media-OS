# Streamline OS

Streamline is a lightweight Debian Live image for personal-use HP EliteDesk computers with 7th-generation Intel Core i5 processors. XFCE provides the desktop; the custom dashboard opens in Firefox kiosk mode. Students sign in directly on official streaming-service websites.

## What is included

- Debian Live for x86-64, with XFCE, Firefox ESR, Intel media-driver packages, and common Wi-Fi firmware.
- NetworkManager's graphical editor for enterprise Wi-Fi (802.1X), including EAP-TLS, PEAP, and TTLS.
- A full-screen Streamline dashboard with official links for major streaming providers.
- A dedicated Firefox profile that can remember a student's sign-ins without the dashboard receiving credentials.
- A **Clear Login** action that closes Firefox, deletes the dedicated browser profile (saved passwords, cookies, and site data), and relaunches a clean profile.

The dashboard never asks for usernames or passwords. Students enter them only on the providers' official sites, and Firefox handles password saving. Clearing the Streamline profile signs out of all sites in that kiosk browser and removes all saved browser logins in that profile. It does not delete or cancel the student's service accounts.

## Build

The ISO must be built on a Debian x86-64 machine or VM with internet access, at least 30 GB free disk space, and root privileges. Build the dashboard first from the project root:

```sh
pnpm install --frozen-lockfile
./streamline-os/build-dashboard.sh
```

The dashboard build needs Node.js 24 and pnpm. Then install the Debian image tools and build the bootable image:

```sh
sudo apt update
sudo apt install live-build debootstrap xorriso squashfs-tools
sudo ./streamline-os/build-iso.sh
```

The ISO is written to `streamline-os/live-image-amd64.hybrid.iso`. The build script does not write to USB drives or install onto a computer. Use a disk-imaging utility to write the ISO to a USB drive, then boot an EliteDesk from it.

To select a named Debian suite:

```sh
sudo DEBIAN_SUITE=trixie ./streamline-os/build-iso.sh
```

The Replit environment can build and preview the dashboard, but it cannot produce the ISO because it lacks the privileged Debian image-building environment.

## First use

1. Boot the USB image on the EliteDesk and connect to Wi-Fi or Ethernet.
2. For enterprise Wi-Fi, open **Network Settings** from the XFCE desktop and add the institution's network. Follow the institution's instructions for EAP method and certificates.
3. Open a provider from the Streamline dashboard and sign in on its official site.
4. If desired, let Firefox save the sign-in in its local password manager. Consider setting a Firefox Primary Password and enabling full-disk encryption when installing the system.
5. Use **Settings → Clear Login** to erase this device's Streamline Firefox profile and restart with a clean one.

Firefox runs with a dedicated profile under the student's home directory. Keep the operating-system user account private and use full-disk encryption on portable or accessible devices. A Firefox Primary Password adds protection for saved logins; it is separate from the streaming-service passwords.

## Playback and hardware limits

These are ordinary browser links, not licensed native streaming apps or certified streaming hardware. Providers decide whether playback is allowed, which DRM level is available, and what resolution is supported. DRM, HDCP, browser updates, Wi-Fi hardware, display connections, and codec support can affect playback. Streamline does not bypass DRM.

The first target is an HP EliteDesk with 7th-generation Intel Core i5. Model configurations differ, so test the actual Wi-Fi card, HDMI/DisplayPort audio, suspend/resume, video playback, and remote-control keys. The live session is temporary; install to a disk for normal persistent use. Installation and full-disk encryption support should be tested on the exact image before selling it.

## Project files

- `build-dashboard.sh` — builds the web dashboard and stages its static files in the image source.
- `build-iso.sh` — creates the Debian Live hybrid ISO.
- `config/package-lists/streamline.list.chroot` — lightweight desktop, browser, Wi-Fi, and media packages.
- `config/includes.chroot/etc/xdg/autostart/streamline-launcher.desktop` — starts the kiosk at desktop login.
- `config/includes.chroot/usr/local/bin/streamline-kiosk` — serves the local app, launches Firefox, and handles profile clearing.
