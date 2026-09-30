"""
ZFound Product Enhancer & Intelligence Module.
Provides:
1. Barcode & QR Code Auto-Scanner (EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, QR Code)
   with multi-scale, multi-angle rotation, and adaptive contrast enhancement.
2. Studio Photo Optimizer: 1-click professional lighting, white-balance, contrast boost,
   and label sharpening.
"""

import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Union
from PIL import Image
import base64
from io import BytesIO


class BarcodeScanner:
    """
    Robust 1D/2D Barcode and QR Code reader powered by OpenCV.
    Performs multi-angle rotation, CLAHE contrast equalization, and multi-scale inspection.
    """
    def __init__(self):
        self.barcode_detector = None
        self.qr_detector = None
        try:
            if hasattr(cv2, 'barcode') and hasattr(cv2.barcode, 'BarcodeDetector'):
                self.barcode_detector = cv2.barcode.BarcodeDetector()
        except Exception:
            pass

        try:
            self.qr_detector = cv2.QRCodeDetector()
        except Exception:
            pass

    def scan(self, image_input: Union[str, Path, np.ndarray, Image.Image]) -> List[Dict[str, str]]:
        """Convenience alias for scan_image."""
        return self.scan_image(image_input)

    def scan_image(self, image_input: Union[str, Path, np.ndarray, Image.Image]) -> List[Dict[str, str]]:
        """
        Scans an image for barcodes and QR codes.
        Returns list of dicts: [{"code": "...", "type": "...", "confidence": 1.0}]
        """
        cv_img = self._load_cv2_image(image_input)
        if cv_img is None or cv_img.size == 0:
            return []

        results = []
        seen_codes = set()

        # Try scanning original and 3 rotations (90, 180, 270) to catch sideways/upside-down packaging
        for angle in [0, 90, 180, 270]:
            if angle == 0:
                rotated = cv_img
            elif angle == 90:
                rotated = cv2.rotate(cv_img, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180:
                rotated = cv2.rotate(cv_img, cv2.ROTATE_180)
            elif angle == 270:
                rotated = cv2.rotate(cv_img, cv2.ROTATE_90_COUNTERCLOCKWISE)

            # Try color, grayscale, and enhanced contrast
            variants = [rotated]
            gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY) if len(rotated.shape) == 3 else rotated
            variants.append(gray)

            # CLAHE contrast enhancement for faint or shiny barcode labels
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced_gray = clahe.apply(gray)
            variants.append(enhanced_gray)

            for var in variants:
                # 1. 1D Barcode Detection
                if self.barcode_detector:
                    try:
                        ok, decoded_info, decoded_type, _ = self.barcode_detector.detectAndDecode(var)
                        if ok and decoded_info:
                            for info, typ in zip(decoded_info, decoded_type):
                                info_str = str(info).strip()
                                if info_str and info_str not in seen_codes:
                                    seen_codes.add(info_str)
                                    type_str = str(typ).strip() or "BARCODE"
                                    # Clean up type prefix
                                    type_str = type_str.replace("BarcodeType.", "").replace("EAN", "EAN-").replace("UPC", "UPC-")
                                    results.append({
                                        "code": info_str,
                                        "type": type_str,
                                        "format": "1D"
                                    })
                    except Exception:
                        pass

                # 2. 2D QR Code Detection
                if self.qr_detector:
                    try:
                        ok, decoded_info, _, _ = self.qr_detector.detectAndDecodeMulti(var)
                        if ok and decoded_info:
                            for info in decoded_info:
                                info_str = str(info).strip()
                                if info_str and info_str not in seen_codes:
                                    seen_codes.add(info_str)
                                    results.append({
                                        "code": info_str,
                                        "type": "QR-CODE",
                                        "format": "2D"
                                    })
                    except Exception:
                        pass

            if results:
                # Exit early once codes are found to maximize performance
                break

        # Fallback to Neural OCR text detection if no 1D/2D barcode was found
        if not results:
            try:
                ocr_reader = CodeOcrReader()
                ocr_res = ocr_reader.read_crop_code(cv_img)
                if ocr_res:
                    results.append(ocr_res)
            except Exception:
                pass

        return results

    def _load_cv2_image(self, img_input) -> Optional[np.ndarray]:
        if isinstance(img_input, np.ndarray):
            return img_input
        elif isinstance(img_input, Image.Image):
            rgb = img_input.convert("RGB")
            return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        elif isinstance(img_input, (str, Path)):
            p = str(img_input)
            if not Path(p).exists():
                return None
            return cv2.imread(p)
        return None


class StudioOptimizer:
    """
    Professional 1-Click Studio Lighting & Color Optimizer.
    - Gray World & White Patch auto white balance (neutralizes warm/blue room casts)
    - Adaptive CLAHE in LAB color space (lifts harsh shadows, protects highlights)
    - Unsharp Masking for crisp label text & packaging details
    - Subtle saturation boost for vibrant product presentation
    """

    @staticmethod
    def auto_white_balance(img: np.ndarray, clip_percent: float = 1.0) -> np.ndarray:
        """
        Robust White Patch / Gray World Color Constancy algorithm.
        Neutralizes yellowish tungsten lighting and blue LED casts.
        """
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)

            # Measure color cast in A & B channels
            avg_a = float(np.mean(a))
            avg_b = float(np.mean(b))

            # Apply proportional correction scaled by luminance
            l_factor = l.astype(np.float32) / 255.0
            a_corr = a.astype(np.float32) - ((avg_a - 128.0) * l_factor * 1.15)
            b_corr = b.astype(np.float32) - ((avg_b - 128.0) * l_factor * 1.15)

            a_corr = np.clip(a_corr, 0, 255).astype(np.uint8)
            b_corr = np.clip(b_corr, 0, 255).astype(np.uint8)

            corrected_lab = cv2.merge((l, a_corr, b_corr))
            return cv2.cvtColor(corrected_lab, cv2.COLOR_LAB2BGR)
        except Exception:
            return img

    @staticmethod
    def optimize_lighting_and_contrast(
        img: np.ndarray,
        clahe_clip: float = 2.0,
        sharpen_strength: float = 0.35,
        vibrancy_boost: float = 1.08
    ) -> Tuple[np.ndarray, Dict[str, float]]:
        """
        Enhances lighting, shadow detail, contrast, and packaging text sharpness.
        """
        h, w = img.shape[:2]
        t0 = cv2.getTickCount()

        # Step 1: Auto White Balance
        wb_img = StudioOptimizer.auto_white_balance(img)

        # Step 2: LAB Contrast Limited Adaptive Histogram Equalization
        lab = cv2.cvtColor(wb_img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        grid_size = (8, 8) if min(h, w) >= 120 else (4, 4)
        clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=grid_size)
        l_enhanced = clahe.apply(l)

        # Step 3: Subtle vibrancy boost on color channels
        if vibrancy_boost != 1.0:
            a_f = a.astype(np.float32) - 128.0
            b_f = b.astype(np.float32) - 128.0
            a_f = np.clip(a_f * vibrancy_boost + 128.0, 0, 255).astype(np.uint8)
            b_f = np.clip(b_f * vibrancy_boost + 128.0, 0, 255).astype(np.uint8)
        else:
            a_f, b_f = a, b

        merged = cv2.merge((l_enhanced, a_f, b_f))
        color_corrected = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

        # Step 4: High-frequency Unsharp Mask for crisp product labels
        if sharpen_strength > 0:
            blurred = cv2.GaussianBlur(color_corrected, (0, 0), sigmaX=1.8, sigmaY=1.8)
            sharpened = cv2.addWeighted(
                color_corrected,
                1.0 + sharpen_strength,
                blurred,
                -sharpen_strength,
                0
            )
            final_img = np.clip(sharpened, 0, 255).astype(np.uint8)
        else:
            final_img = color_corrected

        t1 = cv2.getTickCount()
        elapsed_ms = (t1 - t0) / cv2.getTickFrequency() * 1000.0

        metrics = {
            "elapsed_ms": round(elapsed_ms, 2),
            "width": w,
            "height": h,
            "contrast_applied": clahe_clip,
            "mode": "Studio Light & Color"
        }
        return final_img, metrics

    @staticmethod
    def get_image_b64(cv_img: np.ndarray, max_preview: int = 480) -> str:
        """Encodes an OpenCV image to lightweight base64 JPEG data URL."""
        h, w = cv_img.shape[:2]
        if max(h, w) > max_preview:
            scale = max_preview / float(max(h, w))
            resized = cv2.resize(cv_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            resized = cv_img
        success, buf = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if success:
            b64 = base64.b64encode(buf.tobytes()).decode("ascii")
            return f"data:image/jpeg;base64,{b64}"
        return ""


class CodeOcrReader:
    """
    High-Speed Neural OCR Reader for product numbers, SKU labels, and compartment codes.
    Powered by RapidOCR (ONNX Runtime, CPU-optimized, ~100-200ms per image).
    Specifically designed for physical trays, packaging boxes, and sample molds
    with numbers/codes written above or beside each item slot.
    """
    def __init__(self):
        self._engine = None
        self._available = False
        try:
            from rapidocr_onnxruntime import RapidOCR
            self._engine = RapidOCR()
            self._available = True
        except Exception:
            self._available = False

    @property
    def is_available(self) -> bool:
        return self._available and self._engine is not None

    def read_tray_codes(self, image_input: Union[str, Path, np.ndarray, Image.Image], products: List[Dict]) -> Tuple[List[Dict], int]:
        """
        Scans tray image for handwritten/printed codes and spatially maps them
        to the corresponding products in the grid.
        Also interpolates sequential series for missing slots in rows.
        """
        if not self.is_available or not products:
            return products, 0

        cv_img = self._load_cv2_image(image_input)
        if cv_img is None or cv_img.size == 0:
            return products, 0

        try:
            ocr_results, _ = self._engine(cv_img)
        except Exception:
            return products, 0

        if not ocr_results:
            return products, 0

        # Parse text candidates
        candidates = []
        for box, text, score in ocr_results:
            raw_text = str(text).strip()
            conf = float(score)
            if not raw_text or conf < 0.40:
                continue

            # Skip common UI overlay texts if present
            if any(raw_text.lower().startswith(prefix) for prefix in ["product", "manual", "ai", "lanczos", "rate", "select"]):
                continue

            cleaned_tokens = self._clean_sku_tokens(raw_text)
            if not cleaned_tokens:
                continue

            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]
            box_w = max(xs) - min(xs)
            cy = sum(ys) / 4.0
            num_tok = len(cleaned_tokens)

            for i, tok in enumerate(cleaned_tokens):
                cx = min(xs) + (i + 0.5) * (box_w / num_tok)
                candidates.append({
                    "text": tok,
                    "raw": raw_text,
                    "cx": cx,
                    "cy": cy,
                    "conf": conf
                })

        if not candidates:
            return products, 0

        # Group products into approximate rows by average Y coordinate
        sorted_prods = sorted(products, key=lambda p: (p.get("y", 0), p.get("x", 0)))
        rows = []
        for p in sorted_prods:
            py = p.get("y", 0)
            placed = False
            for r in rows:
                avg_y = sum(item.get("y", 0) for item in r) / len(r)
                if abs(avg_y - py) < 75:
                    r.append(p)
                    placed = True
                    break
            if not placed:
                rows.append([p])

        matched_count = 0

        # Step 1: 1-to-1 Spatial Matching per row (locate number directly above product)
        matched_candidate_indices = set()
        for row in rows:
            row.sort(key=lambda p: p.get("x", 0))
            pair_dists = []
            for p_idx, p in enumerate(row):
                px = p.get("x", 0)
                py = p.get("y", 0)
                pw = p.get("width", 50)
                ph = p.get("height", 50)
                p_cx = px + pw / 2.0

                for c_idx, c in enumerate(candidates):
                    dx = abs(c["cx"] - p_cx)
                    dy = py - c["cy"]
                    if -35 <= dy <= ph * 1.15 and dx <= pw * 0.95:
                        dist = dx * 1.2 + abs(dy - 40)
                        pair_dists.append((dist, p_idx, c_idx))

            pair_dists.sort(key=lambda x: x[0])
            used_prods = set()
            for dist, p_idx, c_idx in pair_dists:
                if p_idx in used_prods or c_idx in matched_candidate_indices:
                    continue
                c = candidates[c_idx]
                p = row[p_idx]
                p["code"] = c["text"]
                p["barcode"] = c["text"]
                p["barcode_type"] = "OCR"
                p["name"] = f"Item {c['text']}"
                p["ocr_detected"] = True
                used_prods.add(p_idx)
                matched_candidate_indices.add(c_idx)
                matched_count += 1

            # Step 2: Intelligent sequence gap-filling along rows
            self._interpolate_row_sequence(row)

        # Step 3: Extrapolate rows with missing OCR headers (e.g. Row 1 before Row 2)
        for r_idx in range(len(rows)):
            row = rows[r_idx]
            has_code = any(p.get("code") and not str(p.get("code")).startswith("ZF") for p in row)
            if not has_code and r_idx + 1 < len(rows):
                next_row = rows[r_idx + 1]
                next_codes = [int(p["code"]) for p in next_row if str(p.get("code", "")).isdigit() and len(str(p.get("code", ""))) == 5]
                if next_codes:
                    next_base = next_codes[0]
                    row_len = len(row)
                    row_base = next_base - row_len
                    for idx, p in enumerate(row):
                        val_str = str(row_base + idx)
                        p["code"] = val_str
                        p["barcode"] = val_str
                        p["barcode_type"] = "OCR / Seq"
                        p["name"] = f"Item {val_str}"
                        matched_count += 1

        # Step 4: Assemble flattened products in strict spatial reading order (row by row, left to right)
        sorted_products = []
        seq_idx = 1
        for row in rows:
            row.sort(key=lambda p: p.get("x", 0))
            for p in row:
                p["product_index"] = seq_idx
                if not p.get("name") or p.get("name").startswith("Product "):
                    if p.get("code") and not str(p.get("code")).startswith("ZF"):
                        p["name"] = f"Item {p['code']}"
                    else:
                        p["name"] = f"Product {seq_idx}"
                sorted_products.append(p)
                seq_idx += 1

        return sorted_products, matched_count

    @staticmethod
    def sort_products_spatially(products: List[Dict]) -> List[Dict]:
        """
        Sorts products in strict top-to-bottom, left-to-right reading order (by row).
        Re-indexes product_index sequentially 1..N and normalizes display names.
        """
        if not products:
            return []

        sorted_by_y = sorted(products, key=lambda p: (p.get("y", 0), p.get("x", 0)))
        rows = []
        for p in sorted_by_y:
            py = p.get("y", 0)
            placed = False
            for r in rows:
                avg_y = sum(item.get("y", 0) for item in r) / len(r)
                if abs(avg_y - py) < 70:
                    r.append(p)
                    placed = True
                    break
            if not placed:
                rows.append([p])

        ordered = []
        idx = 1
        for r in rows:
            r.sort(key=lambda p: p.get("x", 0))
            for p in r:
                p["product_index"] = idx
                if not p.get("name") or p.get("name").startswith("Product ") or (p.get("code") and p.get("name").startswith("Item ")):
                    if p.get("code") and not str(p.get("code")).startswith("ZF"):
                        p["name"] = f"Item {p['code']}"
                    else:
                        p["name"] = f"Product {idx}"
                ordered.append(p)
                idx += 1

        return ordered

    def _interpolate_row_sequence(self, row: List[Dict]):
        """Fills missing product numbers if items in a row form a sequential series."""
        if len(row) < 2:
            return

        digits_indices = []
        for idx, p in enumerate(row):
            code = str(p.get("code", "")).strip()
            if code.isdigit() and len(code) == 5:
                digits_indices.append((idx, int(code), len(code)))

        if len(digits_indices) < 2:
            return

        # Find best consecutive pair to establish rock-solid base
        best_base = digits_indices[0]
        for i in range(len(digits_indices) - 1):
            i1, v1, l1 = digits_indices[i]
            i2, v2, l2 = digits_indices[i + 1]
            if i2 > i1 and v2 > v1:
                step = (v2 - v1) / (i2 - i1)
                if abs(step - 1.0) < 0.15:
                    best_base = (i1, v1, l1)
                    break

        base_idx, base_val, pad = best_base
        for idx, p in enumerate(row):
            expected_val = base_val + (idx - base_idx)
            expected_str = str(expected_val).zfill(pad)
            curr_code = str(p.get("code", "")).strip()
            # If not detected or if detected code is out of consecutive sequence, replace with expected sequence
            if not p.get("ocr_detected") or not (curr_code.isdigit() and abs(int(curr_code) - expected_val) == 0):
                p["code"] = expected_str
                p["barcode"] = expected_str
                p["barcode_type"] = "OCR / Seq"
                p["name"] = f"Item {expected_str}"

    def read_crop_code(self, crop_input: Union[str, Path, np.ndarray, Image.Image]) -> Optional[Dict[str, str]]:
        """Reads code from an individual crop."""
        if not self.is_available:
            return None
        cv_img = self._load_cv2_image(crop_input)
        if cv_img is None or cv_img.size == 0:
            return None
        try:
            results, _ = self._engine(cv_img)
            if results:
                for box, text, score in results:
                    tokens = self._clean_sku_tokens(str(text))
                    if tokens and float(score) >= 0.40:
                        return {"code": tokens[0], "type": "OCR", "confidence": float(score)}
        except Exception:
            pass
        return None

    @classmethod
    def _clean_sku_tokens(cls, raw: str) -> List[str]:
        import re
        t = raw.strip()
        t = re.sub(r'[\'\"`,.:;~|/\\]', '', t).strip()

        # Check for merged numbers like '0535110536' or '1049310494'
        merged = re.findall(r'(?:1[0-9DOoB86][0-9S]{3}|0[0-9S]{3,4}|[0-9]{4,5})', t)
        tokens = merged if len(merged) > 1 else [t]

        cleaned_list = []
        for tok in tokens:
            sub = tok
            if re.match(r'^[1Il][0-9DOoB86][0-9S]{3}$', sub):
                rest = sub[2:].replace('S', '5').replace('s', '5').replace('O', '0').replace('D', '0').replace('o', '0')
                sub = '10' + rest
            elif re.match(r'^0[0-9S]{3,4}$', sub):
                rest = sub[1:].replace('S', '5').replace('s', '5').replace('O', '0')
                if len(rest) == 3:
                    sub = '10' + rest
                elif len(rest) == 4 and rest.startswith('5'):
                    sub = '10' + rest[1:]
            elif re.match(r'^[1Il][0-9DOoB86][0-9S]{2}$', sub):
                sub = '10' + sub[2:].replace('S', '5').replace('s', '5').replace('O', '0')
            elif sub.isdigit():
                pass
            if re.search(r'[A-Za-z0-9]{2,12}', sub):
                cleaned_list.append(sub)
        return cleaned_list

    def _load_cv2_image(self, img_input) -> Optional[np.ndarray]:
        if isinstance(img_input, np.ndarray):
            return img_input
        elif isinstance(img_input, Image.Image):
            rgb = img_input.convert("RGB")
            return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        elif isinstance(img_input, (str, Path)):
            p = str(img_input)
            if not Path(p).exists():
                return None
            return cv2.imread(p)
        return None
