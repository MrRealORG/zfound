# ZFound Mobile - Companion Android App 📱

High-speed native Android camera companion for **ZFound**. Connects seamlessly over your local Wi-Fi router to instantly transfer captured product photos directly into your ZFound PC session.

---

## ✨ Features

- **⚡ Instant Local Wi-Fi Sync**: Zero cloud latency, zero external servers. Direct device-to-PC sync over your home/office Wi-Fi router.
- **📷 CameraX Hardware Acceleration**: Smooth 60fps viewfinder, tap-to-focus, flash/torch control, and instant lens switching.
- **🔍 1-Click QR Pairing**: Built-in Google ML Kit barcode scanner automatically reads the desktop QR code, extracts your PC's IP and 6-digit PIN, and pairs instantly.
- **🤖 Automatic AI Pipeline**: The moment you tap the shutter button on your phone, the photo lands in ZFound on your PC, auto-detects all products using PP-PicoDet-XS, and generates cropped bounding boxes in real time.
- **📁 Gallery Upload**: Pick existing photos from your phone gallery and send them straight into the active scanning session.
- **🔒 PIN Security**: Session-scoped 6-digit PIN ensures only your authorized device can submit photos to your PC session.

---

## 🛠️ How to Open and Build in Android Studio

### 1. Requirements
- **Android Studio Hedgehog (2023.1.1)** or newer.
- **Android SDK Platform 34** (installed via SDK Manager).
- Phone running **Android 7.0 (Nougat, API 24)** or higher.

### 2. Opening the Project
1. Open **Android Studio**.
2. Click **File -> Open...**
3. Navigate to `zfound/android` and click **OK**.
4. Allow Gradle to sync dependencies (`androidx.camera`, `com.google.mlkit`, `com.squareup.okhttp3`).

### 3. Running on your Android Phone
1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone via USB cable (or Wireless ADB).
3. Select your phone in Android Studio's device selector dropdown at the top.
4. Click the green **Run (▶)** button or press `Shift + F10`.

### 4. Building Standalone APK
To generate a standalone `.apk` you can install on any Android phone:
```bash
cd zfound/android
./gradlew assembleDebug
```
The APK will be generated at:
`zfound/android/app/build/outputs/apk/debug/app-debug.apk`

Transfer this APK to your phone and tap to install!

---

## 🚀 How to Connect Phone to PC

1. **Ensure Same Wi-Fi Router**:
   - Make sure your PC and Android phone are connected to the same Wi-Fi router or hotspot.

2. **Open ZFound on PC**:
   - Launch ZFound on your PC.
   - Click the **📱 Connect Phone** button in the top scanner header.
   - A modal will pop up displaying a high-contrast QR code and a 6-digit PIN.

3. **Scan QR Code in the App**:
   - Open **ZFound Camera** on your phone.
   - Tap the **Scan QR Code** button.
   - Point your phone camera at your PC screen.
   - The status badge will instantly turn green (`Connected to <PC_NAME>`).

4. **Click & Capture**:
   - Point your phone camera at items, inventory, or products.
   - Tap the white shutter button.
   - The photo instantly transfers to your PC, adds to the active session carousel, and runs automatic AI product detection!

---

## 🌐 Instant Web Alternative (No Installation Needed!)

If you want to take photos immediately without building or installing an APK:
1. Click **📱 Connect Phone** on your PC.
2. Open your phone's native camera app or browser.
3. Scan the QR code with your phone camera.
4. It opens the web camera companion (`http://<PC_IP>:7890/mobile?pin=<PIN>`) directly in Chrome/Safari with the exact same instant sync!
