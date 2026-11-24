# Streamline OS

Streamline OS is a Debian Live image recipe for repurposed HP EliteDesk computers with 7th-generation Intel Core i5 processors. It boots to a keyboard- and remote-friendly browser launcher, supports enterprise Wi-Fi through NetworkManager, and includes Intel media acceleration packages.

## What this first build does

- Boots a live x86-64 desktop with XFCE and LightDM auto-login.
- Opens Firefox ESR in kiosk mode to a local launcher with official streaming-service websites.
- Includes NetworkManager's graphical connection editor and WPA supplicant for WPA2/WPA3-Enterprise (802.1X), including EAP-TLS, PEAP, and TTLS options.
- Includes Intel VA-API and Wi-Fi firmware packages where Debian's non-free repositories provide them.
- Does not store service logins or Wi-Fi credentials in the image.

This is a first bootable live-image recipe, not a provider-certified device or a promise that every service will play at every resolution. Netflix, Hulu, Plex, Paramount+, and other providers control browser support, Widevine/DRM levels, HDCP requirements, account eligibility, and available resolutions. Firefox may need to download its Widevine component after first launch. Use only the providers' official sites and supported playback paths; Streamline OS does not bypass DRM.

## Build the live USB image

Build on a Debian stable x86-64 machine or VM with internet access and at least 30 GB of free disk space. The build uses Debian Live's packages and must run as root. It cannot produce a bootable image from this Replit Linux environment because it does not have the required Debian chroot build tools and privileges.

Install the build tools on the Debian build machine:

```sh
sudo apt update
sudo apt install live-build debootstrap xorriso squashfs-tools
```

From the project root, build:

```sh
sudo ./streamline-os/build-iso.sh
```

The resulting hybrid ISO is written to `streamline-os/live-image-amd64.hybrid.iso`. Write it to a USB drive with a disk-imaging tool, then boot an EliteDesk from that USB. The script deliberately does not write to USB devices or install anything on the target computer.

To build against a named Debian suite instead of the current stable alias:

```sh
sudo DEBIAN_SUITE=trixie ./streamline-os/build-iso.sh
```

## First boot

1. Connect a display over HDMI or DisplayPort, plus a keyboard or supported USB remote.
2. Boot the live USB and wait for the Streamline launcher.
3. Open **Network Settings** from the desktop menu or run `nm-connection-editor` from a terminal.
4. Add the organization's Wi-Fi network, select **WPA & WPA2 Enterprise**, choose the EAP method and identity, and provide the organization's CA certificate or client certificate/key when required.
5. Open a provider tile and sign in on that provider's official website.

For EAP-TLS, obtain the client certificate and private key from the network administrator. Keep them on the device or a removable drive with appropriate file permissions; never put them in this repository or the image build.

## Controls

- Move through launcher links with Tab or arrow keys and activate with Enter.
- Use the browser's Back command (Alt+Left) to return to the launcher.
- Exit the browser with Alt+F4 to reach the XFCE desktop and network settings.

## Hardware notes

The initial target is an HP EliteDesk with a 7th-generation Intel Core i5. This is x86-64 hardware, but EliteDesk models differ in Wi-Fi card, memory, graphics output, and firmware settings. Check that the specific unit has a compatible Intel Wi-Fi adapter; Ethernet is available as a fallback. VA-API support depends on the exact Intel graphics device, browser configuration, and media codec.

Before daily use, test HDMI audio, suspend/resume, Wi-Fi roaming, remote-control keys, and playback in each service. Live-session settings and downloads are temporary unless the image is later extended with persistence or installed to disk.

## Project layout

- `build-iso.sh` — guarded Debian Live build command.
- `config/package-lists/streamline.list.chroot` — installed packages.
- `config/includes.chroot/` — launcher, auto-login, and session configuration copied into the image.
- `config/includes.chroot/etc/NetworkManager/conf.d/` — NetworkManager Wi-Fi defaults.
