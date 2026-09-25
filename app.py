import os
import sys
import json
import time
import base64
import hashlib
import subprocess
import threading
from pathlib import Path
from io import BytesIO
from PIL import Image

import webview

# Add zfound and root to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
sys.path.insert(0, str(CURRENT_DIR))
sys.path.insert(0, str(ROOT_DIR))

from core.scanner import FastScanner
from core.hasher import FastHasher
from core.embedder import FastEmbedder
from core.indexer import FastIndexer

CONFIG_PATH = CURRENT_DIR / ".zfound_config.json"
THUMBS_CACHE_DIR = CURRENT_DIR / "zfound_thumbs"
THUMBS_CACHE_DIR.mkdir(exist_ok=True)

class ZFoundApi:
    def __init__(self, window=None):
        self.window = window
        self.scanner = FastScanner()
        self.hasher = FastHasher()
        self.embedder = FastEmbedder(models_dir=str(ROOT_DIR / "models"))
        self.indexer = FastIndexer()
        self.scanned_items = []
        self.current_folder = ""
        self.is_indexing = False
        self.logs = []
        self.log("ZFound Vision Engine initialized")

    def set_window(self, window):
        self.window = window

    def log(self, message: str):
        now = time.strftime("%H:%M:%S")
        entry = f"[{now}] {message}"
        self.logs.append(entry)
        if len(self.logs) > 300:
            self.logs.pop(0)
        print(f"[ZFound] {entry}")

    def get_logs(self):
        return list(self.logs)

    def get_default_folder(self):
        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    return cfg.get("default_folder")
            except Exception:
                pass
        return None

    def set_default_folder(self, folder: str):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"default_folder": folder}, f, indent=2)
            self.log(f"Saved default folder: {folder}")
            return True
        except Exception as e:
            self.log(f"Failed to save default folder: {e}")
            return False

    def get_app_info(self):
        models = self.embedder.detect_local_models()
        active_m = self.embedder.model_name or (models[0]["name"] if models else "clip-vit-base-patch32")
        return {
            "name": "ZFound",
            "branding": "ZFound × Zeeno Soft",
            "version": "0.1.0",
            "models_available": models,
            "active_model": active_m,
            "model_ready": self.embedder.is_ready,
            "dimension": self.embedder.dimension or 512,
            "scanned_count": len(self.scanned_items),
            "indexed_count": len(self.indexer.items),
            "default_folder": self.get_default_folder()
        }

    def init_background_model(self):
        """Silently initialize the local model in background without CPU thrashing"""
        def _worker():
            try:
                models = self.embedder.detect_local_models()
                if models:
                    self.log(f"Auto-mounting vision model: {models[0]['name']}")
                    self.embedder.load_model(models[0]["path"])
                    self.log(f"Model active ({self.embedder.dimension}-D vector space)")
                    if self.window:
                        self.window.evaluate_js(f"window.onModelReady && window.onModelReady({json.dumps(self.embedder.model_name)});")
            except Exception as e:
                self.log(f"Model auto-load warning: {e}")
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
        self.log(f"Scanning directory: {folder_path} (recursive: {recursive})")

        def on_progress(count, elapsed):
            if self.window:
                self.window.evaluate_js(f"window.onScanProgress && window.onScanProgress({count});")

        items = self.scanner.scan(folder_path, recursive=recursive, progress_cb=on_progress)
        self.scanned_items = items
        self.log(f"Discovered {len(items)} images")

        # Auto-load existing .zfound_index.json if present in this folder
        index_file = Path(folder_path) / ".zfound_index.json"
        indexed_count = 0
        if index_file.exists():
            try:
                with open(index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    items_with_embs = []
                    for it in data.get("items", []):
                        if "vector" in it and it["vector"]:
                            entry = it.get("entry", {})
                            entry["phash"] = it.get("phash")
                            items_with_embs.append((entry, it["vector"]))
                    if items_with_embs:
                        indexed_count = self.indexer.build(items_with_embs)
                        self.log(f"Loaded {indexed_count} indexed items with AI vectors from folder cache!")
            except Exception as e:
                self.log(f"Failed to auto-load index cache: {e}")

        return {
            "status": "success",
            "folder": folder_path,
            "count": len(items),
            "items": items,
            "indexed_count": indexed_count
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
        self.log(f"Starting neural indexing for {total} images...")

        # Process in batches to keep UI responsive and CPU usage constrained
        batch_size = 4
        for idx in range(0, total, batch_size):
            batch = self.scanned_items[idx : idx + batch_size]
            for item in batch:
                path = item["path"]
                # 1. Compute perceptual hash
                phash = self.hasher.compute_phash(path)
                item["phash"] = phash

                # 2. Compute embedding
                emb = None
                try:
                    emb = self.embedder.embed_image(path)
                except Exception as e:
                    self.log(f"Embedding error for {item.get('name')}: {e}")

                if emb:
                    indexed_data.append((item, emb))

            current_done = min(idx + batch_size, total)
            percent = int((current_done / total) * 100)
            if self.window:
                self.window.evaluate_js(f"window.onIndexProgress && window.onIndexProgress({current_done}, {total}, {percent});")

        indexed_count = self.indexer.build(indexed_data)
        self.log(f"Successfully indexed {indexed_count} images with 512-D AI vectors")

        # Save persistent index in folder
        if self.current_folder:
            index_file = Path(self.current_folder) / ".zfound_index.json"
            save_items = []
            for i, it in enumerate(self.indexer.items):
                vec = self.indexer.embeddings_matrix[i].tolist()
                save_items.append({
                    "entry": {
                        "path": it["path"],
                        "name": it["name"],
                        "size": it["size"],
                        "modified": it.get("modified", 0)
                    },
                    "phash": it.get("phash"),
                    "vector": vec
                })
            try:
                with open(index_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "version": "0.1.0",
                        "folder": self.current_folder,
                        "updated_at": int(time.time()),
                        "model_name": self.embedder.model_name,
                        "dimension": self.embedder.dimension,
                        "items": save_items
                    }, f, indent=2)
                self.log(f"Saved persistent index to {index_file.name}")
            except Exception as e:
                self.log(f"Error saving index file: {e}")

        return {
            "status": "success",
            "indexed_count": indexed_count,
            "total_scanned": total
        }

    def search_similar(self, query_image_path: str, top_k: int = 40, min_score: float = 0.70):
        if not self.indexer.is_indexed or len(self.indexer.items) == 0:
            return {"status": "error", "message": "Please scan and index a folder first."}

        if not os.path.exists(query_image_path):
            return {"status": "error", "message": "Query image file does not exist."}

        self.log(f"Searching neural features for: {Path(query_image_path).name}")

        # 1. Compute query hash
        q_phash = self.hasher.compute_phash(query_image_path)

        # 2. Compute query embedding
        if not self.embedder.is_ready:
            models = self.embedder.detect_local_models()
            if models:
                self.embedder.load_model(models[0]["path"])

        q_emb = self.embedder.embed_image(query_image_path)

        # 3. Query index with strict cosine filtering
        results = self.indexer.search(q_emb, query_phash=q_phash, top_k=top_k, min_score=min_score)
        self.log(f"Search complete: found {len(results)} ranked matches (min_score: {int(min_score*100)}%)")

        return {
            "status": "success",
            "query_image": query_image_path.replace("\\", "/"),
            "query_phash": q_phash,
            "total_matches": len(results),
            "results": results
        }

    def get_thumbnail_b64(self, image_path: str, max_size: int = 320):
        try:
            # Fast disk cache check
            h = hashlib.sha1(image_path.encode("utf-8")).hexdigest()
            cache_file = THUMBS_CACHE_DIR / f"{h}_{max_size}.jpg"
            if cache_file.exists():
                with open(cache_file, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                    return f"data:image/jpeg;base64,{b64}"

            with Image.open(image_path) as img:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                buffered = BytesIO()
                img_format = "JPEG" if img.mode == "RGB" else "PNG"
                img.save(buffered, format=img_format, quality=82)
                raw_bytes = buffered.getvalue()

                # Save to disk cache for instantaneous future loads
                try:
                    with open(cache_file, "wb") as f:
                        f.write(raw_bytes)
                except Exception:
                    pass

                data_b64 = base64.b64encode(raw_bytes).decode("ascii")
                mime = f"image/{img_format.lower()}"
                return f"data:{mime};base64,{data_b64}"
        except Exception:
            return ""

    def reveal_in_explorer(self, file_path: str):
        try:
            norm_path = os.path.normpath(file_path)
            subprocess.run(["explorer.exe", "/select,", norm_path], check=False)
            return True
        except Exception:
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

    # Start background model check
    api.init_background_model()

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

    webview.start(debug=False, private_mode=False)


if __name__ == "__main__":
    main()
