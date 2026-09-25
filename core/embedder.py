import os
import gc
import json
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
                    dim = 512
                    try:
                        with open(config_file, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                            model_type = cfg.get("model_type", "vision")
                            if "vision_config" in cfg and "hidden_size" in cfg["vision_config"]:
                                dim = cfg["vision_config"]["hidden_size"]
                            elif "projection_dim" in cfg:
                                dim = cfg["projection_dim"]
                    except Exception:
                        pass
                    found.append({
                        "name": entry.name,
                        "path": str(entry).replace("\\", "/"),
                        "type": model_type,
                        "dimension": dim,
                        "has_safetensors": weights_safe.exists()
                    })
        return found

    def load_model(self, model_path: str = None, progress_cb=None):
        import torch
        from transformers import AutoProcessor, AutoModel

        # Set thread budget for low memory & CPU friendliness
        torch.set_num_threads(max(1, min(4, os.cpu_count() or 2)))
        torch.set_grad_enabled(False)

        target_path = Path(model_path) if model_path else None
        if not target_path or not target_path.exists():
            models = self.detect_local_models()
            if not models:
                raise FileNotFoundError(f"No valid models found in {self.models_dir}")
            # Prefer siglip or safetensors if available
            target_path = Path(models[0]["path"])
            for m in models:
                if "siglip" in m["name"].lower():
                    target_path = Path(m["path"])
                    break

        if progress_cb:
            progress_cb("Mounting neural vision model...", 30)

        # Unload any previously loaded model to release RAM
        if self.model is not None:
            del self.model
            del self.processor
            gc.collect()

        print(f"[Embedder] Loading model from: {target_path}")
        self.processor = AutoProcessor.from_pretrained(str(target_path), local_files_only=True)
        
        # Load in inference mode
        self.model = AutoModel.from_pretrained(
            str(target_path),
            local_files_only=True,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True
        )
        self.model.eval()

        self.model_name = target_path.name
        self.model_type = "siglip" if "siglip" in target_path.name.lower() else "clip"
        
        # Determine output dimension
        dummy_img = Image.new("RGB", (224, 224), color=(128, 128, 128))
        test_emb = self.embed_image(dummy_img)
        self.dimension = len(test_emb)
        self.is_ready = True

        if progress_cb:
            progress_cb("Neural model active", 100)

        return {
            "model_name": self.model_name,
            "dimension": self.dimension,
            "device": self.device,
            "status": "ready"
        }

    def embed_image(self, image_input):
        import torch
        if not self.is_ready or self.model is None:
            raise RuntimeError("Model is not loaded")

        if isinstance(image_input, (str, Path)):
            with Image.open(image_input) as img:
                image = img.convert("RGB")
                return self._compute_embedding(image)
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB") if image_input.mode != "RGB" else image_input
            return self._compute_embedding(image)
        else:
            raise ValueError("Unsupported image input type")

    def _compute_embedding(self, pil_image):
        import torch
        inputs = self.processor(images=pil_image, return_tensors="pt")
        with torch.no_grad():
            if hasattr(self.model, "get_image_features"):
                features = self.model.get_image_features(**inputs)
            else:
                outputs = self.model(**inputs)
                if hasattr(outputs, "image_embeds"):
                    features = outputs.image_embeds
                elif hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
                    features = outputs.pooler_output
                else:
                    features = outputs.last_hidden_state[:, 0, :]

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
