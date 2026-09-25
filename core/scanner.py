import os
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

SAFE_IMAGE_EXTS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff", ".tif", ".ico", ".avif"
}

class FastScanner:
    def __init__(self, extensions=None):
        self.extensions = extensions or SAFE_IMAGE_EXTS
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def scan(self, directory: str, recursive: bool = True, progress_cb=None):
        self._cancelled = False
        target_dir = Path(directory)
        if not target_dir.is_dir():
            raise FileNotFoundError(f"Directory not found: {directory}")

        found_images = []
        start_time = time.time()
        count = 0

        def inspect_entry(entry):
            if entry.is_file():
                ext = Path(entry.name).suffix.lower()
                if ext in self.extensions:
                    try:
                        stat = entry.stat()
                        return {
                            "path": entry.path.replace("\\", "/"),
                            "name": entry.name,
                            "ext": ext,
                            "size": stat.st_size,
                            "modified": stat.st_mtime,
                        }
                    except Exception:
                        return None
            return None

        # Fast directory crawl using os.scandir
        try:
            if recursive:
                for root, dirs, files in os.walk(directory):
                    if self._cancelled:
                        break
                    for file_name in files:
                        ext = os.path.splitext(file_name)[1].lower()
                        if ext in self.extensions:
                            full_path = os.path.join(root, file_name)
                            try:
                                size = os.path.getsize(full_path)
                                mtime = os.path.getmtime(full_path)
                                item = {
                                    "path": full_path.replace("\\", "/"),
                                    "name": file_name,
                                    "ext": ext,
                                    "size": size,
                                    "modified": mtime,
                                }
                                found_images.append(item)
                                count += 1
                                if progress_cb and count % 25 == 0:
                                    progress_cb(count, None)
                            except Exception:
                                continue
            else:
                with os.scandir(directory) as it:
                    for entry in it:
                        if self._cancelled:
                            break
                        res = inspect_entry(entry)
                        if res:
                            found_images.append(res)
                            count += 1
                            if progress_cb and count % 25 == 0:
                                progress_cb(count, None)
        except Exception as e:
            print(f"[Scanner] Error scanning: {e}")

        elapsed = time.time() - start_time
        if progress_cb:
            progress_cb(count, elapsed)

        return found_images
