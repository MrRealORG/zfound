import os
import sys
import json
import base64
import subprocess
import threading
from pathlib import Path
from io import BytesIO
from PIL import Image

import webview

# Add zfound to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from core.scanner import FastScanner
from core.hasher import FastHasher
from core.embedder import FastEmbedder
from core.indexer import FastIndexer

class ZFoundApi:
    def __init__(self, window=None):
        self.window = window
        self.scanner = FastScanner()
        self.hasher = FastHasher()
        self.embedder = FastEmbedder()
        self.indexer = FastIndexer()
        self.scanned_items = []
        self.current_folder = ""
        self.is_indexing = False

    def set_window(self, window):
        self.window = window

    def get_app_info(self):
        models = self.embedder.detect_local_models()
        return {
            "name": "ZFound",
            "branding": "ZFound × Zeeno Soft",
            "version": "0.1.0",
            "models_available": models,
            "active_model": self.embedder.model_name or (models[0]["name"] if models else None),
            "model_ready": self.embedder.is_ready,
            "dimension": self.embedder.dimension,
            "scanned_count": len(self.scanned_items),
            "indexed_count": len(self.indexer.items)
        }

    def init_background_model(self):
        """Silently initialize the local model in background without intrusive UI blocking"""
        def _worker():
            try:
                models = self.embedder.detect_local_models()
                if models:
                    self.embedder.load_model(models[0]["path"])
                    if self.window:
                        self.window.evaluate_js(f"window.onModelReady && window.onModelReady({json.dumps(self.embedder.model_name)});")
            except Exception as e:
                print(f"[Init] Model auto-load warning: {e}")
        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        return True

    def select_folder(self):
        if not self.window:
            return None
        result = self.window.create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            return result[0].replace("\\", "/")
        return None

    def select_image_file(self):
        if not self.window:
            return None
        file_types = ('Image Files (*.jpg;*.jpeg;*.png;*.webp;*.bmp)', 'All files (*.*)')
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        if result and len(result) > 0:
            return result[0].replace("\\", "/")
        return None

    def scan_folder(self, folder_path: str, recursive: bool = True):
        self.current_folder = folder_path
        self.scanned_items = []

        def on_progress(count, elapsed):
            if self.window:
                self.window.evaluate_js(f"window.onScanProgress && window.onScanProgress({count});")

        items = self.scanner.scan(folder_path, recursive=recursive, progress_cb=on_progress)
        self.scanned_items = items
        return {
            "status": "success",
            "folder": folder_path,
            "count": len(items),
            "items": items
        }

    def index_scanned_images(self):
        if not self.scanned_items:
            return {"status": "error", "message": "No scanned images to index"}

        if not self.embedder.is_ready:
            models = self.embedder.detect_local_models()
            if not models:
                return {"status": "error", "message": "No local AI models found in models/ folder"}
            self.embedder.load_model(models[0]["path"])

        total = len(self.scanned_items)
        indexed_data = []

        for idx, item in enumerate(self.scanned_items):
            path = item["path"]
            # 1. Compute perceptual hash
            phash = self.hasher.compute_phash(path)
            item["phash"] = phash

            # 2. Compute embedding
            emb = None
            try:
                emb = self.embedder.embed_image(path)
            except Exception as e:
                print(f"[Indexer] Embedding error for {path}: {e}")

            if emb:
                indexed_data.append((item, emb))

            # Send progress every 5 images or at the end
            if (idx + 1) % 5 == 0 or (idx + 1) == total:
                percent = int(((idx + 1) / total) * 100)
                if self.window:
                    self.window.evaluate_js(f"window.onIndexProgress && window.onIndexProgress({idx + 1}, {total}, {percent});")

        indexed_count = self.indexer.build(indexed_data)
        return {
            "status": "success",
            "indexed_count": indexed_count,
            "total_scanned": total
        }

    def search_similar(self, query_image_path: str, top_k: int = 40, min_score: float = 0.0):
        if not self.indexer.is_indexed or len(self.indexer.items) == 0:
            return {"status": "error", "message": "Please scan and index a folder first."}

        if not os.path.exists(query_image_path):
            return {"status": "error", "message": "Query image file does not exist."}

        # 1. Compute query hash
        q_phash = self.hasher.compute_phash(query_image_path)

        # 2. Compute query embedding
        if not self.embedder.is_ready:
            models = self.embedder.detect_local_models()
            if models:
                self.embedder.load_model(models[0]["path"])

        q_emb = self.embedder.embed_image(query_image_path)

        # 3. Query index
        results = self.indexer.search(q_emb, query_phash=q_phash, top_k=top_k, min_score=min_score)

        return {
            "status": "success",
            "query_image": query_image_path.replace("\\", "/"),
            "query_phash": q_phash,
            "total_matches": len(results),
            "results": results
        }

    def get_thumbnail_b64(self, image_path: str, max_size: int = 320):
        try:
            with Image.open(image_path) as img:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                buffered = BytesIO()
                img_format = "PNG" if img.mode == "RGBA" else "JPEG"
                img.save(buffered, format=img_format, quality=80)
                data_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
                mime = f"image/{img_format.lower()}"
                return f"data:{mime};base64,{data_b64}"
        except Exception as e:
            return ""

    def reveal_in_explorer(self, file_path: str):
        try:
            norm_path = os.path.normpath(file_path)
            subprocess.run(["explorer.exe", "/select,", norm_path], check=False)
            return True
        except Exception as e:
            return False

    def open_image(self, file_path: str):
        try:
            norm_path = os.path.normpath(file_path)
            os.startfile(norm_path)
            return True
        except Exception:
            return False


def main():
    api = ZFoundApi()
    web_dir = CURRENT_DIR / "web"
    index_html = web_dir / "index.html"
    icon_path = CURRENT_DIR / "assets" / "icon.ico"

    window = webview.create_window(
        title="ZFound × Zeeno Soft",
        url=str(index_html.as_uri()),
        js_api=api,
        width=1240,
        height=820,
        min_size=(980, 660),
        background_color="#080808",
        easy_drag=True
    )
    api.set_window(window)

    # Start background model check
    api.init_background_model()

    webview.start(debug=False, private_mode=False)


if __name__ == "__main__":
    main()
