/**
 * Películas posteriores al dataset (que acaba en febrero de 2017) que el mock
 * devuelve como si vinieran de la API de TMDB al buscar algo que no está en el catálogo.
 * En la aplicación real esto lo resuelve el backend con /search/movie de TMDB.
 *
 * Sinopsis redactadas para el ejemplo. Sin nota ni votos: el mock no los inventa.
 */
export const TMDB_EXTERNAL = [
  {
    id: 496243,
    title: 'Parasite',
    original_title: '기생충',
    release_date: '2019-05-30',
    runtime: 133,
    genre_ids: [35, 53, 18],
    director: 'Bong Joon-ho',
    cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong', 'Choi Woo-shik', 'Park So-dam'],
    original_language: 'ko',
    overview:
      'Una familia sin trabajo se va colando, uno a uno, en la casa de una familia rica. La convivencia entre ambas acaba destapando todo lo que las separa.',
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    release_date: '2023-07-19',
    runtime: 181,
    genre_ids: [18, 36],
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon', 'Robert Downey Jr.', 'Florence Pugh'],
    original_language: 'en',
    overview:
      'La historia del físico que dirigió el proyecto de la primera bomba atómica y del peso que esa decisión tuvo en su vida.',
  },
  {
    id: 438631,
    title: 'Dune',
    release_date: '2021-09-15',
    runtime: 155,
    genre_ids: [878, 12],
    director: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Rebecca Ferguson', 'Oscar Isaac', 'Zendaya', 'Josh Brolin'],
    original_language: 'en',
    overview:
      'El heredero de una casa noble llega a Arrakis, un planeta desértico del que depende todo el imperio, y se ve atrapado en una guerra por controlarlo.',
  },
  {
    id: 335984,
    title: 'Blade Runner 2049',
    release_date: '2017-10-04',
    runtime: 164,
    genre_ids: [878, 18],
    director: 'Denis Villeneuve',
    cast: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas', 'Sylvia Hoeks', 'Robin Wright'],
    original_language: 'en',
    overview:
      'Treinta años después de la original, un nuevo blade runner descubre un secreto que puede cambiar la relación entre humanos y replicantes.',
  },
  {
    id: 545611,
    title: 'Everything Everywhere All at Once',
    release_date: '2022-03-24',
    runtime: 140,
    genre_ids: [28, 12, 878],
    director: 'Daniel Kwan, Daniel Scheinert',
    cast: ['Michelle Yeoh', 'Ke Huy Quan', 'Stephanie Hsu', 'Jamie Lee Curtis', 'James Hong'],
    original_language: 'en',
    overview:
      'La dueña de una lavandería, desbordada por los impuestos y su familia, descubre que puede conectar con otras versiones de sí misma en universos paralelos.',
  },
  {
    id: 324857,
    title: 'Spider-Man: Into the Spider-Verse',
    release_date: '2018-12-06',
    runtime: 117,
    genre_ids: [16, 28, 12],
    director: 'Bob Persichetti, Peter Ramsey, Rodney Rothman',
    cast: ['Shameik Moore', 'Jake Johnson', 'Hailee Steinfeld', 'Mahershala Ali', 'Liev Schreiber'],
    original_language: 'en',
    overview:
      'Un adolescente de Brooklyn recibe los poderes de una araña y conoce a otras versiones de Spider-Man llegadas de distintas dimensiones.',
  },
  {
    id: 354912,
    title: 'Coco',
    release_date: '2017-10-27',
    runtime: 105,
    genre_ids: [16, 10751, 14],
    director: 'Lee Unkrich',
    cast: ['Anthony Gonzalez', 'Gael García Bernal', 'Benjamin Bratt', 'Alanna Ubach', 'Renée Victor'],
    original_language: 'en',
    overview:
      'Un niño que sueña con ser músico, en una familia que prohíbe la música, acaba en la Tierra de los Muertos buscando a un antepasado.',
  },
  {
    id: 419430,
    title: 'Get Out',
    release_date: '2017-02-24',
    runtime: 104,
    genre_ids: [27, 9648, 53],
    director: 'Jordan Peele',
    cast: ['Daniel Kaluuya', 'Allison Williams', 'Bradley Whitford', 'Catherine Keener', 'LilRel Howery'],
    original_language: 'en',
    overview:
      'Un joven visita por primera vez a la familia de su novia. Lo que parece una acogida cordial esconde algo cada vez más inquietante.',
  },
  {
    id: 475557,
    title: 'Joker',
    release_date: '2019-10-01',
    runtime: 122,
    genre_ids: [80, 53, 18],
    director: 'Todd Phillips',
    cast: ['Joaquin Phoenix', 'Robert De Niro', 'Zazie Beetz', 'Frances Conroy', 'Brett Cullen'],
    original_language: 'en',
    overview:
      'En una ciudad en crisis, un cómico fracasado y aislado va perdiendo el control hasta convertirse en un símbolo del caos.',
  },
].map((m) => ({
  original_title: null,
  vote_average: null,
  vote_count: null,
  weighted_rating: null,
  long_tail: false,
  cluster_id: null,
  poster_path: null,
  similar: [],
  ...m,
  source: 'tmdb',
}));
