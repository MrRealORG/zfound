import time
from pathlib import Path
import numpy as np

class FastIndexer:
    def __init__(self):
        self.items = []  # List of dicts: {"path", "name", "size", "phash"}
        self.embeddings_matrix = None  # 2D numpy array of shape (N, dim)
        self.dim = 0
        self.is_indexed = False

    def clear(self):
        self.items = []
        self.embeddings_matrix = None
        self.dim = 0
        self.is_indexed = False

    def build(self, items_with_embeddings: list):
        """
        items_with_embeddings: list of tuples: (item_dict, embedding_list)
        """
        valid_items = []
        vectors = []

        for item, emb in items_with_embeddings:
            if emb and len(emb) > 0:
                valid_items.append(item)
                vectors.append(emb)

        if not vectors:
            self.clear()
            return 0

        self.items = valid_items
        self.embeddings_matrix = np.asarray(vectors, dtype=np.float32)
        # Ensure L2 normalization
        norms = np.linalg.norm(self.embeddings_matrix, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-12)
        self.embeddings_matrix = self.embeddings_matrix / norms

        self.dim = int(self.embeddings_matrix.shape[1])
        self.is_indexed = True
        return len(self.items)

    def search(self, query_emb: list, query_phash: str = None, top_k: int = 50, min_score: float = 0.0):
        if not self.is_indexed or self.embeddings_matrix is None or len(self.items) == 0:
            return []

        q_vec = np.asarray(query_emb, dtype=np.float32).reshape(1, -1)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        # Cosine similarity via inner product: range [-1.0, 1.0]
        similarities = np.dot(self.embeddings_matrix, q_vec.T).squeeze(1)

        results = []
        query_val = int(query_phash, 16) if query_phash else None

        for idx, sim in enumerate(similarities):
            item = self.items[idx]
            is_exact = False
            phash_dist = 999

            if query_val is not None and item.get("phash"):
                try:
                    item_val = int(item["phash"], 16)
                    phash_dist = (query_val ^ item_val).bit_count()
                    if phash_dist == 0:
                        is_exact = True
                except Exception:
                    pass

            # Convert cosine similarity to percentage score [0% - 100%]
            # Cosine similarity for vision models typically spans 0.4 to 1.0
            if is_exact:
                score_pct = 100.0
            else:
                # Scale smoothly so identical/very close images show high percentages
                # Normalized mapping: [0.3, 1.0] -> [0%, 100%]
                raw_score = float(sim)
                scaled = max(0.0, min(1.0, (raw_score - 0.2) / 0.8))
                score_pct = round(scaled * 100.0, 1)

            if score_pct >= (min_score * 100.0):
                results.append({
                    "path": item["path"],
                    "name": item["name"],
                    "size": item["size"],
                    "score": score_pct,
                    "raw_cosine": round(float(sim), 4),
                    "is_exact": is_exact,
                    "phash_dist": phash_dist
                })

        # Sort descending by score, exact matches first
        results.sort(key=lambda r: (r["is_exact"], r["score"]), reverse=True)
        return results[:top_k]
