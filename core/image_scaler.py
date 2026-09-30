"""
Multi-Model AI Super-Resolution & Quality Enhancement Engine for ZFound.
Optimized for low-end dual-core CPU machines (no GPU required).

Supported AI Models:
1. Real-ESRGAN Compact AI 4x (realesr-general-x4v3.onnx - 4.6MB)
   - Deep residual generative restoration
   - Denoises, de-blurs, and reconstructs photorealistic textures
2. FSRCNN Deep Neural 4x / 2x (FSRCNN_x4.pb / FSRCNN_x2.pb - 40KB)
   - Official OpenCV fast convolutional super-resolution
   - Crisp learned edge reconstruction in ~90ms
3. ESPCN Sub-Pixel Neural 4x (ESPCN_x4.pb - 100KB)
   - Ultra-fast real-time sub-pixel super-resolution in ~50ms
4. Lanczos-4 Sinc Interpolation with Bilateral Denoising (Algorithmic fallback)
"""

import os
import cv2
import time
import base64
import numpy as np
from io import BytesIO
from pathlib import Path
from PIL import Image

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models" / "superres"
if not MODELS_DIR.exists():
    MODELS_DIR = Path("E:/XFind_Pro/models/superres")

class ImageScaler:
    _realesr_sess = None
    _fsrcnn_models = {}
    _espcn_models = {}

    @classmethod
    def _get_realesr_session(cls):
        if cls._realesr_sess is None:
            model_path = MODELS_DIR / "realesr-general-x4v3.onnx"
            if not model_path.exists():
                return None
            try:
                import onnxruntime as ort
                opts = ort.SessionOptions()
                cpu_cnt = os.cpu_count() or 2
                threads = max(1, min(2, cpu_cnt - 1))
                opts.intra_op_num_threads = threads
                opts.inter_op_num_threads = 1
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                cls._realesr_sess = ort.InferenceSession(str(model_path), opts, providers=["CPUExecutionProvider"])
            except Exception as e:
                print(f"[ImageScaler] Failed to load Real-ESRGAN ONNX: {e}")
                cls._realesr_sess = None
        return cls._realesr_sess

    @classmethod
    def _get_fsrcnn_model(cls, scale: int = 4):
        if scale not in cls._fsrcnn_models:
            model_file = f"FSRCNN_x{scale}.pb"
            model_path = MODELS_DIR / model_file
            if not model_path.exists():
                model_path = MODELS_DIR / "FSRCNN_x4.pb"
                scale = 4
            if not model_path.exists():
                return None
            try:
                sr = cv2.dnn_superres.DnnSuperResImpl_create()
                sr.readModel(str(model_path))
                sr.setModel("fsrcnn", scale)
                cls._fsrcnn_models[scale] = (sr, scale)
            except Exception as e:
                print(f"[ImageScaler] Failed to load FSRCNN x{scale}: {e}")
                return None
        return cls._fsrcnn_models.get(scale)

    @classmethod
    def _get_espcn_model(cls, scale: int = 4):
        if scale not in cls._espcn_models:
            model_file = f"ESPCN_x{scale}.pb"
            model_path = MODELS_DIR / model_file
            if not model_path.exists():
                return None
            try:
                sr = cv2.dnn_superres.DnnSuperResImpl_create()
                sr.readModel(str(model_path))
                sr.setModel("espcn", scale)
                cls._espcn_models[scale] = (sr, scale)
            except Exception as e:
                print(f"[ImageScaler] Failed to load ESPCN x{scale}: {e}")
                return None
        return cls._espcn_models.get(scale)

    @classmethod
    def get_available_models(cls):
        """Returns metadata list of available super-resolution models."""
        return [
            {
                "id": "realesrgan",
                "name": "Real-ESRGAN AI 4x",
                "label": "🤖 Real-ESRGAN AI 4x (Studio HD)",
                "available": (MODELS_DIR / "realesr-general-x4v3.onnx").exists(),
                "default": True
            },
            {
                "id": "fsrcnn",
                "name": "FSRCNN Neural 4x",
                "label": "⚡ FSRCNN Neural 4x (Fast 90ms)",
                "available": (MODELS_DIR / "FSRCNN_x4.pb").exists(),
                "default": False
            },
            {
                "id": "espcn",
                "name": "ESPCN Neural 4x",
                "label": "⚡ ESPCN Neural 4x (Sub-Pixel Fast)",
                "available": (MODELS_DIR / "ESPCN_x4.pb").exists(),
                "default": False
            },
            {
                "id": "lanczos",
                "name": "Lanczos-4 HD",
                "label": "🎯 Lanczos-4 HD (Smooth)",
                "available": True,
                "default": False
            }
        ]

    @classmethod
    def enhance_and_upscale(
        cls,
        img_input,
        model: str = "realesrgan",
        scale: float = 4.0,
        min_dim: int = 640,
        max_dim: int = 1600,
        denoise: bool = True,
        **kwargs
    ):
        """
        Main Super-Resolution & Enhancement pipeline.
        Returns:
            enhanced_cv (np.ndarray BGR), elapsed_ms (float), model_name_used (str)
        """
        t0 = time.time()

        # Normalize to OpenCV BGR numpy array
        if isinstance(img_input, Image.Image):
            if img_input.mode != "RGB":
                img_input = img_input.convert("RGB")
            cv_img = cv2.cvtColor(np.array(img_input), cv2.COLOR_RGB2BGR)
        elif isinstance(img_input, np.ndarray):
            cv_img = img_input.copy()
        else:
            raise ValueError(f"Unsupported image input type: {type(img_input)}")

        if cv_img is None or cv_img.size == 0:
            return cv_img, 0.0, "none"

        h, w = cv_img.shape[:2]
        model_clean = str(model).lower().strip()

        def _apply_gentle_luster(img_bgr):
            if not kwargs.get("clahe", True):
                return img_bgr
            try:
                lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
                l_enh = clahe.apply(l)
                return cv2.cvtColor(cv2.merge((l_enh, a, b)), cv2.COLOR_LAB2BGR)
            except Exception:
                return img_bgr

        def _ensure_min_dim(img_bgr):
            if not min_dim:
                return img_bgr
            ih, iw = img_bgr.shape[:2]
            if max(ih, iw) < min_dim:
                ratio = float(min_dim) / float(max(ih, iw))
                nw = max(16, int(round(iw * ratio)))
                nh = max(16, int(round(ih * ratio)))
                return cv2.resize(img_bgr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
            return img_bgr

        # -------------------------------------------------------------
        # Mode 1: Real-ESRGAN AI 4x (Photorealistic Deep Super-Resolution)
        # -------------------------------------------------------------
        if model_clean in ("realesrgan", "realesr", "real-esrgan", "ai"):
            sess = cls._get_realesr_session()
            if sess is not None:
                try:
                    # Adaptive size clamp for CPU: keep input under 300px on long edge
                    # to keep RAM < 35MB and latency ~1.2s on dual-core CPUs
                    scale_down = 1.0
                    if max(h, w) > 300:
                        scale_down = 300.0 / float(max(h, w))
                        proc_w = max(16, int(round(w * scale_down)))
                        proc_h = max(16, int(round(h * scale_down)))
                        proc_in = cv2.resize(cv_img, (proc_w, proc_h), interpolation=cv2.INTER_AREA)
                    else:
                        proc_in = cv_img

                    # Convert BGR to normalized RGB float32 [1, 3, H, W]
                    rgb = cv2.cvtColor(proc_in, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
                    inp = np.transpose(rgb, (2, 0, 1))[np.newaxis, :, :, :]

                    out = sess.run(None, {"input": inp})[0]

                    # Convert back to uint8 BGR
                    out_img = np.clip(np.transpose(out[0], (1, 2, 0)) * 255.0, 0, 255).astype(np.uint8)
                    out_bgr = cv2.cvtColor(out_img, cv2.COLOR_RGB2BGR)

                    out_bgr = _ensure_min_dim(out_bgr)
                    out_bgr = _apply_gentle_luster(out_bgr)

                    elapsed_ms = (time.time() - t0) * 1000.0
                    return out_bgr, elapsed_ms, "Real-ESRGAN AI 4x"
                except Exception as e:
                    print(f"[ImageScaler] Real-ESRGAN inference error: {e}, falling back to FSRCNN")
                    model_clean = "fsrcnn"

        # -------------------------------------------------------------
        # Mode 2: FSRCNN Neural Network 4x (OpenCV Deep Learning)
        # -------------------------------------------------------------
        if model_clean in ("fsrcnn", "fast", "neural"):
            fsrcnn_tuple = cls._get_fsrcnn_model(scale=4)
            if fsrcnn_tuple and fsrcnn_tuple[0] is not None:
                try:
                    sr_obj, _ = fsrcnn_tuple
                    if max(h, w) > 360:
                        scale_down = 360.0 / float(max(h, w))
                        proc_in = cv2.resize(cv_img, (int(round(w * scale_down)), int(round(h * scale_down))), interpolation=cv2.INTER_AREA)
                    else:
                        proc_in = cv_img

                    out_bgr = sr_obj.upsample(proc_in)
                    out_bgr = _ensure_min_dim(out_bgr)
                    out_bgr = _apply_gentle_luster(out_bgr)

                    elapsed_ms = (time.time() - t0) * 1000.0
                    return out_bgr, elapsed_ms, "FSRCNN Neural 4x"
                except Exception as e:
                    print(f"[ImageScaler] FSRCNN error: {e}, falling back to ESPCN")
                    model_clean = "espcn"

        # -------------------------------------------------------------
        # Mode 3: ESPCN Sub-Pixel Neural 4x (Ultra-Fast)
        # -------------------------------------------------------------
        if model_clean in ("espcn", "subpixel"):
            espcn_tuple = cls._get_espcn_model(scale=4)
            if espcn_tuple and espcn_tuple[0] is not None:
                try:
                    sr_obj, _ = espcn_tuple
                    if max(h, w) > 380:
                        scale_down = 380.0 / float(max(h, w))
                        proc_in = cv2.resize(cv_img, (int(round(w * scale_down)), int(round(h * scale_down))), interpolation=cv2.INTER_AREA)
                    else:
                        proc_in = cv_img

                    out_bgr = sr_obj.upsample(proc_in)
                    out_bgr = _ensure_min_dim(out_bgr)
                    out_bgr = _apply_gentle_luster(out_bgr)

                    elapsed_ms = (time.time() - t0) * 1000.0
                    return out_bgr, elapsed_ms, "ESPCN Neural 4x"
                except Exception as e:
                    print(f"[ImageScaler] ESPCN error: {e}, falling back to Lanczos")
                    model_clean = "lanczos"

        # -------------------------------------------------------------
        # Mode 4: Lanczos-4 High-Order Resampling (Clean Algorithmic)
        # -------------------------------------------------------------
        target_scale = float(scale)
        min_edge = min(h, w)
        if min_edge < min_dim:
            target_scale = max(target_scale, float(min_dim) / float(max(1, min_edge)))
        target_scale = max(1.0, min(4.0, target_scale))

        new_w = max(16, int(round(w * target_scale)))
        new_h = max(16, int(round(h * target_scale)))

        if denoise and min(h, w) > 20:
            cleaned = cv2.bilateralFilter(cv_img, d=5, sigmaColor=20, sigmaSpace=20)
        else:
            cleaned = cv_img

        out_bgr = cv2.resize(cleaned, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        out_bgr = _apply_gentle_luster(out_bgr)
        elapsed_ms = (time.time() - t0) * 1000.0
        return out_bgr, elapsed_ms, "Lanczos-4 HD"

    @staticmethod
    def get_enhanced_b64(cv_img, max_preview: int = 480) -> str:
        """Generates a compact base64 JPEG data URL for browser display."""
        if cv_img is None or cv_img.size == 0:
            return ""

        h, w = cv_img.shape[:2]
        if max(h, w) > max_preview:
            scale = float(max_preview) / float(max(h, w))
            preview_w = max(10, int(round(w * scale)))
            preview_h = max(10, int(round(h * scale)))
            preview = cv2.resize(cv_img, (preview_w, preview_h), interpolation=cv2.INTER_AREA)
        else:
            preview = cv_img

        success, buf = cv2.imencode(".jpg", preview, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not success:
            return ""

        b64 = base64.b64encode(buf.tobytes()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
