"""Isolation Forest detector (Liu, Ting and Zhou, 2008), exportable to a NumPy-only serving format.

The original design of this module used an Isolation Forest. It is implemented here the same way as the
production Gaussian mixture: fitted with scikit-learn at training time, exported as plain arrays inside a JSON
bundle, and scored with NumPy only, so there is no pickle to load and no scikit-learn at serving time. That makes
the two detectors directly comparable on identical data (see ``python -m agent4 compare-detectors``) and lets
either one be served by pointing ``AGENT4_MODEL_DIR`` at its bundle directory.

How it scores. An Isolation Forest isolates a point by random axis-parallel splits; anomalies are isolated in few
splits. The anomaly score is ``2 ** (-E[h(x)] / c(psi))``: ``h`` is the number of splits to isolate ``x`` in one
tree, ``E`` averages over the trees, and ``c(psi)`` normalises by the expected depth for ``psi`` samples. Scores
lie in (0, 1) and higher means more atypical, like the mixture's score (a negative log-likelihood).

Optional whitening (``whiten=True``) rotates and rescales the standardised features with PCA before the forest
sees them. Axis-parallel splits cannot express "these two features move together"; whitening lets them, and it is
the variant that does better on this data (see the model-selection report).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import numpy as np

_MIN_STD = 1e-6
_EULER_GAMMA = 0.5772156649015329


def average_path_length(n) -> np.ndarray:
    """c(n): the expected number of splits to isolate a point among ``n`` samples (unsuccessful BST search)."""
    n = np.asarray(n, dtype=np.float64)
    out = np.zeros_like(n)
    out[n == 2] = 1.0
    big = n > 2
    out[big] = 2.0 * (np.log(n[big] - 1.0) + _EULER_GAMMA) - 2.0 * (n[big] - 1.0) / n[big]
    return out


@dataclass
class IsolationForestDetector:
    """Standardiser (+ optional PCA whitening) + Isolation Forest, evaluated with NumPy only."""

    feature_names: List[str]
    mean: np.ndarray                 # (d,)  standardiser mean
    scale: np.ndarray                # (d,)  standardiser std
    whiten: bool
    pca_mean: Optional[np.ndarray]   # (d,)   present when whiten
    pca_components: Optional[np.ndarray]  # (d, d)
    pca_variance: Optional[np.ndarray]    # (d,)
    c_psi: float                     # c(max_samples): normaliser of the path length
    # Trees, padded to the same length (T trees x M nodes). A leaf has feature -1 and points to itself.
    feature: np.ndarray              # (T, M) int   column of the model-space feature to test, -1 at a leaf
    threshold: np.ndarray            # (T, M) float split value: go left when value <= threshold
    left: np.ndarray                 # (T, M) int
    right: np.ndarray                # (T, M) int
    leaf_path: np.ndarray            # (T, M) float depth of the leaf + c(samples that reached it)
    n_nodes: np.ndarray              # (T,)  real (unpadded) node count of each tree
    max_depth: int

    # ------------------------------------------------------------------ fitting
    @classmethod
    def fit(
        cls,
        X: np.ndarray,
        feature_names: Sequence[str],
        n_estimators: int = 100,
        max_samples: int = 256,
        whiten: bool = False,
        random_state: int = 0,
    ) -> "IsolationForestDetector":
        """Fit on human-only model-space data ``X`` of shape (n, d)."""
        from sklearn.decomposition import PCA  # training-time dependencies only
        from sklearn.ensemble import IsolationForest

        mean = X.mean(axis=0)
        scale = np.maximum(X.std(axis=0), _MIN_STD)
        Xs = (X - mean) / scale
        pca_mean = pca_components = pca_variance = None
        if whiten:
            pca = PCA(whiten=True, random_state=0).fit(Xs)
            pca_mean, pca_components, pca_variance = pca.mean_.copy(), pca.components_.copy(), pca.explained_variance_.copy()
            Z = (Xs - pca_mean) @ pca_components.T / np.sqrt(pca_variance)
        else:
            Z = Xs
        forest = IsolationForest(n_estimators=n_estimators, max_samples=max_samples, random_state=random_state).fit(Z)

        trees = [_export_tree(est, np.asarray(features)) for est, features in zip(forest.estimators_, forest.estimators_features_)]
        width = max(len(t["feature"]) for t in trees)

        def pad(key, dtype, fill):
            out = np.full((len(trees), width), fill, dtype=dtype)
            for i, t in enumerate(trees):
                out[i, : len(t[key])] = t[key]
            return out

        return cls(
            feature_names=list(feature_names), mean=mean, scale=scale, whiten=whiten,
            pca_mean=pca_mean, pca_components=pca_components, pca_variance=pca_variance,
            c_psi=float(average_path_length([forest.max_samples_])[0]),
            feature=pad("feature", np.int32, -1), threshold=pad("threshold", np.float64, 0.0),
            left=pad("left", np.int32, 0), right=pad("right", np.int32, 0), leaf_path=pad("leaf_path", np.float64, 0.0),
            n_nodes=np.array([len(t["feature"]) for t in trees], dtype=np.int64),
            max_depth=int(max(t["depth"] for t in trees)),
        )

    # ------------------------------------------------------------------ scoring
    @property
    def n_trees(self) -> int:
        return int(self.feature.shape[0])

    def standardise(self, X: np.ndarray) -> np.ndarray:
        return (np.atleast_2d(X) - self.mean) / self.scale

    def _model_space(self, X: np.ndarray) -> np.ndarray:
        Xs = self.standardise(X)
        if self.whiten:
            Xs = (Xs - self.pca_mean) @ self.pca_components.T / np.sqrt(self.pca_variance)
        return Xs

    def mean_path_length(self, X: np.ndarray, batch: int = 4096) -> np.ndarray:
        """E[h(x)]: the average number of splits to isolate each row, over all trees."""
        # scikit-learn evaluates splits on float32 copies of the data; doing the same keeps every comparison
        # (and therefore every score) identical to the fitted model's.
        Z = self._model_space(X).astype(np.float32)
        out = np.empty(Z.shape[0])
        for start in range(0, Z.shape[0], batch):
            out[start:start + batch] = self._mean_path_length_batch(Z[start:start + batch])
        return out

    def _mean_path_length_batch(self, Z: np.ndarray) -> np.ndarray:
        n, trees = Z.shape[0], self.n_trees
        rows = np.arange(n)[:, None]
        tree_ix = np.arange(trees)[None, :]
        node = np.zeros((n, trees), dtype=np.int64)
        for _ in range(self.max_depth + 1):
            feat = self.feature[tree_ix, node]
            at_leaf = feat < 0
            value = Z[rows, np.where(at_leaf, 0, feat)]
            go_left = value <= self.threshold[tree_ix, node]
            step = np.where(go_left, self.left[tree_ix, node], self.right[tree_ix, node])
            node = np.where(at_leaf, node, step)
        return self.leaf_path[tree_ix, node].mean(axis=1)

    def score(self, X: np.ndarray) -> np.ndarray:
        """Anomaly score in (0, 1); higher = more atypical."""
        return np.power(2.0, -self.mean_path_length(X) / self.c_psi)

    def explain(self, x: np.ndarray, top_k: int = 3) -> List[Dict[str, float]]:
        """Features that sit furthest from the typical human, in standard deviations.

        A forest has no per-feature likelihood, so this is simply the standardised distance from the genuine-human
        training mean. Descriptive, not causal: it names the features that look most unlike a typical human.
        """
        z = self.standardise(x)[0]
        order = np.argsort(-np.abs(z))[:top_k]
        return [{"feature": self.feature_names[j], "z": float(z[j])} for j in order]

    # ------------------------------------------------------------------ persistence
    def to_dict(self) -> Dict[str, object]:
        # Only the real nodes of each tree are written (the padding is rebuilt on load).
        real = [int(k) for k in self.n_nodes]
        return {
            "type": "isolation_forest",
            "feature_names": list(self.feature_names),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "whiten": bool(self.whiten),
            "pca_mean": None if self.pca_mean is None else self.pca_mean.tolist(),
            "pca_components": None if self.pca_components is None else self.pca_components.tolist(),
            "pca_variance": None if self.pca_variance is None else self.pca_variance.tolist(),
            "c_psi": self.c_psi,
            "max_depth": self.max_depth,
            "trees": [
                {
                    "feature": self.feature[i, : real[i]].tolist(),
                    "threshold": self.threshold[i, : real[i]].tolist(),
                    "left": self.left[i, : real[i]].tolist(),
                    "right": self.right[i, : real[i]].tolist(),
                    "leaf_path": self.leaf_path[i, : real[i]].tolist(),
                }
                for i in range(self.n_trees)
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "IsolationForestDetector":
        if data.get("type") != "isolation_forest":
            raise ValueError(f"Unsupported detector type: {data.get('type')!r}")
        trees = data["trees"]
        if not trees:
            raise ValueError("The Isolation Forest has no trees.")
        width = max(len(t["feature"]) for t in trees)

        def pad(key, dtype, fill):
            out = np.full((len(trees), width), fill, dtype=dtype)
            for i, t in enumerate(trees):
                out[i, : len(t[key])] = t[key]
            return out

        whiten = bool(data["whiten"])
        arrays = {k: (np.asarray(data[k], dtype=np.float64) if data.get(k) is not None else None)
                  for k in ("pca_mean", "pca_components", "pca_variance")}
        if whiten and any(v is None for v in arrays.values()):
            raise ValueError("A whitened Isolation Forest needs its PCA parameters.")
        return cls(
            feature_names=list(data["feature_names"]),
            mean=np.asarray(data["mean"], dtype=np.float64), scale=np.asarray(data["scale"], dtype=np.float64),
            whiten=whiten, pca_mean=arrays["pca_mean"], pca_components=arrays["pca_components"],
            pca_variance=arrays["pca_variance"], c_psi=float(data["c_psi"]),
            feature=pad("feature", np.int32, -1), threshold=pad("threshold", np.float64, 0.0),
            left=pad("left", np.int32, 0), right=pad("right", np.int32, 0), leaf_path=pad("leaf_path", np.float64, 0.0),
            n_nodes=np.array([len(t["feature"]) for t in trees], dtype=np.int64),
            max_depth=int(data["max_depth"]),
        )


def _export_tree(estimator, features_map: np.ndarray) -> Dict[str, object]:
    """One fitted scikit-learn tree as flat arrays. ``features_map`` maps the tree's own feature index to the
    column of the model-space matrix (scikit-learn may feed a tree a permuted feature subset)."""
    tree = estimator.tree_
    left, right = tree.children_left.copy(), tree.children_right.copy()
    is_leaf = left < 0
    depth = np.zeros(tree.node_count, dtype=np.int64)
    stack = [0]
    while stack:
        node = stack.pop()
        if left[node] >= 0:
            depth[left[node]] = depth[right[node]] = depth[node] + 1
            stack += [int(left[node]), int(right[node])]
    own = np.arange(tree.node_count)
    return {
        "feature": np.where(is_leaf, -1, features_map[np.where(is_leaf, 0, tree.feature)]).astype(np.int32),
        "threshold": tree.threshold.astype(np.float64),
        "left": np.where(is_leaf, own, left).astype(np.int32),   # a leaf points to itself
        "right": np.where(is_leaf, own, right).astype(np.int32),
        "leaf_path": np.where(is_leaf, depth + average_path_length(tree.n_node_samples), 0.0),
        "depth": int(depth.max()),
    }
