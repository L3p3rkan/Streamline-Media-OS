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

## Install on an existing Ubuntu Desktop

This installs Streamline into an already-installed Ubuntu Desktop session; it does not turn the Debian `build-iso.sh` recipe into an Ubuntu ISO builder. Use a graphical desktop session (Ubuntu Desktop, not Ubuntu Server), and have Firefox and Python 3 installed. The launcher accepts either `firefox-esr` or Ubuntu's `firefox`.

From the project root, build and stage the dashboard, then install it for the currently logged-in desktop user:

```sh
pnpm install --frozen-lockfile
./streamline-os/build-dashboard.sh
sudo ./streamline-os/install-ubuntu.sh
```

The build step needs Node.js 24 and pnpm. The installer copies the kiosk files into `/usr/share/streamline` and `/usr/local/bin`, then adds a per-user desktop autostart entry. Sign out and back in, or reboot, to test it. Streamline starts after that Ubuntu account signs in.

For Ubuntu's Snap-packaged Firefox, the kiosk profile lives in Snap's accessible `~/snap/firefox/common/streamline-profile` directory. On first launch, the helper copies an existing profile from `~/.local/share/streamline/firefox-profile` without deleting the original; **Settings → Clear Login** removes both locations.

If you want the kiosk to start immediately after power-on without a sign-in prompt, enable **Automatic Login** for that account in Ubuntu's Users settings. This lets anyone with physical access use the signed-in account and its saved browser passwords, so only enable it for a privately controlled device. Full-disk encryption helps protect data while the computer is powered off.

To disable auto-launch, remove `~/.config/autostart/streamline-launcher.desktop` for that account.

## Easy install for Ubuntu users

IT can build a downloadable Ubuntu installer package from a version tag. The package includes the prebuilt dashboard, kiosk helper, and automatic start-on-login entry; students do not need Git, Node.js, pnpm, or a terminal.

To build a package locally, use a Debian- or Ubuntu-based build machine with Node.js 24, pnpm, and `dpkg-deb`:

```sh
pnpm install --frozen-lockfile
./streamline-os/build-ubuntu-package.sh
```

The package and its SHA-256 checksum are written to `streamline-os/packages/`. To produce a release download, push a version tag such as `v0.1.7`; GitHub Actions builds the package and attaches it to that release. Because this source repository is private, IT must download the package and share it through an approved university channel or USB drive.

On the student computer, download the `.deb` and open it with Ubuntu's software installer. Alternatively, install it from the folder containing the package:

```sh
sudo apt install ./streamline-kiosk_0.1.7_amd64.deb
```

Sign out and back in, or reboot, to start Streamline and apply the local input-device permission. The package does not enable automatic login; configure that separately only if appropriate for the student's private device. It installs a system-wide desktop autostart entry, so Streamline starts for desktop users on that computer.

To upgrade, install a newer `.deb` the same way. To remove Streamline, run `sudo apt remove streamline-kiosk`; this removes the app and its autostart entry but **does not erase saved Firefox logins, profiles, or paired-phone records**. Use **Settings → Clear Login** for browser data and revoke phones in **Settings → Paired phones** before transferring the computer.

## First use

1. Boot the USB image on the EliteDesk.
2. From the dashboard, open **Settings → Wi-Fi setup**. This opens the system Wi-Fi panel, where NetworkManager can join home or university networks, including enterprise sign-in and certificate options. Credentials are stored by NetworkManager, not by Streamline.
3. Open a provider from the Streamline dashboard and sign in on its official site. Firefox's DRM-controlled content setting is enabled in the kiosk profile by default.
4. If desired, let Firefox save the sign-in in its local password manager. Consider setting a Firefox Primary Password and enabling full-disk encryption when installing the system.
5. Use **Settings → Clear Login** to erase this device's Streamline Firefox profile and restart with a clean one.
6. Use **Settings → Pair an iPhone** to display a one-time QR code, then scan it with the Streamline Remote iPhone app. Pairing codes expire after five minutes and can be refreshed.
7. Use **Power** in the header to open **Power Off** or **Restart**. Choose one action in the confirmation dialog; these controls work only on the local kiosk, not the hosted preview.
8. To leave the kiosk, open **Power → Exit Streamline**. This closes Streamline, returns to the desktop, and keeps the app closed for all desktop accounts until the computer restarts. Saved Firefox logins are not removed.

For a Peacock playback comparison, open **Settings → Test Peacock in Chrome**. This requires Google Chrome to already be installed; download its official Linux package from [google.com/chrome](https://www.google.com/chrome/) if needed. It opens a temporary private profile; sign in again for the test, then close the Chrome window to erase its browser data. It does not alter Firefox or its saved logins.

## iPhone remote

The companion app pairs each Streamline PC separately. On the phone, choose **Pair a Streamline PC** and scan that computer's QR code from **Settings → Pair an iPhone**. Select a saved PC to use the trackpad: slide to move the pointer, tap to left-click, and use the Dashboard, Play/Pause, and volume buttons. Use **Settings → Paired phones → Revoke** on the PC to remove a phone's access. Clearing Firefox logins does not change phone pairings.

The project is currently an Expo development app, not an App Store release. Before publishing, the app's bundle identifier must be replaced with one owned by the publisher's Apple developer account.

The app stores its random control token in iOS secure storage. The PC saves only a hash of each token. The input helper accepts a small allowlist of pointer, media, and Firefox Home actions; it does not accept shell commands, text entry, power actions, or streaming-service passwords. Control requests are limited to private local-network addresses and are not relayed through Streamline.

Both devices must be on the same Wi-Fi, and the network must allow device-to-device connections. WPA2-Enterprise protects the wireless link, but it does not guarantee that a campus network permits local connections or provide end-to-end TLS for the remote session. Remote-control traffic uses HTTP on the local network; use only a network approved for this purpose, and do not pair over an untrusted guest or public network. If a firewall is enabled, allow port `8766` only from the local network.

The companion is currently available as an Expo development preview for testing; this repository does not contain a public App Store release.

## USB wireless remote

Most USB wireless remotes that act like a keyboard work with the dashboard's built-in navigation: use the directional pad to move focus and **OK/Enter** to select. In Firefox, **Back** moves one browser-history entry and **Home** (or **Alt+Home** on a keyboard) returns to the dashboard. Escape returns within the dashboard; on third-party service pages, the site/browser handles it normally. Power controls are in the header and require choosing an action from a dialog, which helps prevent accidental shutdowns. Remotes that send only proprietary media-control signals may need their own key-mapping software.

Power requests run as the signed-in desktop user through `systemctl`; the installer does not grant passwordless administrator access. If Ubuntu or Debian blocks the request, the dialog reports the error rather than claiming the computer shut down.

Firefox runs with a dedicated profile under the student's home directory. Keep the operating-system user account private and use full-disk encryption on portable or accessible devices. A Firefox Primary Password adds protection for saved logins; it is separate from the streaming-service passwords.

## Playback and hardware limits

These are ordinary browser links, not licensed native streaming apps or certified streaming hardware. Providers decide whether playback is allowed, which DRM level is available, and what resolution is supported. DRM, HDCP, browser updates, Wi-Fi hardware, display connections, and codec support can affect playback. Streamline does not bypass DRM.

The first target is an HP EliteDesk with 7th-generation Intel Core i5. Model configurations differ, so test the actual Wi-Fi card, HDMI/DisplayPort audio, suspend/resume, video playback, and remote-control keys. The live session is temporary; install to a disk for normal persistent use. Installation and full-disk encryption support should be tested on the exact image before selling it.

## Project files

- `build-dashboard.sh` — builds the web dashboard and stages its static files in the image source.
- `build-ubuntu-package.sh` — creates a versioned `.deb` for existing Ubuntu Desktop computers.
- `build-iso.sh` — creates the Debian Live hybrid ISO.
- `config/package-lists/streamline.list.chroot` — lightweight desktop, browser, Wi-Fi, and media packages.
- `config/includes.chroot/etc/xdg/autostart/streamline-launcher.desktop` — starts the kiosk at desktop login.
- `config/includes.chroot/usr/local/bin/streamline-kiosk` — serves the local app, launches Firefox, and opens local Wi-Fi settings.
- `config/includes.chroot/usr/local/lib/streamline/streamline_remote.py` — pairs phones on the local network and injects the approved pointer/media controls through Linux `uinput`.
