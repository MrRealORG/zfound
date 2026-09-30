"""
PP-PicoDet-XS Object Detection Subsystem for ZFound
Ultra-lightweight product detector optimized for low-end dual-core CPU machines (4GB RAM).
Runs on 320x320 input via ONNX Runtime CPU.
"""

import os
import cv2
import time
import numpy as np
from pathlib import Path
import onnxruntime as ort

# Silence ONNX Runtime logs
ort.set_default_logger_severity(3)

class ProductDetector:
    """
    Standardized detector abstraction for physical product identification.
    Default Model: PaddleDetection PP-PicoDet-XS (320x320, INT/FP32 CPU ONNX)
    """
    def __init__(self, models_dir=None):
        self.model_name = "PP-PicoDet-XS (320x320)"
        self.models_dir = Path(models_dir) if models_dir else Path(__file__).resolve().parent.parent.parent / "models"
        self.picodet_dir = self.models_dir / "picodet"
        self.session = None
        self.labels = []
        self.is_ready = False
        
        # Normalization constants for PP-PicoDet (BGR format matching cv2)
        self.mean = np.array([103.53, 116.28, 123.675], dtype=np.float32).reshape(1, 1, 3)
        self.std = np.array([57.375, 57.12, 58.395], dtype=np.float32).reshape(1, 1, 3)
        
        self._init_model()

    def _init_model(self):
        try:
            # Candidate model paths: prefer xs_320, fallback to s_320
            model_candidates = [
                self.picodet_dir / "picodet_xs_320_lcnet_postprocessed.onnx",
                self.picodet_dir / "picodet_s_320_lcnet_postprocessed.onnx",
                Path("E:/XFind_Pro/models/picodet/picodet_xs_320_lcnet_postprocessed.onnx"),
            ]
            
            model_file = None
            for cand in model_candidates:
                if cand.exists() and cand.stat().st_size > 1000:
                    model_file = cand
                    break
                    
            if not model_file:
                print(f"[ProductDetector] Warning: No PicoDet ONNX model file found in {self.picodet_dir}")
                return

            label_file = self.picodet_dir / "coco_label.txt"
            if label_file.exists():
                with open(label_file, "r", encoding="utf-8") as f:
                    self.labels = [line.strip() for line in f if line.strip()]

            # Configure ultra-lightweight CPU session options for dual-core CPUs
            cpu_cnt = os.cpu_count() or 2
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = max(1, min(2, cpu_cnt - 1))
            opts.inter_op_num_threads = 1
            opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            opts.log_severity_level = 3

            self.session = ort.InferenceSession(str(model_file), opts, providers=['CPUExecutionProvider'])
            self.is_ready = True
            print(f"[ProductDetector] Loaded {model_file.name} successfully (CPU-optimized)")
        except Exception as e:
            print(f"[ProductDetector] Error loading model: {e}")
            self.session = None
            self.is_ready = False

    def detect_products(self, image_np, conf_threshold: float = 0.22, iou_threshold: float = 0.40) -> list:
        """
        Detects individual physical products in an image.
        Returns:
            list of dicts: [
                {
                    "x": int,
                    "y": int,
                    "width": int,
                    "height": int,
                    "confidence": float,
                    "source": "ai",
                    "label": str
                }, ...
            ]
        """
        if image_np is None or image_np.size == 0:
            return []

        h, w = image_np.shape[:2]
        all_proposals = []

        # 1. AI Inference with PP-PicoDet-XS
        if self.session is not None:
            try:
                # Downsample to 320x320 for inference
                resized = cv2.resize(image_np, (320, 320), interpolation=cv2.INTER_LINEAR)
                norm = (resized.astype(np.float32) - self.mean) / self.std
                blob = np.expand_dims(np.transpose(norm, (2, 0, 1)), axis=0).astype(np.float32)

                scale_factor = np.array([[320.0 / float(h), 320.0 / float(w)]], dtype=np.float32)

                outs = self.session.run(None, {'image': blob, 'scale_factor': scale_factor})[0]

                # Filter valid detections above threshold
                valid = outs[(outs[:, 1] >= conf_threshold) & (outs[:, 0] > -1)]
                for b in valid:
                    cid = int(b[0])
                    conf = float(b[1])
                    label = self.labels[cid] if cid < len(self.labels) else "Product"

                    # Coordinates mapped back to original image
                    x1 = max(0, min(w - 1, int(round(b[2]))))
                    y1 = max(0, min(h - 1, int(round(b[3]))))
                    x2 = max(0, min(w - 1, int(round(b[4]))))
                    y2 = max(0, min(h - 1, int(round(b[5]))))

                    bw = x2 - x1
                    bh = y2 - y1

                    # Ignore microscopic boxes or whole-frame boxes
                    if bw < 15 or bh < 15:
                        continue
                    if bw >= w * 0.98 and bh >= h * 0.98:
                        continue

                    all_proposals.append({
                        "x": x1,
                        "y": y1,
                        "width": bw,
                        "height": bh,
                        "confidence": round(conf, 3),
                        "source": "ai",
                        "label": label
                    })
            except Exception as e:
                print(f"[ProductDetector] Inference exception: {e}")

        # 2. Salient foreground contour detector (helps detect custom table products when confidence is borderline)
        if len(all_proposals) < 2:
            try:
                contour_boxes = self._detect_salient_products(image_np)
                all_proposals.extend(contour_boxes)
            except Exception as e:
                pass

        # 3. Class-agnostic Non-Maximum Suppression (collapses duplicate class predictions on the same object)
        clean_boxes = self._class_agnostic_nms(all_proposals, iou_thresh=iou_threshold)

        # Sort products visually from left-to-right, top-to-bottom for natural numbering
        clean_boxes.sort(key=lambda b: (round(b["y"] / 80.0), b["x"]))

        # Assign 1-based sequential product numbers
        for idx, box in enumerate(clean_boxes, start=1):
            box["product_index"] = idx

        return clean_boxes

    def detect_products_deep(self, image_np, conf_threshold: float = 0.12, iou_threshold: float = 0.35) -> list:
        """
        Deep multi-pass re-analysis to detect all products, including small, shadowed,
        or low-contrast items that might be missed in standard single-pass mode.
        """
        if image_np is None or image_np.size == 0:
            return []

        h, w = image_np.shape[:2]
        all_proposals = []

        # Pass 1: Standard AI inference at lower confidence threshold
        proposals_p1 = self.detect_products(image_np, conf_threshold=conf_threshold, iou_threshold=iou_threshold)
        all_proposals.extend(proposals_p1)

        # Pass 2: Contrast-boosted (CLAHE) inference to catch shadowed or metallic items
        if self.session is not None:
            try:
                lab = cv2.cvtColor(image_np, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
                enhanced_l = clahe.apply(l)
                enhanced_bgr = cv2.cvtColor(cv2.merge((enhanced_l, a, b)), cv2.COLOR_LAB2BGR)

                resized = cv2.resize(enhanced_bgr, (320, 320), interpolation=cv2.INTER_LINEAR)
                norm = (resized.astype(np.float32) - self.mean) / self.std
                blob = np.expand_dims(np.transpose(norm, (2, 0, 1)), axis=0).astype(np.float32)
                scale_factor = np.array([[320.0 / float(h), 320.0 / float(w)]], dtype=np.float32)

                outs = self.session.run(None, {'image': blob, 'scale_factor': scale_factor})[0]
                valid = outs[(outs[:, 1] >= conf_threshold) & (outs[:, 0] > -1)]

                for b in valid:
                    cid = int(b[0])
                    conf = float(b[1])
                    label = self.labels[cid] if cid < len(self.labels) else "Product"

                    x1 = max(0, min(w - 1, int(round(b[2]))))
                    y1 = max(0, min(h - 1, int(round(b[3]))))
                    x2 = max(0, min(w - 1, int(round(b[4]))))
                    y2 = max(0, min(h - 1, int(round(b[5]))))

                    bw = x2 - x1
                    bh = y2 - y1

                    if bw < 15 or bh < 15:
                        continue
                    if bw >= w * 0.98 and bh >= h * 0.98:
                        continue

                    all_proposals.append({
                        "x": x1,
                        "y": y1,
                        "width": bw,
                        "height": bh,
                        "confidence": round(conf, 3),
                        "source": "ai",
                        "label": label
                    })
            except Exception as e:
                pass

        # Pass 3: Multi-threshold contour and edge analysis for non-standard physical products
        try:
            contour_boxes = self._detect_salient_products_multi_threshold(image_np)
            all_proposals.extend(contour_boxes)
        except Exception:
            pass

        # Class-agnostic NMS to merge all candidate proposals
        clean_boxes = self._class_agnostic_nms(all_proposals, iou_thresh=iou_threshold)
        clean_boxes.sort(key=lambda b: (round(b["y"] / 80.0), b["x"]))

        for idx, box in enumerate(clean_boxes, start=1):
            box["product_index"] = idx

        return clean_boxes

    def _detect_salient_products_multi_threshold(self, image_np) -> list:
        """Adaptive multi-threshold contour extractor for physical objects on tables/cloth."""
        h, w = image_np.shape[:2]
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)

        scale = 320.0 / max(h, w)
        sw, sh = int(w * scale), int(h * scale)
        small_gray = cv2.resize(gray, (sw, sh), interpolation=cv2.INTER_AREA)

        inv_scale = 1.0 / scale
        min_area = (sw * sh) * 0.008  # sensitive to smaller products
        max_area = (sw * sh) * 0.85

        proposals = []

        # Run both Otsu threshold and Adaptive threshold
        _, otsu = cv2.threshold(small_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(small_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 3)

        combined = cv2.bitwise_or(otsu, adaptive)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_area <= area <= max_area:
                x, y, cw, ch = cv2.boundingRect(cnt)
                orig_x = max(0, min(w - 1, int(x * inv_scale)))
                orig_y = max(0, min(h - 1, int(y * inv_scale)))
                orig_w = max(1, min(w - orig_x, int(cw * inv_scale)))
                orig_h = max(1, min(h - orig_y, int(ch * inv_scale)))

                if orig_w >= 15 and orig_h >= 15:
                    proposals.append({
                        "x": orig_x,
                        "y": orig_y,
                        "width": orig_w,
                        "height": orig_h,
                        "confidence": 0.45,
                        "source": "ai",
                        "label": "Product"
                    })

        return proposals

    def _detect_salient_products(self, image_np) -> list:
        """Lightweight visual contour detector for physical items on a surface."""
        h, w = image_np.shape[:2]
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        
        # Resize to 320 max dimension for 1ms fast edge detection
        scale = 320.0 / max(h, w)
        sw, sh = int(w * scale), int(h * scale)
        small_gray = cv2.resize(gray, (sw, sh), interpolation=cv2.INTER_AREA)

        blurred = cv2.GaussianBlur(small_gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 40, 120)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        proposals = []

        inv_scale = 1.0 / scale
        min_area = (sw * sh) * 0.015
        max_area = (sw * sh) * 0.85

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_area <= area <= max_area:
                x, y, cw, ch = cv2.boundingRect(cnt)
                # Map back to original image
                orig_x = max(0, min(w - 1, int(x * inv_scale)))
                orig_y = max(0, min(h - 1, int(y * inv_scale)))
                orig_w = max(1, min(w - orig_x, int(cw * inv_scale)))
                orig_h = max(1, min(h - orig_y, int(ch * inv_scale)))

                proposals.append({
                    "x": orig_x,
                    "y": orig_y,
                    "width": orig_w,
                    "height": orig_h,
                    "confidence": 0.50,
                    "source": "ai",
                    "label": "Product"
                })
        return proposals

    def _class_agnostic_nms(self, boxes: list, iou_thresh: float = 0.40) -> list:
        """Eliminates overlapping duplicate boxes across any classes."""
        if not boxes:
            return []

        # Sort descending by confidence
        sorted_boxes = sorted(boxes, key=lambda b: b.get("confidence", 0.0), reverse=True)
        keep = []

        for b in sorted_boxes:
            x1 = b["x"]
            y1 = b["y"]
            x2 = b["x"] + b["width"]
            y2 = b["y"] + b["height"]
            area_b = b["width"] * b["height"]

            if area_b <= 0:
                continue

            duplicate = False
            for k in keep:
                kx1 = k["x"]
                ky1 = k["y"]
                kx2 = k["x"] + k["width"]
                ky2 = k["y"] + k["height"]
                area_k = k["width"] * k["height"]

                ix1 = max(x1, kx1)
                iy1 = max(y1, ky1)
                ix2 = min(x2, kx2)
                iy2 = min(y2, ky2)
                inter_w = max(0, ix2 - ix1)
                inter_h = max(0, iy2 - iy1)
                inter = inter_w * inter_h

                if inter > 0:
                    union = area_b + area_k - inter
                    iou = inter / float(union) if union > 0 else 0.0
                    # Also check containment (one box inside another)
                    containment = inter / float(min(area_b, area_k))
                    if iou > iou_thresh or containment > 0.80:
                        duplicate = True
                        break

            if not duplicate:
                keep.append(b)

        return keep

    @staticmethod
    def check_image_quality(image_np) -> dict:
        """
        Assesses image quality on CPU in < 5ms:
        - Blur detection (Laplacian variance)
        - Brightness / exposure (mean pixel intensity)
        - Resolution adequacy
        Returns:
            {
                "is_acceptable": bool,
                "warning": str or None,
                "blur_score": float,
                "brightness": float,
                "width": int,
                "height": int
            }
        """
        if image_np is None or image_np.size == 0:
            return {"is_acceptable": False, "warning": "Corrupt or empty image", "blur_score": 0, "brightness": 0}

        h, w = image_np.shape[:2]
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np

        # Blur check via Laplacian variance
        blur_val = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        mean_brightness = float(np.mean(gray))

        warning = None
        if min(w, h) < 320:
            warning = "Low resolution image. May reduce product detection accuracy."
        elif blur_val < 50.0:
            warning = "Image may be blurry. Retake recommended for clearer product detection."
        elif mean_brightness < 30.0:
            warning = "Image is very dark. Better lighting recommended."
        elif mean_brightness > 230.0:
            warning = "Image is overexposed / washed out. Retake recommended."

        return {
            "is_acceptable": True,
            "warning": warning,
            "blur_score": round(blur_val, 1),
            "brightness": round(mean_brightness, 1),
            "width": w,
            "height": h
        }
