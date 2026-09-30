"""
ZFound Local Wi-Fi Sync Server & Mobile Camera Bridge.
Enables instant, zero-lag transfer of photos from an Android phone (or any mobile device)
to the PC over the same local Wi-Fi / LAN network.

Features:
1. Threaded HTTP Server running in the background on PC.
2. Automatic discovery of host machine's local Wi-Fi IP (e.g. 192.168.x.x).
3. 6-digit session PIN pairing security.
4. Instant QR code generation with OpenCV (cv2.QRCodeEncoder_create).
5. Zero-install Mobile Web Camera Client (served at /mobile) with native feel,
   torch/flash, camera toggle, and auto-transfer on shutter click.
6. REST API for Native Android App (/api/status, /api/upload, /api/events).
"""

import os
import sys
import json
import time
import socket
import base64
import threading
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import cv2
import numpy as np

def get_primary_local_ip() -> str:
    """Finds the local machine's primary LAN/Wi-Fi IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Route determination without sending any data
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def find_available_port(start_port: int = 7890, max_tries: int = 50) -> int:
    """Finds an open port starting from start_port."""
    for p in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("0.0.0.0", p)) != 0:
                return p
    return start_port

def generate_qr_b64(text: str, size: int = 300) -> str:
    """Generates a high-contrast base64 PNG data URL for the given text using OpenCV."""
    try:
        enc = cv2.QRCodeEncoder_create()
        qr_mat = enc.encode(text)
        if qr_mat is not None and qr_mat.size > 0:
            # Add quiet zone border (4 modules)
            padded = cv2.copyMakeBorder(qr_mat, 4, 4, 4, 4, cv2.BORDER_CONSTANT, value=255)
            resized = cv2.resize(padded, (size, size), interpolation=cv2.INTER_NEAREST)
            success, buf = cv2.imencode(".png", resized)
            if success:
                b64 = base64.b64encode(buf.tobytes()).decode("ascii")
                return f"data:image/png;base64,{b64}"
    except Exception as e:
        print(f"[SyncServer] QR generation error: {e}")
    return ""


# Embedded, responsive, high-performance Mobile Camera Web App HTML
MOBILE_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#080c14">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>ZFound Mobile Camera</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body, html {
            width: 100%; height: 100%; overflow: hidden;
            background: #06090e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #f1f5f9; display: flex; flex-direction: column;
        }
        .header-bar {
            height: 56px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
            background: rgba(11, 15, 25, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            z-index: 20; flex-shrink: 0;
        }
        .brand-group { display: flex; align-items: center; gap: 8px; }
        .brand-logo { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .status-pill {
            display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
            font-size: 11px; font-weight: 600; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399;
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; }
        .status-dot.disconnected { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .icon-btn {
            width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12);
            color: #f1f5f9; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;
        }
        .icon-btn:active { transform: scale(0.92); background: rgba(255, 255, 255, 0.18); }
        .icon-btn.active { background: rgba(245, 158, 11, 0.25); border-color: #f59e0b; color: #fbbf24; }
        
        .viewport-container {
            flex: 1; position: relative; width: 100%; overflow: hidden; background: #000;
            display: flex; align-items: center; justify-content: center;
        }
        video {
            width: 100%; height: 100%; object-fit: cover;
        }
        canvas { display: none; }
        
        .shutter-flash {
            position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity 0.2s ease-out; z-index: 10;
        }
        .shutter-flash.flashing { opacity: 0.9; }

        .overlay-toast {
            position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
            padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
            background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.4);
            color: #f8fafc; z-index: 15; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            display: flex; align-items: center; gap: 8px; opacity: 0; pointer-events: none; transition: all 0.25s ease;
        }
        .overlay-toast.visible { opacity: 1; transform: translateX(-50%) translateY(4px); }
        
        .bottom-dock {
            height: 110px; padding: 0 24px 16px 24px; display: flex; align-items: center; justify-content: space-between;
            background: rgba(11, 15, 25, 0.9); backdrop-filter: blur(16px); border-top: 1px solid rgba(255, 255, 255, 0.08);
            z-index: 20; flex-shrink: 0;
        }
        .gallery-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .gallery-btn {
            width: 46px; height: 46px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f1f5f9; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative;
        }
        .gallery-btn img { width: 100%; height: 100%; object-fit: cover; }
        .dock-label { font-size: 10px; color: #94a3b8; font-weight: 500; }
        
        .shutter-outer {
            width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.85);
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            box-shadow: 0 0 20px rgba(56, 189, 248, 0.35); transition: transform 0.15s ease;
        }
        .shutter-outer:active { transform: scale(0.92); }
        .shutter-inner {
            width: 62px; height: 62px; border-radius: 50%; background: #ffffff;
            transition: all 0.15s ease;
        }
        .shutter-outer:active .shutter-inner { background: #38bdf8; transform: scale(0.88); }
        
        .sent-counter-wrap {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .sent-badge {
            min-width: 44px; height: 44px; padding: 0 10px; border-radius: 12px; background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center;
            font-size: 16px; font-weight: 700; color: #38bdf8;
        }
        
        .hidden-input { display: none; }
    </style>
</head>
<body>
    <header class="header-bar">
        <div class="brand-group">
            <span class="brand-logo">ZFound</span>
            <div class="status-pill" id="conn-status-pill">
                <span class="status-dot" id="conn-dot"></span>
                <span id="conn-label">Connecting...</span>
            </div>
        </div>
        <div class="header-actions">
            <button class="icon-btn" id="btn-flash" title="Toggle Torch Flash">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </button>
            <button class="icon-btn" id="btn-switch-cam" title="Switch Camera">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 16v5h-5"/><path d="M4 8V3h5"/><path d="M4 16v-2a8 8 0 0 1 14.93-4"/><path d="M20 8v2a8 8 0 0 1-14.93 4"/></svg>
            </button>
        </div>
    </header>

    <main class="viewport-container">
        <video id="video-stream" autoplay playsinline muted></video>
        <canvas id="capture-canvas"></canvas>
        <div class="shutter-flash" id="shutter-flash"></div>
        <div class="overlay-toast" id="overlay-toast">
            <span id="toast-icon">✨</span>
            <span id="toast-text">Ready</span>
        </div>
    </main>

    <footer class="bottom-dock">
        <div class="gallery-wrap">
            <label for="gallery-input" class="gallery-btn" id="btn-gallery">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <img id="last-thumb-img" style="display:none;" alt="Last">
            </label>
            <input type="file" id="gallery-input" accept="image/*" class="hidden-input">
            <span class="dock-label">Gallery</span>
        </div>

        <div class="shutter-outer" id="btn-shutter">
            <div class="shutter-inner"></div>
        </div>

        <div class="sent-counter-wrap">
            <div class="sent-badge" id="sent-count">0</div>
            <span class="dock-label">Sent to PC</span>
        </div>
    </footer>

    <script>
        const PIN = new URLSearchParams(window.location.search).get('pin') || localStorage.getItem('zfound_pin') || '';
        if (PIN) localStorage.setItem('zfound_pin', PIN);

        const video = document.getElementById('video-stream');
        const canvas = document.getElementById('capture-canvas');
        const shutterBtn = document.getElementById('btn-shutter');
        const flashBtn = document.getElementById('btn-flash');
        const switchBtn = document.getElementById('btn-switch-cam');
        const galleryInput = document.getElementById('gallery-input');
        const connLabel = document.getElementById('conn-label');
        const connDot = document.getElementById('conn-dot');
        const toast = document.getElementById('overlay-toast');
        const toastText = document.getElementById('toast-text');
        const toastIcon = document.getElementById('toast-icon');
        const shutterFlash = document.getElementById('shutter-flash');
        const sentCountEl = document.getElementById('sent-count');
        const lastThumbImg = document.getElementById('last-thumb-img');

        let currentStream = null;
        let facingMode = 'environment';
        let torchActive = false;
        let sentCount = 0;
        let isUploading = false;

        function showToast(text, icon = '✓') {
            toastText.textContent = text;
            toastIcon.textContent = icon;
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 2200);
        }

        async function initCamera() {
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
            try {
                const constraints = {
                    video: {
                        facingMode: { ideal: facingMode },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
                currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = currentStream;
            } catch (err) {
                console.warn('Camera stream error, using fallback:', err);
                showToast('Camera error: ' + err.message, '⚠️');
            }
        }

        async function toggleTorch() {
            if (!currentStream) return;
            const track = currentStream.getVideoTracks()[0];
            if (!track) return;
            try {
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                if (capabilities.torch) {
                    torchActive = !torchActive;
                    await track.applyConstraints({ advanced: [{ torch: torchActive }] });
                    flashBtn.classList.toggle('active', torchActive);
                } else {
                    showToast('Torch not supported on this lens', 'ℹ️');
                }
            } catch (e) {
                showToast('Flash error', '⚠️');
            }
        }

        switchBtn.addEventListener('click', () => {
            facingMode = (facingMode === 'environment') ? 'user' : 'environment';
            initCamera();
        });

        flashBtn.addEventListener('click', toggleTorch);

        async function uploadPhoto(dataUrl) {
            if (isUploading) return;
            isUploading = true;
            showToast('Transferring to PC...', '🚀');
            try {
                const resp = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: dataUrl,
                        pin: PIN,
                        device: navigator.userAgent.includes('Android') ? 'Android Phone' : 'Mobile Device'
                    })
                });
                const res = await resp.json();
                if (res.status === 'success') {
                    sentCount++;
                    sentCountEl.textContent = sentCount;
                    lastThumbImg.src = dataUrl;
                    lastThumbImg.style.display = 'block';
                    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
                    showToast(res.message || 'Sent to PC!', '✓');
                } else {
                    showToast(res.message || 'Transfer failed', '⚠️');
                }
            } catch (err) {
                showToast('Network error: ' + err.message, '⚠️');
            } finally {
                isUploading = false;
            }
        }

        function snapPhoto() {
            if (isUploading) return;
            if (navigator.vibrate) navigator.vibrate(50);
            
            // Shutter animation
            shutterFlash.classList.add('flashing');
            setTimeout(() => shutterFlash.classList.remove('flashing'), 160);

            if (video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                uploadPhoto(dataUrl);
            } else {
                galleryInput.click();
            }
        }

        shutterBtn.addEventListener('click', snapPhoto);

        galleryInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                uploadPhoto(evt.target.result);
            };
            reader.readAsDataURL(file);
        });

        async function checkConnection() {
            try {
                const r = await fetch('/api/status?pin=' + encodeURIComponent(PIN));
                const d = await r.json();
                if (d.status === 'online') {
                    connLabel.textContent = d.pc_name || 'PC Connected';
                    connDot.classList.remove('disconnected');
                } else {
                    connLabel.textContent = 'Auth Failed';
                    connDot.classList.add('disconnected');
                }
            } catch (e) {
                connLabel.textContent = 'Offline';
                connDot.classList.add('disconnected');
            }
        }

        initCamera();
        checkConnection();
        setInterval(checkConnection, 5000);
    </script>
</body>
</html>
"""


class SyncServerHandler(BaseHTTPRequestHandler):
    """Handles incoming HTTP requests from Android phone and PC client."""
    server_instance = None

    def _set_cors_headers(self, content_type: str = "application/json"):
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)

        # 1. Root or /mobile: Serve mobile camera web app
        if path == "" or path == "/mobile":
            self.send_response(200)
            self._set_cors_headers("text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(MOBILE_HTML_TEMPLATE.encode("utf-8"))
            return

        # 2. Handshake status endpoint
        if path == "/api/status":
            pin = query.get("pin", [""])[0]
            valid_pin = (pin == self.server_instance.pin) if self.server_instance.pin else True
            payload = {
                "status": "online",
                "server": "ZFound Sync",
                "pc_name": socket.gethostname(),
                "pin_valid": valid_pin,
                "photos_received": self.server_instance.received_count
            }
            self.send_response(200)
            self._set_cors_headers("application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        # 3. QR Code image
        if path == "/api/qr":
            url = self.server_instance.get_mobile_url()
            qr_b64 = generate_qr_b64(url, size=320)
            if qr_b64 and "," in qr_b64:
                raw_png = base64.b64decode(qr_b64.split(",", 1)[1])
                self.send_response(200)
                self._set_cors_headers("image/png")
                self.end_headers()
                self.wfile.write(raw_png)
                return

        # 4. Long-polling / events check
        if path == "/api/events":
            events = self.server_instance.get_pending_events()
            self.send_response(200)
            self._set_cors_headers("application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "events": events}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # 1. Upload photo from mobile
        if path == "/api/upload":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "No data provided"}).encode("utf-8"))
                return

            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}

            image_data = data.get("image")
            req_pin = data.get("pin", "")
            device = data.get("device", "Android Phone")

            if self.server_instance.pin and req_pin != self.server_instance.pin:
                self.send_response(401)
                self._set_cors_headers("application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Invalid pairing PIN"}).encode("utf-8"))
                return

            if not image_data:
                self.send_response(400)
                self._set_cors_headers("application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Missing image field"}).encode("utf-8"))
                return

            # Dispatch image to ZFound API callback
            result = self.server_instance.on_image_received(image_data, device)
            self.server_instance.received_count += 1

            self.send_response(200)
            self._set_cors_headers("application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress noisy standard HTTP access logs
        pass


class SyncServer:
    """Manages the background HTTP sync server and mobile device connections."""

    def __init__(self, api_callback=None, port: int = 7890):
        self.api_callback = api_callback
        self.host = "0.0.0.0"
        self.local_ip = get_primary_local_ip()
        self.port = find_available_port(port)
        # 6-digit friendly numeric PIN
        self.pin = f"{int(time.time() * 1000) % 900000 + 100000}"
        self.server = None
        self.thread = None
        self.is_running = False
        self.received_count = 0
        self._events_lock = threading.Lock()
        self._pending_events = []

    def start(self):
        """Starts the sync server in a daemon background thread."""
        if self.is_running:
            return

        SyncServerHandler.server_instance = self
        try:
            self.server = ThreadingHTTPServer((self.host, self.port), SyncServerHandler)
            self.is_running = True
            self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            self.thread.start()
            print(f"[SyncServer] Running at http://{self.local_ip}:{self.port} (PIN: {self.pin})")
        except Exception as e:
            print(f"[SyncServer] Failed to bind to port {self.port}: {e}")
            self.is_running = False

    def stop(self):
        """Shuts down the sync server."""
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass
        self.is_running = False

    def get_mobile_url(self) -> str:
        """Returns the full URL for the mobile camera client including pairing PIN."""
        return f"http://{self.local_ip}:{self.port}/mobile?pin={self.pin}"

    def get_connection_info(self) -> dict:
        """Returns metadata and QR code for the desktop UI."""
        url = self.get_mobile_url()
        qr_b64 = generate_qr_b64(url, size=300)
        return {
            "status": "online" if self.is_running else "offline",
            "local_ip": self.local_ip,
            "port": self.port,
            "pin": self.pin,
            "url": url,
            "qr_b64": qr_b64,
            "received_count": self.received_count
        }

    def on_image_received(self, base64_data: str, device_name: str) -> dict:
        """Dispatches an incoming image to ZFoundApi."""
        if self.api_callback:
            try:
                res = self.api_callback(base64_data, device_name)
                with self._events_lock:
                    self._pending_events.append({
                        "type": "photo_received",
                        "device": device_name,
                        "timestamp": time.time(),
                        "result": res
                    })
                return res
            except Exception as e:
                return {"status": "error", "message": f"Processing error: {e}"}
        return {"status": "success", "message": "Image received"}

    def get_pending_events(self) -> list:
        """Retrieves and clears pending events for frontend polling."""
        with self._events_lock:
            evts = list(self._pending_events)
            self._pending_events.clear()
            return evts
