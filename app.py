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
import cv2

import webview

# Support frozen standalone executable or script mode
if getattr(sys, "frozen", False):
    CURRENT_DIR = Path(sys._MEIPASS)
    APP_DIR = Path(os.path.dirname(sys.executable))
else:
    CURRENT_DIR = Path(__file__).resolve().parent
    APP_DIR = CURRENT_DIR.parent

ROOT_DIR = APP_DIR
sys.path.insert(0, str(CURRENT_DIR))
sys.path.insert(0, str(ROOT_DIR))

from core.scanner import FastScanner
from core.hasher import FastHasher
from core.embedder import FastEmbedder
from core.indexer import FastIndexer
from core.product_detector import ProductDetector
from core.image_scaler import ImageScaler
from core.sync_server import SyncServer

STORAGE_DIR = CURRENT_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_CACHE_DIR = STORAGE_DIR / "cache"
THUMBS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
INDICES_DIR = STORAGE_DIR / "indices"
INDICES_DIR.mkdir(parents=True, exist_ok=True)
METADATA_DIR = STORAGE_DIR / "metadata"
METADATA_DIR.mkdir(parents=True, exist_ok=True)
CROPS_DIR = STORAGE_DIR / "crops"
CROPS_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DIR = STORAGE_DIR / "sessions"
SESSION_DIR.mkdir(parents=True, exist_ok=True)
BOXES_PATH = STORAGE_DIR / "boxes.json"
INVENTORY_PATH = STORAGE_DIR / "inventory.json"
SESSION_AUTOSAVE_PATH = STORAGE_DIR / "active_session.json"
CONFIG_PATH = STORAGE_DIR / "config.json"

def find_models_dir():
    candidates = [
        CURRENT_DIR / "models",
        ROOT_DIR / "models",
        Path("e:/XFind_Pro/models"),
    ]
    for c in candidates:
        if c.is_dir() and (c / "clip-vit-base-patch32").exists():
            return str(c)
    return str(ROOT_DIR / "models")

class ZFoundApi:
    def __init__(self, window=None):
        self._window = window
        self._scanner = FastScanner()
        self._hasher = FastHasher()
        self._embedder = FastEmbedder(models_dir=find_models_dir())
        self._indexer = FastIndexer()
        self._detector = ProductDetector(models_dir=find_models_dir())
        self._scanned_items = []
        self._current_folder = ""
        self._metadata = {}  # {path_or_name: {"code": ..., "box": ..., "custom_name": ...}}
        self._is_indexing = False
        self._indexing_cancelled = False
        self._indexing_thread = None
        self._model_thread = None
        self._logs = []
        
        # Initialize storage directories & defaults
        self._init_storage_defaults()
        self._active_session = self._load_session_autosave()

        # Initialize local Wi-Fi sync server for Android phone connection
        self._sync_server = SyncServer(api_callback=self.add_mobile_image)
        try:
            self._sync_server.start()
        except Exception as e:
            self.log(f"Sync server start warning: {e}")

        self.log("ZFound Vision Engine initialized")
        if self._detector.is_ready:
            self.log(f"Product Scanner Engine active: {self._detector.model_name}")

    def _init_storage_defaults(self):
        try:
            if not BOXES_PATH.exists():
                default_boxes = [
                    {"id": "box_a01", "name": "A-01", "description": "Storage Rack A, Box 1"},
                    {"id": "box_a02", "name": "A-02", "description": "Storage Rack A, Box 2"},
                    {"id": "box_a03", "name": "A-03", "description": "Storage Rack A, Box 3"},
                    {"id": "box_b01", "name": "B-01", "description": "Storage Rack B, Box 1"},
                    {"id": "box_b02", "name": "B-02", "description": "Storage Rack B, Box 2"},
                ]
                with open(BOXES_PATH, "w", encoding="utf-8") as f:
                    json.dump(default_boxes, f, indent=2)
            if not INVENTORY_PATH.exists():
                with open(INVENTORY_PATH, "w", encoding="utf-8") as f:
                    json.dump([], f, indent=2)
        except Exception as e:
            print(f"[ZFound] Storage init warning: {e}")

    def _load_session_autosave(self):
        try:
            if SESSION_AUTOSAVE_PATH.exists():
                with open(SESSION_AUTOSAVE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "images" in data:
                        # Rehydrate lightweight base64 URLs on session boot
                        for img in data.get("images", []):
                            p = img.get("path")
                            if p and os.path.exists(p):
                                if not img.get("thumb_url"):
                                    img["thumb_url"] = self.get_thumbnail_b64(p, max_size=160)
                                if not img.get("data_url"):
                                    img["data_url"] = self.get_thumbnail_b64(p, max_size=1200)
                        return data
        except Exception as e:
            print(f"[ZFound] Load autosave warning: {e}")
        return None

    def _save_session_autosave(self):
        try:
            if self._active_session:
                # Strip out multi-megabyte base64 strings so disk writes are < 2 KB and instantaneous (<0.1ms)
                save_data = {
                    "session_id": self._active_session.get("session_id"),
                    "created_at": self._active_session.get("created_at"),
                    "active_image_id": self._active_session.get("active_image_id"),
                    "images": []
                }
                for img in self._active_session.get("images", []):
                    img_copy = {k: v for k, v in img.items() if k not in ("data_url", "thumb_url")}
                    save_data["images"].append(img_copy)

                with open(SESSION_AUTOSAVE_PATH, "w", encoding="utf-8") as f:
                    json.dump(save_data, f, indent=2)
            else:
                if SESSION_AUTOSAVE_PATH.exists():
                    os.remove(SESSION_AUTOSAVE_PATH)
        except Exception as e:
            print(f"[ZFound] Autosave warning: {e}")

    def set_window(self, window):
        self._window = window

    def log(self, message: str):
        now = time.strftime("%H:%M:%S")
        entry = f"[{now}] {message}"
        self._logs.append(entry)
        if len(self._logs) > 300:
            self._logs.pop(0)
        print(f"[ZFound] {entry}")

    def get_logs(self):
        return list(self._logs)

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
        models = self._embedder.detect_local_models()
        active_m = self._embedder.model_name or (models[0]["name"] if models else "siglip-base-patch16-224")
        return {
            "name": "ZFound",
            "branding": "ZFound × Zeeno Soft",
            "version": "0.1.0",
            "models_available": models,
            "active_model": active_m,
            "model_ready": self._embedder.is_ready,
            "dimension": self._embedder.dimension or (models[0]["dimension"] if models else 768),
            "scanned_count": len(self._scanned_items),
            "indexed_count": len(self._indexer.items),
            "default_folder": self.get_default_folder()
        }

    def init_background_model(self):
        """Silently initialize the local model in background without CPU thrashing"""
        def _worker():
            try:
                models = self._embedder.detect_local_models()
                if models:
                    self.log(f"Auto-mounting vision model: {models[0]['name']}")
                    self._embedder.load_model(models[0]["path"])
                    self.log(f"Model active ({self._embedder.dimension}-D vector space)")
                    if self._window:
                        self._window.evaluate_js(f"window.onModelReady && window.onModelReady({json.dumps(self._embedder.model_name)});")
            except Exception as e:
                self.log(f"Model auto-load warning: {e}")
        self._model_thread = threading.Thread(target=_worker, daemon=True)
        self._model_thread.start()
        return True

    def select_folder(self):
        if not self._window:
            return None
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            return result[0].replace("\\", "/")
        return None

    def select_image_file(self):
        if not self._window:
            return None
        file_types = ('Image Files (*.jpg;*.jpeg;*.png;*.webp;*.bmp)', 'All files (*.*)')
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        if result and len(result) > 0:
            return result[0].replace("\\", "/")
        return None

    def select_multiple_images(self):
        if not self._window:
            return []
        file_types = ('Image Files (*.jpg;*.jpeg;*.png;*.webp;*.bmp)', 'All files (*.*)')
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=True, file_types=file_types)
        if result and len(result) > 0:
            return [p.replace("\\", "/") for p in result]
        return []

    def scan_folder(self, folder_path: str, recursive: bool = True):
        self._current_folder = folder_path
        self._scanned_items = []
        self._indexer.clear()
        self.log(f"Scanning directory: {folder_path} (recursive: {recursive})")

        def on_progress(count, elapsed):
            if self._window:
                self._window.evaluate_js(f"window.onScanProgress && window.onScanProgress({count});")

        items = self._scanner.scan(folder_path, recursive=recursive, progress_cb=on_progress)
        self._scanned_items = items
        self.log(f"Discovered {len(items)} images")

        # Load persisted metadata for this folder
        safe_name = hashlib.md5(folder_path.encode("utf-8")).hexdigest()[:12]
        meta_file = METADATA_DIR / f"meta_{safe_name}.json"
        folder_meta = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    folder_meta = json.load(f)
            except Exception:
                pass

        # Auto-load existing .zfound_index.json if present and matching model dimension
        index_file = Path(folder_path) / ".zfound_index.json"
        indexed_count = 0
        if index_file.exists():
            try:
                with open(index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cached_model = data.get("model_name", "")
                    cached_dim = data.get("dimension", 0)

                    # Determine expected dimension for current model configuration
                    expected_dim = self._embedder.dimension
                    if not expected_dim:
                        models = self._embedder.detect_local_models()
                        if models:
                            expected_dim = models[0]["dimension"]

                    items_with_embs = []
                    for it in data.get("items", []):
                        ent = it.get("entry", {})
                        p = ent.get("path", "").replace("\\", "/")
                        name = ent.get("name", "")
                        # Merge metadata from index file if not in meta file
                        if it.get("code") or it.get("box") or it.get("custom_name"):
                            item_m = {
                                "code": it.get("code", ""),
                                "box": it.get("box", ""),
                                "custom_name": it.get("custom_name", "")
                            }
                            if p and p not in folder_meta:
                                folder_meta[p] = item_m
                            if name and name not in folder_meta:
                                folder_meta[name] = item_m

                        if "vector" in it and it["vector"]:
                            ent["phash"] = it.get("phash")
                            # Attach metadata to entry
                            meta = folder_meta.get(p) or folder_meta.get(name) or {}
                            ent["code"] = meta.get("code", it.get("code", ""))
                            ent["box"] = meta.get("box", it.get("box", ""))
                            ent["custom_name"] = meta.get("custom_name", it.get("custom_name", ""))
                            items_with_embs.append((ent, it["vector"]))

                    if items_with_embs:
                        first_dim = len(items_with_embs[0][1])
                        if expected_dim and first_dim != expected_dim:
                            self.log(f"Cached index from {cached_model} has {first_dim}-D vectors, but active model requires {expected_dim}-D. Outdated cache ignored (re-indexing needed).")
                            self._indexer.clear()
                        else:
                            indexed_count = self._indexer.build(items_with_embs)
                            self.log(f"Loaded {indexed_count} indexed items with AI vectors from folder cache ({first_dim}-D)!")
            except Exception as e:
                self.log(f"Failed to auto-load index cache: {e}")

        self._metadata = folder_meta

        # Attach metadata to scanned items
        for it in items:
            norm_p = it["path"].replace("\\", "/")
            name = it["name"]
            meta = self._metadata.get(norm_p) or self._metadata.get(name) or {}
            it["code"] = meta.get("code", "")
            it["box"] = meta.get("box", "")
            it["custom_name"] = meta.get("custom_name", "")

        return {
            "status": "success",
            "folder": folder_path,
            "count": len(items),
            "items": items,
            "indexed_count": indexed_count
        }

    def cancel_indexing(self):
        self._indexing_cancelled = True
        self.log("Indexing cancellation requested")
        return {"status": "cancelled"}

    def start_indexing(self):
        if not self._scanned_items:
            return {"status": "error", "message": "No scanned images to index"}
        if self._is_indexing:
            return {"status": "already_running"}

        self._is_indexing = True
        self._indexing_cancelled = False
        self._indexing_thread = threading.Thread(target=self._indexing_worker, daemon=True)
        self._indexing_thread.start()
        return {"status": "started", "total": len(self._scanned_items)}

    def index_scanned_images(self):
        # Compatible bridge method
        return self.start_indexing()

    def _indexing_worker(self):
        try:
            if not self._embedder.is_ready:
                models = self._embedder.detect_local_models()
                if not models:
                    self._is_indexing = False
                    if self._window:
                        self._window.evaluate_js('window.onIndexComplete && window.onIndexComplete({"status": "error", "message": "No models found in models/ folder"});')
                    return
                self._embedder.load_model(models[0]["path"])

            total = len(self._scanned_items)
            indexed_data = []
            self.log(f"Starting async neural indexing for {total} images (low-CPU mode)...")

            # Batch 1 image at a time with generous cooperative sleep so the PC stays 100% responsive
            batch_size = 1
            for idx in range(0, total, batch_size):
                if self._indexing_cancelled:
                    self.log("Indexing cancelled by user")
                    break

                batch = self._scanned_items[idx : idx + batch_size]
                for item in batch:
                    if self._indexing_cancelled:
                        break
                    path = item["path"]
                    # 1. Perceptual hash
                    phash = self._hasher.compute_phash(path)
                    item["phash"] = phash

                    # 2. Embedding
                    emb = None
                    try:
                        emb = self._embedder.embed_image(path)
                    except Exception as e:
                        self.log(f"Embedding error for {item.get('name')}: {e}")

                    if emb:
                        indexed_data.append((item, emb))

                    # Cooperative sleep to prevent 100% CPU lockup and keep UI buttery smooth
                    time.sleep(0.035)

                current_done = min(idx + batch_size, total)
                percent = int((current_done / total) * 100)
                if self._window:
                    self._window.evaluate_js(f"window.onIndexProgress && window.onIndexProgress({current_done}, {total}, {percent});")

                # Garbage collect every 15 images to keep RAM footprint low
                if idx % 15 == 0:
                    gc.collect()

            indexed_count = self._indexer.build(indexed_data)
            self.log(f"Successfully indexed {indexed_count} images with {self._embedder.dimension}-D vectors")

            # Save persistent index in scanned folder
            if self._current_folder and not self._indexing_cancelled:
                index_file = Path(self._current_folder) / ".zfound_index.json"
                save_items = []
                for i, it in enumerate(self._indexer.items):
                    vec = self._indexer.embeddings_matrix[i].tolist()
                    save_items.append({
                        "entry": {
                            "path": it["path"],
                            "name": it["name"],
                            "size": it["size"],
                            "modified": it.get("modified", 0)
                        },
                        "phash": it.get("phash"),
                        "code": it.get("code", ""),
                        "box": it.get("box", ""),
                        "custom_name": it.get("custom_name", ""),
                        "vector": vec
                    })
                index_payload = {
                    "version": "0.1.0",
                    "folder": self._current_folder,
                    "updated_at": int(time.time()),
                    "model_name": self._embedder.model_name,
                    "dimension": self._embedder.dimension,
                    "items": save_items
                }
                try:
                    with open(index_file, "w", encoding="utf-8") as f:
                        json.dump(index_payload, f, indent=2)
                    self.log(f"Saved persistent index to {index_file.name}")
                except Exception as e:
                    self.log(f"Error saving index file: {e}")

                # Also backup to storage/indices/
                try:
                    safe_name = hashlib.md5(self._current_folder.encode("utf-8")).hexdigest()[:12]
                    backup_path = INDICES_DIR / f"index_{safe_name}.json"
                    with open(backup_path, "w", encoding="utf-8") as f:
                        json.dump(index_payload, f, indent=2)
                except Exception:
                    pass

            result = {
                "status": "success",
                "indexed_count": indexed_count,
                "total_scanned": total,
                "cancelled": self._indexing_cancelled
            }
            if self._window:
                self._window.evaluate_js(f"window.onIndexComplete && window.onIndexComplete({json.dumps(result)});")
        except Exception as e:
            self.log(f"Fatal error during indexing: {e}")
            if self._window:
                self._window.evaluate_js(f'window.onIndexComplete && window.onIndexComplete({{"status": "error", "message": "{str(e)}"}});')
        finally:
            self._is_indexing = False
            self._indexing_cancelled = False

    def search_similar(self, query_image_path: str, top_k: int = 40, min_score: float = 0.70):
        if not self._indexer.is_indexed or len(self._indexer.items) == 0:
            return {"status": "error", "message": "Please scan and index a folder first."}

        if not os.path.exists(query_image_path):
            return {"status": "error", "message": "Query image file does not exist."}

        self.log(f"Searching neural features for: {Path(query_image_path).name}")

        # 1. Compute query hash
        q_phash = self._hasher.compute_phash(query_image_path)

        # 2. Compute query embedding (safely wait for background model mount if in flight)
        if not self._embedder.is_ready:
            if hasattr(self, '_model_thread') and self._model_thread and self._model_thread.is_alive():
                self.log("Waiting for background vision model mount to complete...")
                self._model_thread.join(timeout=30)
            if not self._embedder.is_ready:
                models = self._embedder.detect_local_models()
                if models:
                    self._embedder.load_model(models[0]["path"])

        try:
            q_emb = self._embedder.embed_image(query_image_path)
        except Exception as e:
            self.log(f"Query embedding error: {e}")
            return {"status": "error", "message": f"Embedding error: {e}"}

        # Check dimension alignment between index and active model
        if self._indexer.dim != len(q_emb):
            msg = f"Index dimension mismatch: Library has {self._indexer.dim}-D vectors, but {self._embedder.model_name} produces {len(q_emb)}-D vectors. Please click 'Index All Images' to update the library."
            self.log(f"Search warning: {msg}")
            return {
                "status": "dimension_mismatch",
                "message": msg,
                "results": []
            }

        # 3. Query index with strict cosine filtering
        try:
            results = self._indexer.search(q_emb, query_phash=q_phash, top_k=top_k, min_score=min_score)
        except ValueError as ve:
            self.log(f"Search dimension warning: {ve}")
            return {
                "status": "dimension_mismatch",
                "message": str(ve),
                "results": []
            }

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
                # Use BILINEAR for 10x faster thumbnail creation
                img.thumbnail((max_size, max_size), Image.Resampling.BILINEAR)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                buffered = BytesIO()
                img_format = "JPEG" if img.mode == "RGB" else "PNG"
                img.save(buffered, format=img_format, quality=80)
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

    def save_item_metadata(self, image_path: str, code: str = "", box: str = "", custom_name: str = ""):
        norm_p = image_path.replace("\\", "/")
        name = Path(norm_p).name
        meta_dict = {
            "code": str(code).strip(),
            "box": str(box).strip(),
            "custom_name": str(custom_name).strip()
        }
        self._metadata[norm_p] = meta_dict
        self._metadata[name] = meta_dict

        # Update in-memory scanned items and indexer
        for it in self._scanned_items:
            if it["path"].replace("\\", "/") == norm_p or it["name"] == name:
                it["code"] = meta_dict["code"]
                it["box"] = meta_dict["box"]
                it["custom_name"] = meta_dict["custom_name"]
                break

        for it in self._indexer.items:
            if it["path"].replace("\\", "/") == norm_p or it["name"] == name:
                it["code"] = meta_dict["code"]
                it["box"] = meta_dict["box"]
                it["custom_name"] = meta_dict["custom_name"]
                break

        # Persist to storage/metadata/
        if self._current_folder:
            safe_name = hashlib.md5(self._current_folder.encode("utf-8")).hexdigest()[:12]
            meta_file = METADATA_DIR / f"meta_{safe_name}.json"
            try:
                with open(meta_file, "w", encoding="utf-8") as f:
                    json.dump(self._metadata, f, indent=2)
            except Exception as e:
                self.log(f"Error saving metadata file: {e}")

            # Also update .zfound_index.json if present
            index_file = Path(self._current_folder) / ".zfound_index.json"
            if index_file.exists():
                try:
                    with open(index_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    for item_record in data.get("items", []):
                        ent = item_record.get("entry", {})
                        if ent.get("path", "").replace("\\", "/") == norm_p or ent.get("name") == name:
                            item_record["code"] = meta_dict["code"]
                            item_record["box"] = meta_dict["box"]
                            item_record["custom_name"] = meta_dict["custom_name"]
                            break
                    with open(index_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                except Exception:
                    pass

        self.log(f"Saved details for {name}: Code='{meta_dict['code']}', Box='{meta_dict['box']}'")
        return {"status": "success", "metadata": meta_dict}

    def get_item_metadata(self, image_path: str):
        norm_p = image_path.replace("\\", "/")
        name = Path(norm_p).name
        meta = self._metadata.get(norm_p) or self._metadata.get(name) or {}
        return {
            "code": meta.get("code", ""),
            "box": meta.get("box", ""),
            "custom_name": meta.get("custom_name", "")
        }

    def batch_assign_codes(self, prefix: str = "ZF", start_num: int = 1, pad: int = 2, box: str = ""):
        if not self._scanned_items:
            return {"status": "error", "message": "No scanned items to label"}

        prefix = str(prefix).strip()
        box = str(box).strip()
        count = 0

        for i, it in enumerate(self._scanned_items):
            code_num = start_num + i
            code_str = f"{prefix}{str(code_num).zfill(pad)}"
            norm_p = it["path"].replace("\\", "/")
            name = it["name"]

            it["code"] = code_str
            if box:
                it["box"] = box

            meta_dict = {
                "code": it["code"],
                "box": it.get("box", ""),
                "custom_name": it.get("custom_name", "")
            }
            self._metadata[norm_p] = meta_dict
            self._metadata[name] = meta_dict
            count += 1

        # Sync into indexer
        for it in self._indexer.items:
            norm_p = it["path"].replace("\\", "/")
            name = it["name"]
            meta = self._metadata.get(norm_p) or self._metadata.get(name)
            if meta:
                it["code"] = meta.get("code", "")
                it["box"] = meta.get("box", "")
                it["custom_name"] = meta.get("custom_name", "")

        # Persist to disk
        if self._current_folder:
            safe_name = hashlib.md5(self._current_folder.encode("utf-8")).hexdigest()[:12]
            meta_file = METADATA_DIR / f"meta_{safe_name}.json"
            try:
                with open(meta_file, "w", encoding="utf-8") as f:
                    json.dump(self._metadata, f, indent=2)
            except Exception:
                pass

            index_file = Path(self._current_folder) / ".zfound_index.json"
            if index_file.exists():
                try:
                    with open(index_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    for item_record in data.get("items", []):
                        ent = item_record.get("entry", {})
                        p = ent.get("path", "").replace("\\", "/")
                        n = ent.get("name", "")
                        meta = self._metadata.get(p) or self._metadata.get(n)
                        if meta:
                            item_record["code"] = meta.get("code", "")
                            item_record["box"] = meta.get("box", "")
                            item_record["custom_name"] = meta.get("custom_name", "")
                    with open(index_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                except Exception:
                    pass

        self.log(f"Batch assigned codes to {count} images (Prefix: '{prefix}', Box: '{box}')")
        return {"status": "success", "count": count, "items": self._scanned_items}

    def rename_image_file(self, image_path: str, new_name: str):
        try:
            old_p = Path(image_path)
            if not old_p.exists():
                return {"status": "error", "message": "File does not exist"}

            new_name = new_name.strip()
            # Ensure extension preserved if not provided
            if not os.path.splitext(new_name)[1]:
                new_name = f"{new_name}{old_p.suffix}"

            new_p = old_p.parent / new_name
            if new_p.exists() and new_p.resolve() != old_p.resolve():
                return {"status": "error", "message": f"A file named '{new_name}' already exists"}

            os.rename(old_p, new_p)
            new_path_str = str(new_p).replace("\\", "/")
            old_path_str = str(old_p).replace("\\", "/")

            # Update metadata keys
            if old_path_str in self._metadata:
                self._metadata[new_path_str] = self._metadata.pop(old_path_str)
            if old_p.name in self._metadata:
                self._metadata[new_p.name] = self._metadata.pop(old_p.name)

            # Update scanned items
            for it in self._scanned_items:
                if it["path"].replace("\\", "/") == old_path_str:
                    it["path"] = new_path_str
                    it["name"] = new_p.name
                    break

            # Update indexer items
            for it in self._indexer.items:
                if it["path"].replace("\\", "/") == old_path_str:
                    it["path"] = new_path_str
                    it["name"] = new_p.name
                    break

            self.log(f"Renamed file: {old_p.name} -> {new_p.name}")
            return {"status": "success", "new_path": new_path_str, "new_name": new_p.name}
        except Exception as e:
            self.log(f"Rename error: {e}")
            return {"status": "error", "message": str(e)}

    # ========================================================
    # STORAGE BOX MANAGEMENT
    # ========================================================
    def get_storage_boxes(self):
        try:
            boxes = []
            if BOXES_PATH.exists():
                with open(BOXES_PATH, "r", encoding="utf-8") as f:
                    boxes = json.load(f)
            
            # Count products per box from inventory
            inv = []
            if INVENTORY_PATH.exists():
                with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                    inv = json.load(f)
            box_counts = {}
            for item in inv:
                b = item.get("box", "").strip()
                if b:
                    box_counts[b] = box_counts.get(b, 0) + 1

            for box in boxes:
                box["product_count"] = box_counts.get(box.get("name", ""), 0)

            return boxes
        except Exception as e:
            self.log(f"Error reading storage boxes: {e}")
            return []

    def create_storage_box(self, name: str, description: str = ""):
        try:
            name = name.strip()
            if not name:
                return {"status": "error", "message": "Box name cannot be empty"}
            boxes = self.get_storage_boxes()
            for b in boxes:
                if b["name"].lower() == name.lower():
                    return {"status": "error", "message": f"Box '{name}' already exists"}
            
            new_box = {
                "id": f"box_{int(time.time()*1000)}",
                "name": name,
                "description": description.strip(),
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            save_boxes = [{k: v for k, v in b.items() if k != "product_count"} for b in boxes]
            save_boxes.append(new_box)
            with open(BOXES_PATH, "w", encoding="utf-8") as f:
                json.dump(save_boxes, f, indent=2)
            self.log(f"Created new storage box: {name}")
            new_box["product_count"] = 0
            return {"status": "success", "box": new_box}
        except Exception as e:
            self.log(f"Error creating box: {e}")
            return {"status": "error", "message": str(e)}

    def rename_storage_box(self, box_id: str, new_name: str):
        try:
            new_name = new_name.strip()
            if not new_name:
                return {"status": "error", "message": "Box name cannot be empty"}
            boxes = self.get_storage_boxes()
            old_name = None
            for b in boxes:
                if b["id"] == box_id:
                    old_name = b["name"]
                    b["name"] = new_name
                    break
            if not old_name:
                return {"status": "error", "message": "Box not found"}

            save_boxes = [{k: v for k, v in b.items() if k != "product_count"} for b in boxes]
            with open(BOXES_PATH, "w", encoding="utf-8") as f:
                json.dump(save_boxes, f, indent=2)

            # Update inventory items assigned to old_name
            if INVENTORY_PATH.exists():
                with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                    inv = json.load(f)
                updated_count = 0
                for item in inv:
                    if item.get("box") == old_name:
                        item["box"] = new_name
                        updated_count += 1
                if updated_count > 0:
                    with open(INVENTORY_PATH, "w", encoding="utf-8") as f:
                        json.dump(inv, f, indent=2)

            self.log(f"Renamed storage box: {old_name} -> {new_name}")
            return {"status": "success", "new_name": new_name}
        except Exception as e:
            self.log(f"Error renaming box: {e}")
            return {"status": "error", "message": str(e)}

    def delete_storage_box(self, box_id: str):
        try:
            boxes = self.get_storage_boxes()
            save_boxes = [b for b in boxes if b["id"] != box_id]
            save_boxes = [{k: v for k, v in b.items() if k != "product_count"} for b in save_boxes]
            with open(BOXES_PATH, "w", encoding="utf-8") as f:
                json.dump(save_boxes, f, indent=2)
            self.log(f"Deleted storage box: {box_id}")
            return {"status": "success"}
        except Exception as e:
            self.log(f"Error deleting box: {e}")
            return {"status": "error", "message": str(e)}

    # ========================================================
    # INVENTORY MANAGEMENT
    # ========================================================
    def get_inventory(self, search_query: str = "", box_filter: str = ""):
        try:
            if not INVENTORY_PATH.exists():
                return []
            with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)

            filtered = []
            q = search_query.strip().lower()
            bf = box_filter.strip().lower()

            for it in items:
                if bf and it.get("box", "").strip().lower() != bf:
                    continue
                if q:
                    name = it.get("name", "").lower()
                    code = it.get("code", "").lower()
                    box = it.get("box", "").lower()
                    notes = it.get("notes", "").lower()
                    if q not in name and q not in code and q not in box and q not in notes:
                        continue
                filtered.append(it)
            return filtered
        except Exception as e:
            self.log(f"Error reading inventory: {e}")
            return []

    def update_inventory_item(self, item_id: str, name: str, code: str, box: str, notes: str = ""):
        try:
            if not INVENTORY_PATH.exists():
                return {"status": "error", "message": "Inventory empty"}
            with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)
            found = False
            for it in items:
                if it["id"] == item_id:
                    it["name"] = name.strip()
                    it["code"] = code.strip()
                    it["box"] = box.strip()
                    it["notes"] = notes.strip()
                    found = True
                    break
            if not found:
                return {"status": "error", "message": "Item not found"}
            with open(INVENTORY_PATH, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2)
            self.log(f"Updated inventory item {item_id}: {name} ({code})")
            return {"status": "success"}
        except Exception as e:
            self.log(f"Error updating inventory item: {e}")
            return {"status": "error", "message": str(e)}

    def delete_inventory_item(self, item_id: str):
        try:
            if not INVENTORY_PATH.exists():
                return {"status": "error", "message": "Inventory empty"}
            with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)
            new_items = [it for it in items if it["id"] != item_id]
            with open(INVENTORY_PATH, "w", encoding="utf-8") as f:
                json.dump(new_items, f, indent=2)
            self.log(f"Deleted inventory item {item_id}")
            return {"status": "success"}
        except Exception as e:
            self.log(f"Error deleting inventory item: {e}")
            return {"status": "error", "message": str(e)}

    # ========================================================
    # PRODUCT SCANNER & SCANNING SESSION WORKFLOW
    # ========================================================
    def start_scan_session(self):
        if not self._active_session:
            self._active_session = {
                "session_id": f"sess_{int(time.time()*1000)}",
                "created_at": time.time(),
                "images": [],
                "active_image_id": None
            }
            self._save_session_autosave()
        return self._active_session

    def get_active_session(self):
        return self._active_session or self.start_scan_session()

    def clear_scan_session(self):
        self._active_session = None
        self._save_session_autosave()
        self.log("Scanning session reset")
        return {"status": "success"}

    def add_session_images(self, file_paths: list):
        if not file_paths:
            return self.get_active_session()

        sess = self.get_active_session()
        added_count = 0

        for p_str in file_paths:
            p = Path(p_str)
            if not p.exists():
                continue
            norm_p = str(p.resolve()).replace("\\", "/")

            try:
                img_cv = cv2.imread(str(p))
                if img_cv is None:
                    continue

                h, w = img_cv.shape[:2]
                img_id = f"img_{int(time.time()*1000)}_{len(sess['images']) + 1}"

                # 1. Quality check (CPU < 5ms)
                qual = self._detector.check_image_quality(img_cv)
                if qual.get("warning"):
                    self.log(f"Quality warning on {p.name}: {qual['warning']}")

                # 2. PP-PicoDet-XS 320x320 automatic detection
                detections = self._detector.detect_products(img_cv)
                self.log(f"Detected {len(detections)} products in {p.name}")

                # Format products
                products = []
                for idx, det in enumerate(detections, start=1):
                    products.append({
                        "id": f"prod_{img_id}_{idx}",
                        "product_index": idx,
                        "x": det["x"],
                        "y": det["y"],
                        "width": det["width"],
                        "height": det["height"],
                        "confidence": det.get("confidence", 0.5),
                        "source": det.get("source", "ai"),
                        "label": det.get("label", "Product"),
                        "name": f"Product {idx}",
                        "code": f"ZF{str(idx).zfill(2)}",
                        "box": "A-01",
                        "notes": "",
                        "user_locked": False
                    })

                # Thumbnails: small 160px for strip, compact 1200px for canvas
                thumb_url = self.get_thumbnail_b64(str(p), max_size=160)
                data_url = self.get_thumbnail_b64(str(p), max_size=1200)

                img_record = {
                    "id": img_id,
                    "name": p.name,
                    "path": norm_p,
                    "thumb_url": thumb_url,
                    "data_url": data_url,
                    "width": w,
                    "height": h,
                    "quality": qual,
                    "products": products,
                    "removed_count": 0
                }

                sess["images"].append(img_record)
                if not sess.get("active_image_id"):
                    sess["active_image_id"] = img_id
                added_count += 1

            except Exception as e:
                self.log(f"Error processing image {p_str}: {e}")

        self._save_session_autosave()
        self.log(f"Added {added_count} image(s) to scan session")
        return sess

    def capture_webcam_image(self, base64_data: str):
        try:
            if not base64_data:
                return {"status": "error", "message": "No image data"}

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            raw_bytes = base64.b64decode(base64_data)
            save_name = f"capture_{int(time.time()*1000)}.jpg"
            target_path = SESSION_DIR / save_name
            with open(target_path, "wb") as f:
                f.write(raw_bytes)

            sess = self.add_session_images([str(target_path)])
            return {"status": "success", "session": sess}
        except Exception as e:
            self.log(f"Webcam capture error: {e}")
            return {"status": "error", "message": str(e)}

    def get_sync_server_info(self):
        """Returns connection information and QR code for mobile phone pairing."""
        if self._sync_server:
            return self._sync_server.get_connection_info()
        return {"status": "offline", "local_ip": "127.0.0.1", "port": 7890, "pin": "", "url": "", "qr_b64": ""}

    def get_pending_mobile_events(self):
        """Polls any new mobile events (photos received, handshake)."""
        if self._sync_server:
            return self._sync_server.get_pending_events()
        return []

    def add_mobile_image(self, base64_data: str, device_name: str = "Android Phone"):
        """
        Processes photo uploaded from mobile device over local Wi-Fi.
        Saves to active session, runs PP-PicoDet-XS detection, and notifies desktop UI.
        """
        try:
            if not base64_data:
                return {"status": "error", "message": "No image data"}

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            raw_bytes = base64.b64decode(base64_data)
            timestamp = int(time.time() * 1000)
            save_name = f"mobile_capture_{timestamp}.jpg"
            target_path = SESSION_DIR / save_name
            with open(target_path, "wb") as f:
                f.write(raw_bytes)

            sess = self.add_session_images([str(target_path)])
            self.log(f"Mobile photo received from {device_name}: {save_name}")

            added_img = None
            if sess and sess.get("images"):
                for img in reversed(sess["images"]):
                    if img.get("name") == save_name or save_name in img.get("path", ""):
                        added_img = img
                        break
                if not added_img and len(sess["images"]) > 0:
                    added_img = sess["images"][-1]

            # Set as active image if newly added
            if added_img:
                sess["active_image_id"] = added_img["id"]
                self._save_session_autosave()

            product_count = len(added_img.get("products", [])) if added_img else 0
            payload = {
                "status": "success",
                "message": f"Photo received from {device_name}! ({product_count} products detected)",
                "device": device_name,
                "image": added_img,
                "session": sess,
                "product_count": product_count
            }

            # Live UI notification in pywebview window
            if self._window:
                try:
                    js_code = f"window.onMobilePhotoReceived && window.onMobilePhotoReceived({json.dumps(payload)});"
                    self._window.evaluate_js(js_code)
                except Exception as e:
                    self.log(f"JS eval error: {e}")

            return payload
        except Exception as e:
            self.log(f"Error handling mobile photo: {e}")
            return {"status": "error", "message": str(e)}

    def retake_session_image(self, image_id: str, new_file_path: str = None, base64_data: str = None):
        """
        Retakes ONLY the specified image in the scan session.
        Keeps all other images, confirmed products, and user-entered data completely intact!
        """
        sess = self.get_active_session()
        target_img = None
        for img in sess.get("images", []):
            if img["id"] == image_id:
                target_img = img
                break

        if not target_img:
            return {"status": "error", "message": f"Image {image_id} not found in session"}

        try:
            if base64_data:
                if "," in base64_data:
                    base64_data = base64_data.split(",", 1)[1]
                raw_bytes = base64.b64decode(base64_data)
                save_name = f"retake_{image_id}_{int(time.time()*1000)}.jpg"
                save_path = SESSION_DIR / save_name
                with open(save_path, "wb") as f:
                    f.write(raw_bytes)
                resolved_path = str(save_path.resolve()).replace("\\", "/")
                resolved_name = save_name
            elif new_file_path:
                p = Path(new_file_path)
                if not p.exists():
                    return {"status": "error", "message": "File does not exist"}
                resolved_path = str(p.resolve()).replace("\\", "/")
                resolved_name = p.name
            else:
                return {"status": "error", "message": "No replacement image provided"}

            img_cv = cv2.imread(resolved_path)
            if img_cv is None:
                return {"status": "error", "message": "Could not read replacement image"}

            h, w = img_cv.shape[:2]
            qual = self._detector.check_image_quality(img_cv)
            detections = self._detector.detect_products(img_cv)

            products = []
            for idx, det in enumerate(detections, start=1):
                products.append({
                    "id": f"prod_{image_id}_{idx}",
                    "product_index": idx,
                    "x": det["x"],
                    "y": det["y"],
                    "width": det["width"],
                    "height": det["height"],
                    "confidence": det.get("confidence", 0.5),
                    "source": "ai",
                    "label": det.get("label", "Product"),
                    "name": f"Product {idx}",
                    "code": f"ZF{str(idx).zfill(2)}",
                    "box": "A-01",
                    "notes": "",
                    "user_locked": False
                })

            thumb_url = self.get_thumbnail_b64(resolved_path, max_size=160)
            data_url = self.get_thumbnail_b64(resolved_path, max_size=1200)

            # Update only this image's record
            target_img["name"] = resolved_name
            target_img["path"] = resolved_path
            target_img["thumb_url"] = thumb_url
            target_img["data_url"] = data_url
            target_img["width"] = w
            target_img["height"] = h
            target_img["quality"] = qual
            target_img["products"] = products
            target_img["removed_count"] = 0

            self._save_session_autosave()
            self.log(f"Successfully retook image: {resolved_name} (found {len(products)} products)")
            return {"status": "success", "session": sess}
        except Exception as e:
            self.log(f"Retake error: {e}")
            return {"status": "error", "message": str(e)}

    def reanalyze_session_image(self, image_id: str):
        """
        Deep multi-pass re-analysis with PP-PicoDet-XS & adaptive contour analysis.
        Discovers missed products, faint jewelry, and small items while preserving manual cuts & locked data.
        """
        sess = self.get_active_session()
        target_img = None
        for img in sess.get("images", []):
            if img["id"] == image_id:
                target_img = img
                break

        if not target_img:
            return {"status": "error", "message": "Image not found"}

        try:
            img_cv = cv2.imread(target_img["path"])
            if img_cv is None:
                return {"status": "error", "message": "Cannot read image file"}

            # Separate manual / user-locked products to preserve them
            preserved_products = [
                p for p in target_img.get("products", [])
                if p.get("source") == "manual" or p.get("user_locked") is True
            ]

            # Deep Multi-Pass Inference (lower threshold 0.12, CLAHE contrast boost, and multi-threshold contour analysis)
            detections = self._detector.detect_products_deep(img_cv, conf_threshold=0.12, iou_threshold=0.35)

            new_products = list(preserved_products)
            start_idx = len(new_products) + 1
            new_discovered = 0

            for det in detections:
                overlap = False
                for p in preserved_products:
                    iou = self._calc_iou(det, p)
                    if iou > 0.35:
                        overlap = True
                        break
                if not overlap:
                    new_products.append({
                        "id": f"prod_{image_id}_{start_idx}",
                        "product_index": start_idx,
                        "x": det["x"],
                        "y": det["y"],
                        "width": det["width"],
                        "height": det["height"],
                        "confidence": det.get("confidence", 0.5),
                        "source": "ai",
                        "label": det.get("label", "Product"),
                        "name": f"Product {start_idx}",
                        "code": f"ZF{str(start_idx).zfill(2)}",
                        "box": "A-01",
                        "notes": "",
                        "user_locked": False
                    })
                    start_idx += 1
                    new_discovered += 1

            target_img["products"] = new_products
            self._save_session_autosave()
            msg = f"Deep re-analysis complete: {len(new_products)} products ready (+{new_discovered} newly found)!"
            self.log(f"Deep re-analyzed {target_img['name']}: {msg}")
            return {
                "status": "success",
                "session": sess,
                "discovered_count": new_discovered,
                "total_count": len(new_products),
                "message": msg
            }
        except Exception as e:
            self.log(f"Re-analyze error: {e}")
            return {"status": "error", "message": str(e)}

    def _calc_iou(self, b1, b2):
        x1 = max(b1["x"], b2["x"])
        y1 = max(b1["y"], b2["y"])
        x2 = min(b1["x"] + b1["width"], b2["x"] + b2["width"])
        y2 = min(b1["y"] + b1["height"], b2["y"] + b2["height"])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = b1["width"] * b1["height"]
        area2 = b2["width"] * b2["height"]
        union = area1 + area2 - inter
        return inter / float(union) if union > 0 else 0.0

    def delete_session_image(self, image_id: str):
        sess = self.get_active_session()
        sess["images"] = [img for img in sess.get("images", []) if img["id"] != image_id]
        if sess.get("active_image_id") == image_id:
            sess["active_image_id"] = sess["images"][0]["id"] if sess["images"] else None
        self._save_session_autosave()
        self.log(f"Deleted image {image_id} from session")
        return sess

    def set_active_session_image(self, image_id: str):
        sess = self.get_active_session()
        sess["active_image_id"] = image_id
        self._save_session_autosave()
        return {"status": "success", "active_image_id": image_id}

    def update_detection_box(self, image_id: str, product_id: str, x: int, y: int, width: int, height: int):
        sess = self.get_active_session()
        for img in sess.get("images", []):
            if img["id"] == image_id:
                for prod in img.get("products", []):
                    if prod["id"] == product_id:
                        prod["x"] = max(0, int(round(x)))
                        prod["y"] = max(0, int(round(y)))
                        prod["width"] = max(10, int(round(width)))
                        prod["height"] = max(10, int(round(height)))
                        prod["user_locked"] = True
                        self._save_session_autosave()
                        return {"status": "success", "product": prod}
        return {"status": "error", "message": "Product not found"}

    def add_manual_product(self, image_id: str, x: int, y: int, width: int, height: int):
        sess = self.get_active_session()
        for img in sess.get("images", []):
            if img["id"] == image_id:
                next_idx = len(img.get("products", [])) + 1
                new_prod = {
                    "id": f"man_{int(time.time()*1000)}_{next_idx}",
                    "product_index": next_idx,
                    "x": max(0, int(round(x))),
                    "y": max(0, int(round(y))),
                    "width": max(15, int(round(width))),
                    "height": max(15, int(round(height))),
                    "confidence": 1.0,
                    "source": "manual",
                    "label": "Manual Cut",
                    "name": f"Product {next_idx}",
                    "code": f"ZF{str(next_idx).zfill(2)}",
                    "box": "A-01",
                    "notes": "",
                    "user_locked": True
                }
                img.setdefault("products", []).append(new_prod)
                self._save_session_autosave()
                self.log(f"Manual product added to {img['name']} (Product {next_idx})")
                return {"status": "success", "product": new_prod, "session": sess}
        return {"status": "error", "message": "Image not found"}

    def delete_detection_product(self, image_id: str, product_id: str):
        sess = self.get_active_session()
        for img in sess.get("images", []):
            if img["id"] == image_id:
                prods = img.get("products", [])
                filtered = [p for p in prods if p["id"] != product_id]
                if len(filtered) < len(prods):
                    img["removed_count"] = img.get("removed_count", 0) + (len(prods) - len(filtered))
                    img["products"] = filtered
                    for i, p in enumerate(img["products"], start=1):
                        p["product_index"] = i
                    self._save_session_autosave()
                    return {"status": "success", "session": sess}
        return {"status": "error", "message": "Product not found"}

    def get_scaler_models(self):
        """Returns metadata list of available super-resolution models."""
        return ImageScaler.get_available_models()

    def generate_product_crops(self, session_id: str = None, upscale: bool = True, model: str = "realesrgan"):
        """
        Takes every confirmed bounding box and generates an individual high-res crop.
        When upscale=True, automatically applies real neural super-resolution (Real-ESRGAN AI 4x,
        FSRCNN 4x, ESPCN 4x, or Lanczos-4 HD) to produce crisp HD visuals when zoomed.
        Preserves pristine raw crops to prevent compounding degradation.
        """
        sess = self.get_active_session()
        all_crops = []
        global_idx = 1

        boxes = self.get_storage_boxes()
        default_box = boxes[0]["name"] if boxes else "A-01"

        for img_rec in sess.get("images", []):
            img_path = img_rec.get("path")
            if not img_path or not Path(img_path).exists():
                continue

            try:
                with Image.open(img_path) as full_img:
                    im_w, im_h = full_img.size
                    for prod in img_rec.get("products", []):
                        x = max(0, min(im_w - 1, prod["x"]))
                        y = max(0, min(im_h - 1, prod["y"]))
                        w = max(10, min(im_w - x, prod["width"]))
                        h = max(10, min(im_h - y, prod["height"]))

                        crop = full_img.crop((x, y, x + w, y + h))
                        if crop.mode not in ("RGB", "RGBA"):
                            crop = crop.convert("RGB")

                        # Save pristine master raw crop (never degraded by repeated upscales)
                        raw_crop_filename = f"crop_raw_{img_rec['id']}_{prod['id']}.png"
                        raw_crop_path = CROPS_DIR / raw_crop_filename
                        crop.save(raw_crop_path, format="PNG")

                        crop_filename = f"crop_{img_rec['id']}_{prod['id']}.jpg"
                        crop_path = CROPS_DIR / crop_filename

                        if upscale:
                            enhanced_cv, elapsed_ms, model_name = ImageScaler.enhance_and_upscale(
                                crop,
                                model=model,
                                scale=4.0 if model in ("realesrgan", "fsrcnn", "espcn") else 2.5,
                                min_dim=640,
                                denoise=True,
                                clahe=True
                            )
                            cv2.imwrite(str(crop_path), enhanced_cv, [cv2.IMWRITE_JPEG_QUALITY, 95])
                            b64 = ImageScaler.get_enhanced_b64(enhanced_cv, max_preview=480)
                            enh_h, enh_w = enhanced_cv.shape[:2]
                            model_label = model_name
                        else:
                            crop.save(crop_path, format="JPEG", quality=92)
                            buf = BytesIO()
                            crop_thumb = crop.copy()
                            crop_thumb.thumbnail((480, 480), Image.Resampling.BILINEAR)
                            crop_thumb.save(buf, format="JPEG", quality=88)
                            b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
                            enh_w, enh_h = w, h
                            model_label = "Original"

                        prod["crop_path"] = str(crop_path).replace("\\", "/")
                        prod["raw_crop_path"] = str(raw_crop_path).replace("\\", "/")

                        all_crops.append({
                            "id": prod["id"],
                            "image_id": img_rec["id"],
                            "image_name": img_rec["name"],
                            "product_index": global_idx,
                            "x": x,
                            "y": y,
                            "width": enh_w if upscale else w,
                            "height": enh_h if upscale else h,
                            "orig_width": w,
                            "orig_height": h,
                            "enhanced_width": enh_w,
                            "enhanced_height": enh_h,
                            "is_hd": bool(upscale),
                            "model_name": model_label,
                            "crop_path": str(crop_path).replace("\\", "/"),
                            "raw_crop_path": str(raw_crop_path).replace("\\", "/"),
                            "crop_b64": b64,
                            "name": prod.get("name") or f"Product {global_idx}",
                            "code": prod.get("code") or f"ZF{str(global_idx).zfill(2)}",
                            "box": prod.get("box") or default_box,
                            "notes": prod.get("notes", ""),
                            "source": prod.get("source", "ai")
                        })
                        global_idx += 1
            except Exception as e:
                self.log(f"Error generating crops for {img_rec['name']}: {e}")

        self._save_session_autosave()
        self.log(f"Generated {len(all_crops)} product crops with {model} (HD: {upscale})")
        return all_crops

    def retake_product_crop(self, product_id: str, new_file_path: str = None, base64_data: str = None, upscale: bool = True, model: str = "realesrgan"):
        """
        Retakes ONLY the specified individual product in the review list.
        Replaces its crop image with a new photo (webcam or file), applies AI super-resolution,
        preserves raw master copy, and keeps the product's name, code, box, and index intact!
        """
        sess = self.get_active_session()
        target_prod = None

        for img in sess.get("images", []):
            for p in img.get("products", []):
                if p["id"] == product_id:
                    target_prod = p
                    break
            if target_prod:
                break

        try:
            if base64_data:
                if "," in base64_data:
                    base64_data = base64_data.split(",", 1)[1]
                raw_bytes = base64.b64decode(base64_data)
                img_array = np.frombuffer(raw_bytes, dtype=np.uint8)
                cv_img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            elif new_file_path:
                p = Path(new_file_path)
                if not p.exists():
                    return {"status": "error", "message": "File does not exist"}
                cv_img = cv2.imread(str(p))
            else:
                return {"status": "error", "message": "No replacement image provided"}

            if cv_img is None or cv_img.size == 0:
                return {"status": "error", "message": "Could not decode replacement image"}

            h, w = cv_img.shape[:2]
            timestamp = int(time.time() * 1000)
            raw_crop_filename = f"crop_raw_retake_{product_id}_{timestamp}.png"
            crop_filename = f"crop_retake_{product_id}_{timestamp}.jpg"
            raw_crop_path = CROPS_DIR / raw_crop_filename
            crop_path = CROPS_DIR / crop_filename

            # Save pristine master raw copy
            cv2.imwrite(str(raw_crop_path), cv_img)

            if upscale:
                enhanced_cv, elapsed_ms, model_name = ImageScaler.enhance_and_upscale(
                    cv_img,
                    model=model,
                    scale=4.0 if model in ("realesrgan", "fsrcnn", "espcn") else 2.5,
                    min_dim=640,
                    denoise=True,
                    clahe=True
                )
                cv2.imwrite(str(crop_path), enhanced_cv, [cv2.IMWRITE_JPEG_QUALITY, 95])
                b64 = ImageScaler.get_enhanced_b64(enhanced_cv, max_preview=480)
                enh_h, enh_w = enhanced_cv.shape[:2]
                model_label = model_name
            else:
                cv2.imwrite(str(crop_path), cv_img, [cv2.IMWRITE_JPEG_QUALITY, 92])
                b64 = ImageScaler.get_enhanced_b64(cv_img, max_preview=480)
                enh_w, enh_h = w, h
                model_label = "Original"

            if target_prod:
                target_prod["crop_path"] = str(crop_path).replace("\\", "/")
                target_prod["raw_crop_path"] = str(raw_crop_path).replace("\\", "/")
                target_prod["crop_b64"] = b64
                target_prod["source"] = "retake"
                self._save_session_autosave()

            self.log(f"Retook specific product {product_id} with {model_label} (HD: {enh_w}x{enh_h})")
            return {
                "status": "success",
                "product_id": product_id,
                "crop_path": str(crop_path).replace("\\", "/"),
                "raw_crop_path": str(raw_crop_path).replace("\\", "/"),
                "crop_b64": b64,
                "enhanced_width": enh_w,
                "enhanced_height": enh_h,
                "width": enh_w,
                "height": enh_h,
                "model_name": model_label,
                "is_hd": bool(upscale),
                "product": target_prod
            }
        except Exception as e:
            self.log(f"Retake product error: {e}")
            return {"status": "error", "message": str(e)}

    def upscale_product_crop(self, crop_path: str, scale: float = 4.0, model: str = "realesrgan"):
        """
        Upscales an individual product crop on disk using selected AI/neural model.
        Reads from pristine raw master copy if available to eliminate compounding artifacts.
        """
        try:
            p = Path(crop_path)
            if not p.exists():
                return {"status": "error", "message": "Crop not found"}

            # Check if pristine raw master exists
            raw_candidate = p.parent / p.name.replace("crop_", "crop_raw_").replace(".jpg", ".png")
            source_path = raw_candidate if raw_candidate.exists() else p

            cv_img = cv2.imread(str(source_path))
            if cv_img is None:
                return {"status": "error", "message": "Cannot read image"}

            enhanced, elapsed_ms, model_name = ImageScaler.enhance_and_upscale(
                cv_img,
                model=model,
                scale=scale,
                min_dim=640,
                denoise=True,
                clahe=True
            )
            cv2.imwrite(str(p), enhanced, [cv2.IMWRITE_JPEG_QUALITY, 95])
            b64 = ImageScaler.get_enhanced_b64(enhanced, max_preview=480)
            h, w = enhanced.shape[:2]
            return {
                "status": "success",
                "crop_b64": b64,
                "width": w,
                "height": h,
                "model_name": model_name,
                "elapsed_ms": round(elapsed_ms, 1)
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def save_inventory_products(self, products_data: list, target_folder: str = None):
        """
        Saves all confirmed products, writes individual crops into the user's selected/default
        image folder on disk, and records inventory in storage/inventory.json.
        """
        if not products_data:
            return {"status": "error", "message": "No products to save"}

        dest_folder = None
        if target_folder and Path(target_folder).is_dir():
            dest_folder = Path(target_folder)
        elif self.get_default_folder() and Path(self.get_default_folder()).is_dir():
            dest_folder = Path(self.get_default_folder())
        elif self._current_folder and Path(self._current_folder).is_dir():
            dest_folder = Path(self._current_folder)
        else:
            dest_folder = STORAGE_DIR / "saved_products"

        dest_products_dir = dest_folder / "products"
        dest_products_dir.mkdir(parents=True, exist_ok=True)

        inventory = []
        if INVENTORY_PATH.exists():
            try:
                with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
                    inventory = json.load(f)
            except Exception:
                pass

        saved_records = []
        timestamp = time.strftime("%Y%m%d_%H%M%S")

        for idx, item in enumerate(products_data, start=1):
            name = item.get("name", f"Product {idx}").strip()
            code = item.get("code", f"ZF{idx:02d}").strip()
            box = item.get("box", "A-01").strip()
            notes = item.get("notes", "").strip()
            crop_path = item.get("crop_path")

            safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)[:32]
            safe_code = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in code)[:16]
            file_name = f"{safe_code}_{safe_name}_{timestamp}_{idx}.png"
            final_file_path = dest_products_dir / file_name

            if crop_path and Path(crop_path).exists():
                try:
                    with Image.open(crop_path) as cimg:
                        cimg.save(final_file_path, format="PNG")
                except Exception:
                    pass
            elif item.get("crop_b64"):
                try:
                    b64_str = item["crop_b64"].split(",", 1)[-1]
                    with open(final_file_path, "wb") as f:
                        f.write(base64.b64decode(b64_str))
                except Exception:
                    pass

            norm_final_path = str(final_file_path).replace("\\", "/")

            rec = {
                "id": f"inv_{int(time.time()*1000)}_{idx}",
                "name": name,
                "code": code,
                "box": box,
                "notes": notes,
                "file_path": norm_final_path,
                "file_name": file_name,
                "source": item.get("source", "ai"),
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            inventory.append(rec)
            saved_records.append(rec)

            # Store in local metadata so it syncs with Library
            meta_dict = {"code": code, "box": box, "custom_name": name}
            self._metadata[norm_final_path] = meta_dict
            self._metadata[file_name] = meta_dict

        with open(INVENTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(inventory, f, indent=2)

        self.clear_scan_session()

        self.log(f"Saved {len(saved_records)} products to inventory in: {dest_products_dir}")
        return {
            "status": "success",
            "count": len(saved_records),
            "saved_folder": str(dest_products_dir).replace("\\", "/"),
            "items": saved_records
        }


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
