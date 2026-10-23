"""Human-typing density model.

The detector learns what *genuine human* sessions look like and scores how atypical a new
session is. It is unsupervised: it is fitted on human sessions only and never sees a bot.

Model: a full-covariance Gaussian mixture (one component per broad typing style) fitted in
the standardised model space. The anomaly score is the negative log-likelihood under the
mixture, so higher means more atypical.

Serving needs only NumPy: the fitted parameters are exported as plain arrays and the
log-likelihood is evaluated here, so there is no pickled object to load and no
scikit-learn dependency or version coupling in production.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Sequence

import numpy as np

_LOG_2PI = float(np.log(2.0 * np.pi))
_MIN_STD = 1e-6


def _logsumexp(a: np.ndarray, axis: int = 1) -> np.ndarray:
    m = np.max(a, axis=axis, keepdims=True)
    return (m + np.log(np.sum(np.exp(a - m), axis=axis, keepdims=True))).squeeze(axis)


@dataclass
class GaussianMixtureDetector:
    """Standardiser + Gaussian mixture, evaluated with NumPy only."""

    feature_names: List[str]
    mean: np.ndarray            # (d,)  standardiser mean
    scale: np.ndarray           # (d,)  standardiser std
    weights: np.ndarray         # (k,)
    means: np.ndarray           # (k, d)
    covariances: np.ndarray     # (k, d, d)
    precisions_cholesky: np.ndarray  # (k, d, d)

    # ------------------------------------------------------------------ fitting
    @classmethod
    def fit(
        cls,
        X: np.ndarray,
        feature_names: Sequence[str],
        n_components: int,
        random_state: int = 0,
        reg_covar: float = 1e-3,
    ) -> "GaussianMixtureDetector":
        """Fit on human-only model-space data ``X`` of shape (n, d)."""
        from sklearn.mixture import GaussianMixture  # training-time dependency only

        mean = X.mean(axis=0)
        scale = np.maximum(X.std(axis=0), _MIN_STD)
        Xs = (X - mean) / scale
        gm = GaussianMixture(
            n_components=n_components,
            covariance_type="full",
            reg_covar=reg_covar,
            n_init=3,
            random_state=random_state,
        ).fit(Xs)
        return cls(
            feature_names=list(feature_names),
            mean=mean,
            scale=scale,
            weights=gm.weights_.copy(),
            means=gm.means_.copy(),
            covariances=gm.covariances_.copy(),
            precisions_cholesky=gm.precisions_cholesky_.copy(),
        )

    # ------------------------------------------------------------------ scoring
    @property
    def n_components(self) -> int:
        return int(len(self.weights))

    def standardise(self, X: np.ndarray) -> np.ndarray:
        return (np.atleast_2d(X) - self.mean) / self.scale

    def _log_component_prob(self, Xs: np.ndarray) -> np.ndarray:
        """log( weight_k * N(x | mean_k, cov_k) ) for every sample/component, shape (n, k)."""
        n, d = Xs.shape
        k = self.n_components
        out = np.empty((n, k))
        for c in range(k):
            prec_chol = self.precisions_cholesky[c]
            y = Xs @ prec_chol - self.means[c] @ prec_chol
            log_det = np.sum(np.log(np.diagonal(prec_chol)))
            out[:, c] = -0.5 * (d * _LOG_2PI + np.sum(y * y, axis=1)) + log_det
        return out + np.log(self.weights)

    def score(self, X: np.ndarray) -> np.ndarray:
        """Anomaly score = -log-likelihood under the human mixture (higher = more atypical)."""
        return -_logsumexp(self._log_component_prob(self.standardise(X)))

    def explain(self, x: np.ndarray, top_k: int = 3) -> List[Dict[str, float]]:
        """Largest standardised deviations from the closest typical-human component.

        Descriptive, not causal: it states which features sit furthest from where a typical
        human of the nearest typing style would be.
        """
        xs = self.standardise(x)
        comp = int(np.argmax(self._log_component_prob(xs)[0]))
        sd = np.sqrt(np.maximum(np.diagonal(self.covariances[comp]), 1e-12))
        z = (xs[0] - self.means[comp]) / sd
        order = np.argsort(-np.abs(z))[:top_k]
        return [{"feature": self.feature_names[j], "z": float(z[j])} for j in order]

    # ------------------------------------------------------------------ persistence
    def to_dict(self) -> Dict[str, object]:
        return {
            "type": "gaussian_mixture",
            "feature_names": list(self.feature_names),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "weights": self.weights.tolist(),
            "means": self.means.tolist(),
            "covariances": self.covariances.tolist(),
            "precisions_cholesky": self.precisions_cholesky.tolist(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "GaussianMixtureDetector":
        if data.get("type") != "gaussian_mixture":
            raise ValueError(f"Unsupported detector type: {data.get('type')!r}")
        return cls(
            feature_names=list(data["feature_names"]),
            mean=np.asarray(data["mean"], dtype=np.float64),
            scale=np.asarray(data["scale"], dtype=np.float64),
            weights=np.asarray(data["weights"], dtype=np.float64),
            means=np.asarray(data["means"], dtype=np.float64),
            covariances=np.asarray(data["covariances"], dtype=np.float64),
            precisions_cholesky=np.asarray(data["precisions_cholesky"], dtype=np.float64),
        )
