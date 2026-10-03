# Offline Route App

A standalone offline mobile app built with React Native and Expo for managing and viewing GPX and KML off-road map routes.

## Features

- **Interactive Map Engine:** Uses `@maplibre/maplibre-react-native` to render high-performance maps.
- **Offline Capable:** Core architecture is designed for offline usage, with imported routes saved locally.
- **Route Importing:** Allows parsing and importing of Ovi Maps exported `.gpx` and `.kml` files.
- **Local Persistence:** Securely stores your parsed routes using Expo's FileSystem for access at any time.
- **Auto-Fit Map Bounds:** Automatically positions the camera correctly over your active route.

## Technology Stack

- **Framework:** React Native / Expo (SDK 52+)
- **Language:** TypeScript
- **Mapping:** `@maplibre/maplibre-react-native`
- **Parsing:** `fast-xml-parser`
- **Geo Math:** `@turf/turf`, `@turf/bbox`
- **Testing:** Jest

## Setup

Ensure you have Node.js and a compatible package manager installed. The app requires prebuilding into native projects for local execution.

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Prebuild the project (Android/iOS): `npx expo prebuild --clean`

## Legacy Code Backup

This repository originally hosted a full-stack web demo which was migrated and backed up in `archive/v1-web-demo` (if applicable) prior to transitioning to this standalone offline mobile setup.

## GitHub Actions

The repository includes a GitHub Actions CI pipeline configured to build an Android APK (`app-debug.apk`) and an unsigned iOS application (`app-unsigned.ipa`) automatically upon push and pull requests to `main`.
