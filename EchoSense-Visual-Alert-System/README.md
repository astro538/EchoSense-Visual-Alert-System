# EchoSense — Duplicate Project Copy

This folder contains a nested copy of several EchoSense source files. For the current project overview, setup instructions, hardware pin map, limitations, evaluation guidance, and security notes, start with the [repository-root README](../README.md).

Use the repository-root source paths where possible:
- `../firmware/esp32_firmware/esp32_firmware.ino`
- `../python_backend/`
- `../web_portal/`

The repository currently contains overlapping root-level and nested files. Before a public research demonstration, consolidate to one source of truth and check that the exact firmware and Python entry point documented at the root are the ones being used.

Do not commit Wi-Fi passwords, Firebase authentication values, API keys, or other secrets. Any credentials previously included in tracked files or their history should be rotated/revoked.
