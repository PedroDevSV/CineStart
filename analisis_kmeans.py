"""Gráficos, nota ponderada, cola larga y KMeans sobre tmdb_5000_clean.csv.

Antes:  python limpieza_basica.py
Uso:    python analisis_kmeans.py
Salida: carpeta graficos/ (PNG) y peliculas_clusters.csv
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # guarda los PNG sin abrir ventanas
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize

ENTRADA = "tmdb_5000_clean.csv"
SALIDA = "peliculas_clusters.csv"
GRAFICOS = Path("graficos")
GRAFICOS.mkdir(exist_ok=True)

K_A_PROBAR = range(4, 17)  # valores de k para los gráficos del codo y silueta
K_FINALES = range(10, 13)  # la presentación prevé k entre 10 y 12
COMPONENTES_SVD = 100
SEMILLA = 42  # para que salga siempre lo mismo

AZUL = "#2a78d6"
TEXTO = "#52514e"
plt.rcParams.update({
    "figure.dpi": 130,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": "#b5b4ae",
    "axes.labelcolor": TEXTO,
    "xtick.color": TEXTO,
    "ytick.color": TEXTO,
    "axes.grid": True,
    "grid.color": "#e8e7e3",
    "axes.axisbelow": True,
})


def guardar(fig, nombre):
    fig.tight_layout()
    fig.savefig(GRAFICOS / nombre)
    plt.close(fig)
    print("Gráfico:", GRAFICOS / nombre)


def nombres(texto_json):
    """'[{"name": "Action"}, ...]' -> ['Action', ...]"""
    return [x["name"] for x in json.loads(texto_json)]


def directores(crew):
    return [p["name"] for p in json.loads(crew) if p["job"] == "Director"]


def reparto_principal(cast):
    return [p["name"] for p in sorted(json.loads(cast), key=lambda p: p["order"])[:3]]


def una_palabra(lista):
    """'Tom Hanks' -> 'tomhanks', para que el nombre cuente como un solo término."""
    return " ".join(x.lower().replace(" ", "") for x in lista)


# ---------------- Datos ----------------
df = pd.read_csv(ENTRADA, parse_dates=["release_date"])
df = df[df["released"]].copy()
df["generos"] = df["genres"].map(nombres)
print(f"Películas estrenadas: {len(df)}\n")

# Nota ponderada: acerca a la media global las notas con pocos votos
media = df["vote_average"].mean()
m = df["vote_count"].median()
v = df["vote_count"]
df["weighted_rating"] = (v / (v + m) * df["vote_average"] + m / (v + m) * media).round(3)

# Cola larga: películas con menos votos que la mediana
df["long_tail"] = df["vote_count"] < m

# ---------------- Gráficos de exploración ----------------
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.hist(df.loc[df["vote_count"] >= 10, "vote_average"], bins=30, color=AZUL, edgecolor="white")
ax.set(title="Nota media en TMDB (películas con 10 votos o más)", xlabel="Nota", ylabel="Películas")
ax.grid(axis="x", visible=False)
guardar(fig, "1_notas.png")

generos = df["generos"].explode().value_counts().sort_values()
fig, ax = plt.subplots(figsize=(8, 6))
barras = ax.barh(generos.index, generos.values, color=AZUL)
ax.bar_label(barras, padding=3, color=TEXTO)
ax.set(title="Películas por género (una película puede tener varios)", xlabel="Películas")
ax.grid(axis="y", visible=False)
guardar(fig, "2_generos.png")

decadas = (df["release_date"].dt.year // 10 * 10).dropna().astype(int).value_counts().sort_index()
fig, ax = plt.subplots(figsize=(8, 4.5))
barras = ax.bar(decadas.index.astype(str) + "s", decadas.values, color=AZUL)
ax.bar_label(barras, padding=3, color=TEXTO)
ax.set(title="Películas por década de estreno", ylabel="Películas")
ax.grid(axis="x", visible=False)
ax.tick_params(axis="x", labelsize=8)
guardar(fig, "3_decadas.png")

# Cola larga: qué parte de los votos acumulan las películas más votadas
votos = df["vote_count"].sort_values(ascending=False).reset_index(drop=True)
pct_peliculas = (votos.index + 1) / len(votos) * 100
pct_votos = votos.cumsum() / votos.sum() * 100
pct_para_80 = pct_peliculas[(pct_votos >= 80).to_numpy().argmax()]
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(pct_peliculas, pct_votos, color=AZUL, linewidth=2)
ax.scatter([pct_para_80], [80], color=AZUL, s=50, zorder=3, edgecolor="white")
ax.annotate(f"El {pct_para_80:.0f} % de las películas\nacumula el 80 % de los votos",
            (pct_para_80, 80), xytext=(12, -32), textcoords="offset points", color=TEXTO)
ax.set(title="Concentración de los votos", ylim=(0, 102),
       xlabel="% de películas (de más a menos votada)", ylabel="% de los votos acumulados")
guardar(fig, "4_concentracion_votos.png")

# ---------------- Texto de cada película ("sopa") para el KMeans ----------------
sopa = (
    df["genres"].map(lambda t: una_palabra(nombres(t))) + " "
    + df["keywords"].map(lambda t: una_palabra(nombres(t))) + " "
    + df["crew"].map(lambda t: una_palabra(directores(t))) + " "
    + df["cast"].map(lambda t: una_palabra(reparto_principal(t))) + " "
    + df["overview"].fillna("")
)

tfidf = TfidfVectorizer(stop_words="english", max_features=20000, min_df=2)
matriz = tfidf.fit_transform(sopa)
svd = TruncatedSVD(n_components=COMPONENTES_SVD, random_state=SEMILLA)
X = normalize(svd.fit_transform(matriz))
print(f"TF-IDF: {matriz.shape[1]} términos | "
      f"SVD: {COMPONENTES_SVD} componentes, {svd.explained_variance_ratio_.sum():.0%} de la varianza\n")

# ---------------- Elegir k: método del codo y silueta ----------------
inercias, siluetas = {}, {}
for k in K_A_PROBAR:
    modelo = KMeans(n_clusters=k, n_init=10, random_state=SEMILLA).fit(X)
    inercias[k] = modelo.inertia_
    siluetas[k] = silhouette_score(X, modelo.labels_)
    print(f"k={k:2d}  inercia={inercias[k]:8.1f}  silueta={siluetas[k]:.4f}")

for valores, nombre, titulo, eje in [
    (inercias, "5_codo.png", "Método del codo", "Inercia (menos es mejor)"),
    (siluetas, "6_silueta.png", "Coeficiente de silueta", "Silueta (más es mejor)"),
]:
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.plot(list(valores), list(valores.values()), color=AZUL, linewidth=2, marker="o", markersize=7)
    ax.set(title=titulo, xlabel="Número de clusters (k)", ylabel=eje)
    ax.set_xticks(list(valores))
    guardar(fig, nombre)

# ---------------- KMeans final ----------------
k_final = max(K_FINALES, key=siluetas.get)
modelo = KMeans(n_clusters=k_final, n_init=10, random_state=SEMILLA).fit(X)
df["cluster_id"] = modelo.labels_
print(f"\nk elegido: {k_final} (silueta {siluetas[k_final]:.4f})\n")

# Qué hay en cada cluster: géneros más frecuentes y películas más votadas
etiquetas = {}
for c, grupo in df.groupby("cluster_id"):
    principales = grupo["generos"].explode().value_counts().head(2).index.tolist()
    etiquetas[c] = f"{c}: " + " + ".join(principales)
    ejemplos = grupo.nlargest(4, "vote_count")["title"].tolist()
    print(f"Cluster {c:2d} | {len(grupo):4d} películas | {' + '.join(principales)}")
    print("   ", ", ".join(ejemplos))

tamanos = df["cluster_id"].value_counts().sort_values()
fig, ax = plt.subplots(figsize=(9, 5.5))
barras = ax.barh([etiquetas[c] for c in tamanos.index], tamanos.values, color=AZUL)
ax.bar_label(barras, padding=3, color=TEXTO)
ax.set(title="Tamaño de cada cluster y sus dos géneros más frecuentes", xlabel="Películas")
ax.grid(axis="y", visible=False)
guardar(fig, "7_clusters.png")

columnas = ["id", "title", "vote_average", "vote_count", "popularity",
            "weighted_rating", "long_tail", "cluster_id"]
df[columnas].to_csv(SALIDA, index=False, encoding="utf-8")

print(f"\nGuardado en {SALIDA}")
print(f"Cola larga: {df['long_tail'].sum()} películas (menos de {m:.0f} votos)")
print("\nMejor nota ponderada:")
print(df.nlargest(5, "weighted_rating")[["title", "vote_average", "vote_count", "weighted_rating"]].to_string(index=False))
