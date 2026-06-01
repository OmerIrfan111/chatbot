"""Shared test constants importable by both conftest.py and test modules."""
import numpy as np

FAKE_DIM = 1536
FAKE_EMBEDDING = (np.random.default_rng(42).random(FAKE_DIM)).tolist()
