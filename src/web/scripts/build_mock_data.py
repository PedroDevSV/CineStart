"""
Genera los datos de ejemplo (mock) del frontend a partir del dataset TMDB 5000
y de los artefactos de features.py.

    python scripts/build_mock_data.py \
        --movies   data/tmdb_5000_movies.csv \
        --credits  data/tmdb_5000_credits.csv \
        --artefactos ruta/a/artefactos            # carpeta de salida de features.py

Escribe src/api/mock/data/catalog.json con una selección del catálogo:
las películas más votadas + una muestra de cola larga bien valorada,
cada una con sus 12 películas más parecidas DENTRO de la selección
(calculadas con los embeddings reales del modelo de contenido).

Solo sirve para que el frontend funcione sin backend. Cuando la API exista,
estos datos dejan de usarse (VITE_USE_MOCKS=false).
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

N_POPULAR = 420
N_LONG_TAIL = 160
MIN_PER_GENRE = 8
N_SIMILAR = 12
TOP_CAST = 5


def parse(v):
    if not isinstance(v, str) or not v.strip():
        return []
    return json.loads(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--movies", required=True)
    ap.add_argument("--credits", required=True)
    ap.add_argument("--artefactos", required=True)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "src/api/mock/data/catalog.json"))
    a = ap.parse_args()

    art = Path(a.artefactos)
    feats = pd.read_parquet(art / "movies_features.parquet")
    emb = np.load(art / "embeddings.npy")
    pos = {mid: i for i, mid in enumerate(feats["id"])}

    m = pd.read_csv(a.movies)
    c = pd.read_csv(a.credits).rename(columns={"movie_id": "id"})[["id", "cast"]]
    m = m.merge(c, on="id").merge(
        feats[["id", "director", "weighted_rating", "long_tail", "cluster_id"]], on="id"
    )
    m = m[m["overview"].fillna("").str.len() > 40]
    m["genre_ids"] = m["genres"].map(lambda v: [g["id"] for g in parse(v)])
    m = m[m["genre_ids"].map(len) > 0]

    popular = m.sort_values("vote_count", ascending=False).head(N_POPULAR)
    tail_pool = m[(m["long_tail"]) & (m["vote_count"] >= 40) & (m["vote_average"] >= 6.6)]
    tail = tail_pool[~tail_pool["id"].isin(popular["id"])].sort_values("vote_average", ascending=False).head(N_LONG_TAIL)
    sel = pd.concat([popular, tail])

    # cada género con un mínimo de películas
    for gid in sorted({g for gs in m["genre_ids"] for g in gs}):
        have = sel["genre_ids"].map(lambda gs: gid in gs).sum()
        if have < MIN_PER_GENRE:
            extra = m[m["genre_ids"].map(lambda gs: gid in gs) & ~m["id"].isin(sel["id"])]
            sel = pd.concat([sel, extra.sort_values("vote_count", ascending=False).head(MIN_PER_GENRE - have)])
    sel = sel.drop_duplicates("id").reset_index(drop=True)

    E = emb[[pos[i] for i in sel["id"]]]
    S = E @ E.T
    np.fill_diagonal(S, -1)
    ids = sel["id"].tolist()

    movies = []
    for i, r in sel.iterrows():
        cast = [p["name"] for p in sorted(parse(r["cast"]), key=lambda p: p.get("order", 99))[:TOP_CAST]]
        similar = [ids[j] for j in np.argsort(-S[i])[:N_SIMILAR]]
        movies.append({
            "id": int(r["id"]),
            "title": r["title"],
            "original_title": r["original_title"] if r["original_title"] != r["title"] else None,
            "release_date": r["release_date"] if isinstance(r["release_date"], str) else None,
            "runtime": int(r["runtime"]) if pd.notna(r["runtime"]) and r["runtime"] > 0 else None,
            "genre_ids": r["genre_ids"],
            "overview": r["overview"],
            "director": r["director"] or None,
            "cast": cast,
            "original_language": r["original_language"],
            "vote_average": round(float(r["vote_average"]), 1),
            "vote_count": int(r["vote_count"]),
            "weighted_rating": round(float(r["weighted_rating"]), 2),
            "long_tail": bool(r["long_tail"]),
            "cluster_id": int(r["cluster_id"]),
            "poster_path": None,  # lo rellena la API de TMDB en la aplicación real
            "similar": similar,
        })

    genres = {}
    for v in m["genres"]:
        for g in parse(v):
            genres[g["id"]] = g["name"]

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"genres": genres, "movies": movies}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(movies)} películas · {len(genres)} géneros · {out.stat().st_size / 1024:.0f} KB -> {out}")


if __name__ == "__main__":
    main()
