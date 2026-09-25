#!/usr/bin/env python3
"""
ZFound AI Vision Worker Daemon
Lightweight background neural embedding worker using CLIP (clip-vit-base-patch32)
Communicates via JSON lines over stdin / stdout.
"""

import sys
import os
import io
import json
import time
import logging
import warnings
import contextlib
from pathlib import Path
from PIL import Image

# Ensure low CPU thread count for quiet background inference
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"
warnings.filterwarnings("ignore")
logging.getLogger("transformers").setLevel(logging.ERROR)

import torch
torch.set_num_threads(2)
torch.set_grad_enabled(False)

from transformers import CLIPModel, CLIPProcessor

class VisionWorker:
    def __init__(self, models_dir: str = None):
        if not models_dir:
            candidates = [
                Path(__file__).resolve().parent.parent.parent / "models",
                Path(__file__).resolve().parent.parent / "models",
                Path("e:/XFind_Pro/models"),
            ]
            for c in candidates:
                if c.is_dir():
                    models_dir = str(c)
                    break
            if not models_dir:
                models_dir = "e:/XFind_Pro/models"
        self.models_dir = Path(models_dir)
        self.model = None
        self.processor = None
        self.model_name = ""
        self.dimension = 512
        self.is_ready = False

    def load_clip(self, model_name: str = "clip-vit-base-patch32"):
        model_path = self.models_dir / model_name
        if not model_path.exists():
            return False, f"Model path not found: {model_path}"

        try:
            # Silence HuggingFace load reports from leaking into stdout
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                self.processor = CLIPProcessor.from_pretrained(str(model_path), local_files_only=True)
                self.model = CLIPModel.from_pretrained(
                    str(model_path),
                    local_files_only=True,
                    dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
                self.model.eval()

            self.model_name = model_name
            self.dimension = 512
            self.is_ready = True
            return True, f"Loaded {model_name} (512-D)"
        except Exception as e:
            return False, str(e)

    def embed_single(self, image_path: str):
        if not self.is_ready:
            return None, "Model is not loaded"
        try:
            p = Path(image_path)
            if not p.exists():
                return None, f"File not found: {image_path}"
            with Image.open(p) as img:
                rgb = img.convert("RGB")
                inputs = self.processor(images=rgb, return_tensors="pt")
            with torch.no_grad():
                feat = self.model.get_image_features(**inputs)
                if hasattr(feat, "pooler_output") and feat.pooler_output is not None:
                    feat = feat.pooler_output
                elif hasattr(feat, "image_embeds") and feat.image_embeds is not None:
                    feat = feat.image_embeds
                feat = feat / feat.norm(dim=-1, keepdim=True)
            vec = feat.squeeze(0).cpu().tolist()
            return vec, None
        except Exception as e:
            return None, str(e)

    def embed_batch(self, image_paths: list):
        if not self.is_ready:
            return [], "Model is not loaded"
        results = []
        for path in image_paths:
            vec, err = self.embed_single(path)
            results.append({"path": path, "vector": vec, "error": err})
        return results, None

def main():
    worker = VisionWorker()
    success, msg = worker.load_clip("clip-vit-base-patch32")

    # Output pure JSON ready signal
    ready_payload = {
        "status": "ready" if success else "error",
        "message": msg,
        "model": worker.model_name,
        "dimension": worker.dimension
    }
    sys.stdout.write(json.dumps(ready_payload) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            cmd = req.get("cmd")
            req_id = req.get("id")

            if cmd == "ping":
                resp = {"id": req_id, "status": "ok", "ready": worker.is_ready}
            elif cmd == "load_model":
                m_name = req.get("model", "clip-vit-base-patch32")
                ok, err = worker.load_clip(m_name)
                resp = {"id": req_id, "status": "ok" if ok else "error", "message": err}
            elif cmd == "embed_single":
                p = req.get("path")
                vec, err = worker.embed_single(p)
                resp = {"id": req_id, "status": "ok" if vec else "error", "vector": vec, "error": err}
            elif cmd == "embed_batch":
                paths = req.get("paths", [])
                items, err = worker.embed_batch(paths)
                resp = {"id": req_id, "status": "ok" if not err else "error", "items": items, "error": err}
            else:
                resp = {"id": req_id, "status": "error", "message": f"Unknown cmd: {cmd}"}

            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({"id": None, "status": "error", "message": str(e)}) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
