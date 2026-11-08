"""
CineStart · Motor híbrido de recomendación (contenido + popularidad + reglas).

Usa los artefactos que genera features.py y habla en el mismo idioma que la web:
ids de película de TMDB y géneros por id de TMDB (878 = Ciencia ficción, etc.).

    from motor import Motor
    motor = Motor("artefactos/")            # una sola vez, al arrancar la API

    motor.recomendar(valoraciones={27205: 5, 157336: 4}, descartes=[680],
                     en_lista=[155], generos_fav=[878], n=10)
    motor.similares(27205, n=12)
    motor.onboarding(generos=[878, 53], n=20)
    motor.anadir_pelicula({...})            # película nueva que llega desde TMDB

Fórmula
    score = w_c · parecido + w_p · popularidad + bonus
    w_c = n / (n + 3)     w_p = 3 / (n + 3)     (n = nº de valoraciones del usuario)
    parecido     = coseno entre el perfil del usuario y la película
    popularidad  = nota ponderada normalizada (wr_norm)
    bonus        = +0,05 si es de cola larga · +0,08 si es de un género favorito

Reglas
    1. Fuera lo valorado, lo descartado y lo que está en Mi lista
    2. Máximo 3 películas por género principal
    3. Al menos 2 de cola larga en el top-10
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

VERSION = "content-v1.0"

# --- parámetros (cambiarlos aquí y en ningún otro sitio)
K = 3                   # valoraciones a partir de las cuales pesa más el gusto que la popularidad
BONUS_COLA = 0.05
BONUS_GENERO = 0.08
MAX_POR_GENERO = 3
MIN_COLA_LARGA = 2      # en listas de 10 o más
VOTOS_ONBOARDING = 1200  # en el onboarding solo películas conocidas

# Peso de cada señal en el perfil: 5★ +2 · 4★ +1 · 3★ 0 · 2★ −1 · 1★ −2 · descarte −1
PESO_DESCARTE = -1.0

# Géneros de TMDB: nombre en el CSV -> id que usa la web y la API de TMDB
GENEROS = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35, "Crime": 80,
    "Documentary": 99, "Drama": 18, "Family": 10751, "Fantasy": 14, "Foreign": 10769,
    "History": 36, "Horror": 27, "Music": 10402, "Mystery": 9648, "Romance": 10749,
    "Science Fiction": 878, "TV Movie": 10770, "Thriller": 53, "War": 10752, "Western": 37,
}


class Motor:
    def __init__(self, carpeta_artefactos):
        carpeta = Path(carpeta_artefactos)
        pelis = pd.read_parquet(carpeta / "movies_features.parquet")
        self.E = np.load(carpeta / "embeddings.npy").astype(np.float32)   # filas normalizadas
        self.modelo = joblib.load(carpeta / "model.joblib")              # para películas nuevas

        pelis["genre_ids"] = pelis["genres"].map(lambda gs: [GENEROS[g] for g in gs if g in GENEROS])
        self.ids = pelis["id"].to_numpy()
        self.fila = {int(mid): i for i, mid in enumerate(self.ids)}
        self.genero_principal = pelis["genre_ids"].map(lambda g: g[0] if g else 0).to_numpy()
        self.generos = pelis["genre_ids"].tolist()
        self.popularidad = pelis["wr_norm"].to_numpy(dtype=np.float32)
        self.cola_larga = pelis["long_tail"].to_numpy(dtype=bool)
        self.votos = pelis["vote_count"].to_numpy()
        self.nota = pelis["weighted_rating"].to_numpy(dtype=np.float32)
        self.cluster = pelis["cluster_id"].to_numpy()
        # para colocar películas nuevas en la misma escala
        self._wr_min, self._wr_max = float(self.nota.min()), float(self.nota.max())
        self._mediana_votos = float(np.median(self.votos))

    # ------------------------------------------------------------------ recomendar
    def recomendar(self, valoraciones, descartes=(), en_lista=(), generos_fav=(), n=10, solo_cola_larga=False):
        """
        valoraciones : {movie_id: estrellas 1-5}
        descartes    : ids marcados como «No me interesa»
        en_lista     : ids guardados en Mi lista
        generos_fav  : ids de género elegidos en el onboarding
        Devuelve [{"id": movie_id, "score": float}] ordenado de mejor a peor.
        """
        valoraciones = {int(k): int(v) for k, v in valoraciones.items() if int(k) in self.fila}
        descartes = [int(d) for d in descartes if int(d) in self.fila]

        # 1. perfil del usuario
        señales = [(mid, estrellas - 3) for mid, estrellas in valoraciones.items() if estrellas != 3]
        señales += [(mid, PESO_DESCARTE) for mid in descartes]
        if señales:
            perfil = sum(peso * self.E[self.fila[mid]] for mid, peso in señales)
            norma = float(np.linalg.norm(perfil))
            parecido = self.E @ (perfil / norma) if norma else np.zeros(len(self.E), np.float32)
        else:
            parecido = np.zeros(len(self.E), np.float32)

        # 2. puntuación
        nv = len(valoraciones)
        w_c, w_p = nv / (nv + K), K / (nv + K)
        score = w_c * parecido + w_p * self.popularidad
        score = score + BONUS_COLA * self.cola_larga
        if generos_fav:
            fav = set(int(g) for g in generos_fav)
            score = score + BONUS_GENERO * np.array([bool(fav.intersection(g)) for g in self.generos])

        # 3. reglas
        vistas = set(valoraciones) | set(descartes) | {int(x) for x in en_lista}
        candidatas = [i for i in np.argsort(-score)
                      if int(self.ids[i]) not in vistas and (not solo_cola_larga or self.cola_larga[i])]

        top, por_genero = [], {}
        for i in candidatas:
            g = self.genero_principal[i]
            if por_genero.get(g, 0) < MAX_POR_GENERO:
                top.append(i)
                por_genero[g] = por_genero.get(g, 0) + 1
                if len(top) == n:
                    break

        if not solo_cola_larga and n >= 10:
            # sale la popular con peor score y entra la mejor de cola larga que no rompa el máximo por género
            while int(self.cola_larga[top].sum()) < MIN_COLA_LARGA:
                populares = [i for i in top if not self.cola_larga[i]]
                if not populares:
                    break
                sale = populares[-1]
                por_genero[self.genero_principal[sale]] -= 1
                entra = next((i for i in candidatas if self.cola_larga[i] and i not in top
                              and por_genero.get(self.genero_principal[i], 0) < MAX_POR_GENERO), None)
                if entra is None:
                    por_genero[self.genero_principal[sale]] += 1
                    break
                top[top.index(sale)] = entra
                por_genero[self.genero_principal[entra]] = por_genero.get(self.genero_principal[entra], 0) + 1
            top.sort(key=lambda i: -score[i])

        return [{"id": int(self.ids[i]), "score": round(float(score[i]), 4)} for i in top]

    # ------------------------------------------------------------------ ficha
    def similares(self, movie_id, n=12):
        """Las n películas más parecidas (para «Películas similares» en la ficha)."""
        i = self.fila.get(int(movie_id))
        if i is None:
            return []
        sim = self.E @ self.E[i]
        sim[i] = -1
        return [int(self.ids[j]) for j in np.argsort(-sim)[:n]]

    # ------------------------------------------------------------------ onboarding
    def onboarding(self, generos=(), n=20):
        """~20 películas conocidas y variadas: 2 por cluster, empezando por los clusters
        más cercanos a los géneros elegidos y, dentro de cada uno, las de esos géneros."""
        fav = set(int(g) for g in generos)
        conocidas = np.where(self.votos >= VOTOS_ONBOARDING)[0]

        def encaja(i):
            return bool(fav.intersection(self.generos[i]))

        grupos = {}
        for i in conocidas:
            grupos.setdefault(self.cluster[i], []).append(i)
        for c in grupos:   # dentro del cluster: primero las de sus géneros, luego por nota
            grupos[c].sort(key=lambda i: (not encaja(i), -self.nota[i]))
        afinidad = {c: np.mean([encaja(i) for i in lista]) for c, lista in grupos.items()}
        orden = sorted(grupos, key=lambda c: -afinidad[c])

        elegidas = []
        for c in orden:
            elegidas += grupos[c][:2]
        for c in orden:    # si faltan, una más de los clusters más afines
            if len(elegidas) >= n:
                break
            elegidas += grupos[c][2:3]
        elegidas = elegidas[:n]
        rng = np.random.default_rng(len(elegidas))   # mezcla fija para no agruparlas por cluster
        rng.shuffle(elegidas)
        return [int(self.ids[i]) for i in elegidas]

    # ------------------------------------------------------------------ películas nuevas
    def anadir_pelicula(self, peli):
        """
        Mete en el motor una película que llega desde TMDB al buscarla, sin reentrenar.
        peli: {"id", "title", "overview", "genres": ["Drama", ...], "keywords": [...],
               "director", "top_cast": [...], "vote_average", "vote_count"}
        Las listas usan los nombres en inglés de TMDB, igual que el CSV.
        """
        try:
            from features import build_soup, transform_text
        except ImportError:  # si motor.py está dentro de un paquete
            from .features import build_soup, transform_text

        mid = int(peli["id"])
        if mid in self.fila:
            return
        df = pd.DataFrame([{**{"overview": "", "genres": [], "keywords": [], "director": "",
                               "top_cast": [], "vote_average": 0.0, "vote_count": 0}, **peli}])
        df["soup"] = df.apply(build_soup, axis=1)
        m = self.modelo
        e = m["svd"].transform(transform_text(df, m["soup_vec"], m["over_vec"]))
        e = (e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-12)).astype(np.float32)

        v, r = float(df.at[0, "vote_count"]), float(df.at[0, "vote_average"])
        wr = (v * r + m["m"] * m["C"]) / (v + m["m"])
        wr_norm = min(max((wr - self._wr_min) / (self._wr_max - self._wr_min), 0.0), 1.0)
        gids = [GENEROS[g] for g in df.at[0, "genres"] if g in GENEROS]

        self.E = np.vstack([self.E, e])
        self.ids = np.append(self.ids, mid)
        self.fila[mid] = len(self.ids) - 1
        self.genero_principal = np.append(self.genero_principal, gids[0] if gids else 0)
        self.generos.append(gids)
        self.popularidad = np.append(self.popularidad, np.float32(wr_norm))
        self.cola_larga = np.append(self.cola_larga, v < self._mediana_votos)
        self.votos = np.append(self.votos, int(v))
        self.nota = np.append(self.nota, np.float32(wr))
        self.cluster = np.append(self.cluster, int(m["kmeans"].predict(e.astype(np.float64))[0]))
