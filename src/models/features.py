"""
CineStart · Features y popularidad del recomendador de contenido.

Entrada : tmdb_5000_clean.csv (movies + credits ya unidos y limpios)
          o los dos CSV originales de Kaggle
Salida  : carpeta de artefactos con
    movies_features.parquet   una fila por película: id, título, soup, director, cast,
                              géneros, weighted_rating, wr_norm, long_tail, cluster_id
    neighbors_top50.parquet   (movie_id, neighbor_id, similarity, rank)
    embeddings.npy            matriz SVD normalizada (película x dimensiones), mismo orden que movies_features
    model.joblib              vectorizadores, SVD, KMeans y constantes C y m (para películas nuevas)

Uso:
    python features.py --csv tmdb_5000_clean.csv --out artefactos/
    python features.py --csv tmdb_5000_clean.csv --k 12      # fija el nº de clusters en vez de elegirlo por silueta
    python features.py --movies tmdb_5000_movies.csv --credits tmdb_5000_credits.csv   # con los originales
"""
import argparse
import ast
import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize

# ----------------------------------------------------------------- parámetros
W_SOUP, W_OVERVIEW = 0.7, 0.3   # peso de cada bloque de texto
GENRE_REPEAT, DIRECTOR_REPEAT = 2, 3
TOP_CAST = 3
SVD_DIM = 100
TOP_NEIGHBORS = 50
M_QUANTILE = 0.80               # m de la nota ponderada = percentil 80 de vote_count
K_RANGE = range(10, 13)         # candidatos de k para KMeans (10–12, como en la documentación)
SEED = 42


# ----------------------------------------------------------------- carga
def parse_list(value):
    """Columnas TMDB con JSON en texto -> lista de dicts. Tolera nulos y listas ya parseadas."""
    if isinstance(value, list):
        return value
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return ast.literal_eval(value)


def load_movies(movies_path, credits_path=None):
    """movies_path: el CSV limpio (ya trae cast y crew) o el movies original.
    credits_path: solo si se usan los dos CSV originales de Kaggle."""
    df = pd.read_csv(movies_path)
    if credits_path:
        c = pd.read_csv(credits_path).rename(columns={"movie_id": "id"})[["id", "cast", "crew"]]
        df = df.merge(c, on="id", how="left", validate="one_to_one")
    faltan = {"id", "title", "overview", "genres", "keywords", "cast", "crew",
              "vote_average", "vote_count", "status", "release_date"} - set(df.columns)
    if faltan:
        raise SystemExit(f"Al CSV le faltan columnas: {sorted(faltan)}")

    df = df.drop_duplicates("id")
    df = df[df["status"] == "Released"].copy()               # fuera las no estrenadas
    df["genres"] = df["genres"].map(lambda v: [g["name"] for g in parse_list(v)])
    df["keywords"] = df["keywords"].map(lambda v: [k["name"] for k in parse_list(v)])
    crew = df["crew"].map(parse_list)
    df["director"] = crew.map(lambda l: next((p["name"] for p in l if p.get("job") == "Director"), ""))
    df["top_cast"] = df["cast"].map(
        lambda v: [p["name"] for p in sorted(parse_list(v), key=lambda p: p.get("order", 999))[:TOP_CAST]]
    )
    df["overview"] = df["overview"].fillna("")
    df["vote_count"] = df["vote_count"].fillna(0).astype(int)
    df["vote_average"] = df["vote_average"].fillna(0.0)
    return df[["id", "title", "overview", "genres", "keywords", "director", "top_cast",
               "vote_average", "vote_count", "release_date"]].reset_index(drop=True)


# ----------------------------------------------------------------- features
def token(name):
    """'Christopher Nolan' -> 'christophernolan': un nombre propio = una sola palabra."""
    return re.sub(r"[^0-9a-z]", "", name.lower())


def build_soup(row):
    parts = []
    parts += [token(g) for g in row["genres"]] * GENRE_REPEAT
    parts += [token(k) for k in row["keywords"]]
    if row["director"]:
        parts += [token(row["director"])] * DIRECTOR_REPEAT
    parts += [token(a) for a in row["top_cast"]]
    return " ".join(p for p in parts if p)


def fit_text_matrix(df):
    soup_vec = TfidfVectorizer(min_df=2, token_pattern=r"\S+")
    over_vec = TfidfVectorizer(stop_words="english", min_df=2, max_df=0.5, ngram_range=(1, 2))
    X_soup = soup_vec.fit_transform(df["soup"])
    X_over = over_vec.fit_transform(df["overview"])
    X = hstack([X_soup * W_SOUP, X_over * W_OVERVIEW]).tocsr()
    return X, soup_vec, over_vec


def transform_text(df, soup_vec, over_vec):
    """Para películas nuevas: usa los vectorizadores ya entrenados (transform, nunca fit)."""
    return hstack([soup_vec.transform(df["soup"]) * W_SOUP,
                   over_vec.transform(df["overview"]) * W_OVERVIEW]).tocsr()


def top_neighbors(E, ids, k=TOP_NEIGHBORS):
    """E ya normalizada: producto escalar = similitud coseno."""
    S = E @ E.T
    np.fill_diagonal(S, -1.0)
    idx = np.argpartition(-S, k, axis=1)[:, :k]
    rows = []
    for i in range(len(ids)):
        order = idx[i][np.argsort(-S[i, idx[i]])]
        for r, j in enumerate(order, start=1):
            rows.append((ids[i], ids[j], float(S[i, j]), r))
    return pd.DataFrame(rows, columns=["movie_id", "neighbor_id", "similarity", "rank"])


def choose_k(E, k_fixed=None):
    if k_fixed:
        return k_fixed, {}
    scores = {}
    for k in K_RANGE:
        labels = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit_predict(E)
        scores[k] = silhouette_score(E, labels, sample_size=min(3000, len(E)), random_state=SEED)
    return max(scores, key=scores.get), scores


def embed_new_movies(new_df, model, E, ids, k=TOP_NEIGHBORS):
    """Películas que llegan por el buscador. new_df con las mismas columnas que load_movies().
    Devuelve sus vectores, su cluster y sus k vecinos dentro del catálogo, sin reentrenar."""
    new_df = new_df.copy()
    new_df["soup"] = new_df.apply(build_soup, axis=1)
    e = normalize(model["svd"].transform(transform_text(new_df, model["soup_vec"], model["over_vec"])))
    clusters = model["kmeans"].predict(e)
    S = e @ E.T
    rows = []
    for i, mid in enumerate(new_df["id"]):
        order = np.argsort(-S[i])[:k]
        rows += [(mid, ids[j], float(S[i, j]), r) for r, j in enumerate(order, start=1)]
    return e, clusters, pd.DataFrame(rows, columns=["movie_id", "neighbor_id", "similarity", "rank"])


# ----------------------------------------------------------------- popularidad
def popularity(df):
    C = float(df["vote_average"].mean())
    m = float(df["vote_count"].quantile(M_QUANTILE))
    v, R = df["vote_count"], df["vote_average"]
    wr = (v * R + m * C) / (v + m)
    wr_norm = (wr - wr.min()) / (wr.max() - wr.min())
    long_tail = v < v.median()
    return wr.round(4), wr_norm.round(4), long_tail, C, m


# ----------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="CSV limpio con movies + credits ya unidos (tmdb_5000_clean.csv)")
    ap.add_argument("--movies", help="CSV original de películas (si no usas --csv)")
    ap.add_argument("--credits", help="CSV original de créditos (si no usas --csv)")
    ap.add_argument("--out", default="artefactos")
    ap.add_argument("--k", type=int, default=None, help="número de clusters fijo")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    if a.csv:
        df = load_movies(a.csv)
    elif a.movies and a.credits:
        df = load_movies(a.movies, a.credits)
    else:
        ap.error("usa --csv tmdb_5000_clean.csv  (o --movies y --credits con los originales)")
    df["soup"] = df.apply(build_soup, axis=1)

    X, soup_vec, over_vec = fit_text_matrix(df)
    svd = TruncatedSVD(n_components=SVD_DIM, random_state=SEED)
    E = normalize(svd.fit_transform(X))

    k, scores = choose_k(E, a.k)
    kmeans = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(E)
    df["cluster_id"] = kmeans.labels_

    df["weighted_rating"], df["wr_norm"], df["long_tail"], C, m = popularity(df)

    neighbors = top_neighbors(E, df["id"].to_numpy())

    df.drop(columns=["overview"]).to_parquet(out / "movies_features.parquet", index=False)
    neighbors.to_parquet(out / "neighbors_top50.parquet", index=False)
    np.save(out / "embeddings.npy", E.astype(np.float32))
    joblib.dump({"soup_vec": soup_vec, "over_vec": over_vec, "svd": svd, "kmeans": kmeans,
                 "C": C, "m": m, "params": {"W_SOUP": W_SOUP, "W_OVERVIEW": W_OVERVIEW,
                                             "SVD_DIM": SVD_DIM, "k": k}},
                out / "model.joblib")

    print(f"Películas: {len(df)} · matriz TF-IDF: {X.shape} · varianza SVD: {svd.explained_variance_ratio_.sum():.2%}")
    if scores:
        print("Silueta por k:", {kk: round(s, 3) for kk, s in scores.items()}, "-> k =", k)
    print(f"Nota ponderada: C = {C:.2f}, m = {m:.0f} votos · cola larga: {int(df['long_tail'].sum())} películas")
    print("Clusters (tamaño · % de sus películas que tienen cada género):")
    for c, grupo in df.groupby("cluster_id"):
        top = grupo["genres"].explode().value_counts().head(3) / len(grupo)   # % de películas del grupo
        print(f"  {c:>2} · {len(grupo):>4} películas · " + ", ".join(f"{g} {p:.0%}" for g, p in top.items()))
    print("Artefactos en", out.resolve())


if __name__ == "__main__":
    main()
