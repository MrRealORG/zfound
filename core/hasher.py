from pathlib import Path
from PIL import Image
import imagehash

class FastHasher:
    def __init__(self, hash_size=16):
        self.hash_size = hash_size

    def compute_phash(self, image_path: str):
        try:
            with Image.open(image_path) as img:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                h = imagehash.phash(img, hash_size=self.hash_size)
                return str(h)
        except Exception:
            return None

    def compute_dhash(self, image_path: str):
        try:
            with Image.open(image_path) as img:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                h = imagehash.dhash(img, hash_size=self.hash_size)
                return str(h)
        except Exception:
            return None

    @staticmethod
    def hamming_distance(hash1_str: str, hash2_str: str) -> int:
        if not hash1_str or not hash2_str:
            return 999
        try:
            val1 = int(hash1_str, 16)
            val2 = int(hash2_str, 16)
            return (val1 ^ val2).bit_count()
        except Exception:
            return 999
