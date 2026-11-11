"""Revisión y limpieza básica de tmdb_5000_merged.csv.

Uso:  python limpieza_basica.py
Salida: informe por pantalla y tmdb_5000_clean.csv (no toca el CSV original).
"""
import pandas as pd

ENTRADA = "tmdb_5000_merged.csv"
SALIDA = "tmdb_5000_clean.csv"

COLUMNAS_JSON = ["genres", "keywords", "production_companies",
                 "production_countries", "spoken_languages", "cast", "crew"]
#En TMDB un 0 en estas columnas significa "dato desconocido", no un valor real
CEROS_DESCONOCIDOS = ["budget", "revenue", "runtime"]

df = pd.read_csv(ENTRADA)

print("=== 1. Tamaño ===")
print(f"{df.shape[0]} filas x {df.shape[1]} columnas\n")

print("=== 2. Tipos de cada columna ===")
print(df.dtypes.to_string(), "\n")

print("=== 3. Nulos por columna ===")
nulos = df.isna().sum()
print(nulos[nulos > 0].to_string() if nulos.any() else "Ninguno", "\n")

print("=== 4. Textos vacíos o solo espacios ===")
texto = df.select_dtypes(include="object")
vacios = texto.apply(lambda c: c.str.strip().eq("").sum())
print(vacios[vacios > 0].to_string() if vacios.any() else "Ninguno", "\n")

print("=== 5. Listas JSON vacías ([]) ===")
print(df[COLUMNAS_JSON].eq("[]").sum().to_string(), "\n")

print("=== 6. Ceros que significan 'desconocido' ===")
print(df[CEROS_DESCONOCIDOS].eq(0).sum().to_string(), "\n")

print("=== 7. Duplicados ===")
print("Filas idénticas:", df.duplicated().sum())
print("ids repetidos:  ", df["id"].duplicated().sum())
print("títulos repetidos (pueden ser películas distintas):", df["title"].duplicated().sum(), "\n")

print("=== 8. Estado de las películas ===")
print(df["status"].value_counts().to_string(), "\n")

# ---------------- Limpieza básica ----------------
limpio = df.drop_duplicates(subset="id").copy()

#Quitar espacios sobrantes y convertir textos vacíos en nulos
for col in limpio.select_dtypes(include="object"):
    limpio[col] = limpio[col].str.strip().replace("", pd.NA)

#Los ceros "desconocidos" pasan a nulo para que no falseen medias
limpio[CEROS_DESCONOCIDOS] = limpio[CEROS_DESCONOCIDOS].replace(0, pd.NA)

#Fecha como fecha de verdad (las inválidas quedan como nulo)
limpio["release_date"] = pd.to_datetime(limpio["release_date"], errors="coerce")

#Columna de ayuda: True si ya se ha estrenado (no se borra ninguna fila)
limpio["released"] = limpio["status"].eq("Released")

limpio.to_csv(SALIDA, index=False, encoding="utf-8")

print("=== Limpieza aplicada ===")
print(f"Filas: {len(df)} -> {len(limpio)}")
print("Nulos después de limpiar:")
print(limpio.isna().sum()[lambda s: s > 0].to_string())
print(f"\nGuardado en {SALIDA}")
