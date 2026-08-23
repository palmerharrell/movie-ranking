// Local dev/demo fixture — stands in for the real enriched /data/movies.json
// (produced by scripts/enrich.js) until a TMDb key + Letterboxd export are
// wired up. Not the real data model source of truth.
export const sampleMovies = [
  { id: '1', title: 'Rushmore', year: 1998, decade: '90s', director: 'Wes Anderson', genres: ['Comedy', 'Drama'], cast: ['Jason Schwartzman', 'Bill Murray'] },
  { id: '2', title: 'The Royal Tenenbaums', year: 2001, decade: '00s', director: 'Wes Anderson', genres: ['Comedy', 'Drama'], cast: ['Gene Hackman', 'Bill Murray'] },
  { id: '3', title: 'Moonrise Kingdom', year: 2012, decade: '10s', director: 'Wes Anderson', genres: ['Comedy', 'Romance'], cast: ['Bruce Willis', 'Bill Murray'] },
  { id: '4', title: 'Isle of Dogs', year: 2018, decade: '10s', director: 'Wes Anderson', genres: ['Animation', 'Comedy'], cast: ['Bryan Cranston'] },
  { id: '5', title: 'Fantastic Mr. Fox', year: 2009, decade: '00s', director: 'Wes Anderson', genres: ['Animation', 'Comedy'], cast: ['George Clooney'] },
  { id: '6', title: 'Pulp Fiction', year: 1994, decade: '90s', director: 'Quentin Tarantino', genres: ['Crime', 'Drama'], cast: ['John Travolta', 'Samuel L. Jackson'] },
  { id: '7', title: 'Kill Bill: Vol. 1', year: 2003, decade: '00s', director: 'Quentin Tarantino', genres: ['Action', 'Crime'], cast: ['Uma Thurman'] },
  { id: '8', title: 'Django Unchained', year: 2012, decade: '10s', director: 'Quentin Tarantino', genres: ['Drama', 'Western'], cast: ['Jamie Foxx', 'Samuel L. Jackson'] },
  { id: '9', title: 'Inglourious Basterds', year: 2009, decade: '00s', director: 'Quentin Tarantino', genres: ['Drama', 'War'], cast: ['Brad Pitt'] },
  { id: '10', title: 'Reservoir Dogs', year: 1992, decade: '90s', director: 'Quentin Tarantino', genres: ['Crime', 'Drama'], cast: ['Harvey Keitel'] },
  { id: '11', title: 'The Matrix', year: 1999, decade: '90s', director: 'Lana Wachowski', genres: ['Action', 'Sci-Fi'], cast: ['Keanu Reeves'] },
  { id: '12', title: 'Se7en', year: 1995, decade: '90s', director: 'David Fincher', genres: ['Crime', 'Drama'], cast: ['Brad Pitt', 'Morgan Freeman'] },
  { id: '13', title: 'Fight Club', year: 1999, decade: '90s', director: 'David Fincher', genres: ['Drama'], cast: ['Brad Pitt', 'Edward Norton'] },
  { id: '14', title: 'The Social Network', year: 2010, decade: '10s', director: 'David Fincher', genres: ['Drama', 'Biography'], cast: ['Jesse Eisenberg'] },
  { id: '15', title: 'Gone Girl', year: 2014, decade: '10s', director: 'David Fincher', genres: ['Drama', 'Thriller'], cast: ['Ben Affleck', 'Rosamund Pike'] },
].map((m) => ({ ...m, letterboxdRating: null, liked: false, reviewed: false, posterUrl: null }))
