import os
import gc
import json
import threading
from pathlib import Path
import numpy as np
from PIL import Image

class FastEmbedder:
    def __init__(self, models_dir: str = None):
        self.models_dir = Path(models_dir) if models_dir else Path(__file__).resolve().parent.parent.parent / "models"
        self.model = None
        self.processor = None
        self.model_name = None
        self.dimension = 0
        self.is_ready = False
        self.device = "cpu"
        self.model_type = None
        self._lock = threading.Lock()

    def detect_local_models(self):
        found = []
        if not self.models_dir.is_dir():
            return found

        for entry in self.models_dir.iterdir():
            if entry.is_dir():
                config_file = entry / "config.json"
                weights_bin = entry / "pytorch_model.bin"
                weights_safe = entry / "model.safetensors"
                if config_file.exists() and (weights_bin.exists() or weights_safe.exists()):
                    model_type = "unknown"
                    dim = 768 if "siglip" in entry.name.lower() else 512
                    try:
                        with open(config_file, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                            model_type = cfg.get("model_type", "vision")
                            if "projection_dim" in cfg:
                                dim = cfg["projection_dim"]
                            elif "vision_config" in cfg and "projection_dim" in cfg["vision_config"]:
                                dim = cfg["vision_config"]["projection_dim"]
                            elif "vision_config" in cfg and "hidden_size" in cfg["vision_config"]:
                                dim = cfg["vision_config"]["hidden_size"]
                            elif "text_config" in cfg and "hidden_size" in cfg["text_config"]:
                                dim = cfg["text_config"]["hidden_size"]
                    except Exception:
                        pass
                    # Hard calibration for known architectures
                    if "siglip" in entry.name.lower() and dim < 768:
                        dim = 768
                    elif "clip-vit-base" in entry.name.lower():
                        dim = 512

                    found.append({
                        "name": entry.name,
                        "path": str(entry).replace("\\", "/"),
                        "type": model_type,
                        "dimension": dim,
                        "has_safetensors": weights_safe.exists()
                    })
        # Prioritize fine-grained SigLIP models first
        found.sort(key=lambda m: (0 if "siglip" in m["name"].lower() else 1, 0 if m["has_safetensors"] else 1))
        return found

    def load_model(self, model_path: str = None, progress_cb=None):
        with self._lock:
            target_path = Path(model_path) if model_path else None
            if not target_path or not target_path.exists():
                models = self.detect_local_models()
                if not models:
                    raise FileNotFoundError(f"No valid models found in {self.models_dir}")
                target_path = Path(models[0]["path"])

            # Fast return if model is already loaded and ready
            if self.is_ready and self.model is not None and self.model_name == target_path.name:
                return {
                    "model_name": self.model_name,
                    "dimension": self.dimension,
                    "device": self.device,
                    "status": "ready"
                }

            import torch
            from transformers import AutoProcessor, AutoModel

            # Set thread budget for low memory & CPU friendliness (keep PC cool & responsive)
            cpu_cnt = os.cpu_count() or 2
            threads = max(1, min(2, cpu_cnt - 1))
            torch.set_num_threads(threads)
            torch.set_grad_enabled(False)

            if progress_cb:
                progress_cb("Mounting neural vision model...", 30)

            # Unload any previously loaded model to release RAM
            if self.model is not None:
                del self.model
                del self.processor
                self.model = None
                self.processor = None
                self.is_ready = False
                gc.collect()

            print(f"[Embedder] Loading model from: {target_path}")
            try:
                self.processor = AutoProcessor.from_pretrained(str(target_path), local_files_only=True, use_fast=False)
            except Exception:
                self.processor = AutoProcessor.from_pretrained(str(target_path), local_files_only=True)
            
            # Load in inference mode with modern dtype parameter
            self.model = AutoModel.from_pretrained(
                str(target_path),
                local_files_only=True,
                dtype=torch.float32,
                low_cpu_mem_usage=True
            )
            self.model.eval()

            self.model_name = target_path.name
            self.model_type = "siglip" if "siglip" in target_path.name.lower() else "clip"
            self.is_ready = True
            
            # Determine output dimension
            dummy_img = Image.new("RGB", (224, 224), color=(128, 128, 128))
            test_emb = self.embed_image(dummy_img)
            self.dimension = len(test_emb)

            if progress_cb:
                progress_cb("Neural model active", 100)

            return {
                "model_name": self.model_name,
                "dimension": self.dimension,
                "device": self.device,
                "status": "ready"
            }

    def _extract_tensor(self, outputs):
        import torch
        if isinstance(outputs, torch.Tensor):
            return outputs
        for attr in ["image_embeds", "text_embeds", "pooler_output", "last_hidden_state"]:
            if hasattr(outputs, attr):
                val = getattr(outputs, attr)
                if isinstance(val, torch.Tensor):
                    if attr == "last_hidden_state" and len(val.shape) == 3:
                        return val[:, 0, :]
                    return val
        return None

    def embed_image(self, image_input):
        import torch
        if not self.is_ready or self.model is None:
            raise RuntimeError("Model is not loaded")

        if isinstance(image_input, (str, Path)):
            with Image.open(image_input) as img:
                image = img.convert("RGB")
                if max(image.size) > 512:
                    image.thumbnail((512, 512), Image.Resampling.BILINEAR)
                return self._compute_embedding(image)
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB") if image_input.mode != "RGB" else image_input
            if max(image.size) > 512:
                image = image.copy()
                image.thumbnail((512, 512), Image.Resampling.BILINEAR)
            return self._compute_embedding(image)
        else:
            raise ValueError("Unsupported image input type")

    def _compute_embedding(self, pil_image):
        import torch
        inputs = self.processor(images=pil_image, return_tensors="pt")
        with torch.inference_mode():
            if hasattr(self.model, "get_image_features"):
                outputs = self.model.get_image_features(**inputs)
            else:
                outputs = self.model(**inputs)
            features = self._extract_tensor(outputs)
            if features is None:
                raise ValueError("Could not extract feature tensor from model output")

        # Normalize to unit vector for cosine distance
        norm = torch.linalg.norm(features, dim=-1, keepdim=True)
        norm = torch.clamp(norm, min=1e-12)
        normalized = (features / norm).squeeze(0).cpu().numpy().astype(np.float32)
        return normalized.tolist()

    def embed_batch(self, image_paths: list):
        results = []
        for path in image_paths:
            try:
                emb = self.embed_image(path)
                results.append((path, emb, None))
            except Exception as e:
                results.append((path, None, str(e)))
        return results
