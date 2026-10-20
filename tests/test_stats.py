import numpy as np
from scipy import stats as ss

from sonicatlas import stats as st

DATA = [4, 5, 5, 6, 6, 6, 7, 8, 9, 14]


def test_mean_median():
    d = st.describe(DATA)
    assert d["mean"] == 7.0
    assert d["median"] == 6.0
    assert d["mode"] == 6.0


def test_variance_n_minus_1():
    assert np.isclose(st.sample_variance(DATA), np.var(DATA, ddof=1))


def test_tukey_quartiles_even():
    q1, med, q3 = st.tukey_quartiles(DATA)
    assert (q1, med, q3) == (5.0, 6.0, 8.0)


def test_tukey_quartiles_odd():
    q1, med, q3 = st.tukey_quartiles([1, 2, 3, 4, 5, 6, 7])
    assert (q1, med, q3) == (2.5, 4.0, 5.5)


def test_g1_g2_match_scipy():
    assert np.isclose(st.skewness_g1(DATA), ss.skew(DATA, bias=False))
    assert np.isclose(st.excess_kurtosis_g2(DATA), ss.kurtosis(DATA, bias=False))


def test_pearson_matches_numpy():
    rng = np.random.default_rng(42)
    x = rng.normal(size=200)
    y = 0.5 * x + rng.normal(size=200)
    assert np.isclose(st.pearson_r(x, y), np.corrcoef(x, y)[0, 1])


def test_cramers_v_perfect():
    t = np.array([[50, 0], [0, 50]])
    chi2 = ss.chi2_contingency(t, correction=False)[0]
    assert np.isclose(st.cramers_v(t, chi2), 1.0)
