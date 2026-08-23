// Local dev/demo fixtures standing in for the real enriched curated-list
// JSON (produced by scripts/enrich-curated.js) until a TMDb key is wired up.
// Content mirrors data/curated-lists/*.source.json.
function withDefaults(movies) {
  return movies.map((m) => ({ ...m, letterboxdRating: null, liked: false, reviewed: false, posterUrl: null }))
}

export const sampleCuratedLists = {
  'top-80s-action': withDefaults([
    { id: '1', title: 'Die Hard', year: 1988, decade: '80s', director: 'John McTiernan', genres: ['Action', 'Thriller'], cast: ['Bruce Willis', 'Alan Rickman'] },
    { id: '2', title: 'The Terminator', year: 1984, decade: '80s', director: 'James Cameron', genres: ['Action', 'Sci-Fi'], cast: ['Arnold Schwarzenegger', 'Linda Hamilton'] },
    { id: '3', title: 'Raiders of the Lost Ark', year: 1981, decade: '80s', director: 'Steven Spielberg', genres: ['Action', 'Adventure'], cast: ['Harrison Ford', 'Karen Allen'] },
    { id: '4', title: 'Rambo: First Blood Part II', year: 1985, decade: '80s', director: 'George P. Cosmatos', genres: ['Action', 'War'], cast: ['Sylvester Stallone'] },
    { id: '5', title: 'Predator', year: 1987, decade: '80s', director: 'John McTiernan', genres: ['Action', 'Sci-Fi'], cast: ['Arnold Schwarzenegger', 'Carl Weathers'] },
    { id: '6', title: 'Lethal Weapon', year: 1987, decade: '80s', director: 'Richard Donner', genres: ['Action', 'Comedy'], cast: ['Mel Gibson', 'Danny Glover'] },
    { id: '7', title: 'RoboCop', year: 1987, decade: '80s', director: 'Paul Verhoeven', genres: ['Action', 'Sci-Fi'], cast: ['Peter Weller', 'Nancy Allen'] },
    { id: '8', title: 'Aliens', year: 1986, decade: '80s', director: 'James Cameron', genres: ['Action', 'Sci-Fi'], cast: ['Sigourney Weaver', 'Michael Biehn'] },
    { id: '9', title: 'Commando', year: 1985, decade: '80s', director: 'Mark L. Lester', genres: ['Action'], cast: ['Arnold Schwarzenegger', 'Rae Dawn Chong'] },
    { id: '10', title: 'Beverly Hills Cop', year: 1984, decade: '80s', director: 'Martin Brest', genres: ['Action', 'Comedy'], cast: ['Eddie Murphy', 'Judge Reinhold'] },
    { id: '11', title: 'Mad Max 2: The Road Warrior', year: 1981, decade: '80s', director: 'George Miller', genres: ['Action', 'Sci-Fi'], cast: ['Mel Gibson'] },
    { id: '12', title: 'First Blood', year: 1982, decade: '80s', director: 'Ted Kotcheff', genres: ['Action', 'Thriller'], cast: ['Sylvester Stallone'] },
    { id: '13', title: 'Big Trouble in Little China', year: 1986, decade: '80s', director: 'John Carpenter', genres: ['Action', 'Comedy'], cast: ['Kurt Russell'] },
    { id: '14', title: 'Cobra', year: 1986, decade: '80s', director: 'George P. Cosmatos', genres: ['Action', 'Crime'], cast: ['Sylvester Stallone'] },
    { id: '15', title: 'Top Gun', year: 1986, decade: '80s', director: 'Tony Scott', genres: ['Action', 'Drama'], cast: ['Tom Cruise', 'Val Kilmer'] },
  ]),
  'top-90s-comedies': withDefaults([
    { id: '1', title: 'Groundhog Day', year: 1993, decade: '90s', director: 'Harold Ramis', genres: ['Comedy', 'Fantasy'], cast: ['Bill Murray', 'Andie MacDowell'] },
    { id: '2', title: 'Dumb and Dumber', year: 1994, decade: '90s', director: 'Peter Farrelly', genres: ['Comedy'], cast: ['Jim Carrey', 'Jeff Daniels'] },
    { id: '3', title: 'The Big Lebowski', year: 1998, decade: '90s', director: 'Joel Coen', genres: ['Comedy', 'Crime'], cast: ['Jeff Bridges', 'John Goodman'] },
    { id: '4', title: "Wayne's World", year: 1992, decade: '90s', director: 'Penelope Spheeris', genres: ['Comedy', 'Music'], cast: ['Mike Myers', 'Dana Carvey'] },
    { id: '5', title: 'Clueless', year: 1995, decade: '90s', director: 'Amy Heckerling', genres: ['Comedy', 'Romance'], cast: ['Alicia Silverstone', 'Paul Rudd'] },
    { id: '6', title: 'Home Alone', year: 1990, decade: '90s', director: 'Chris Columbus', genres: ['Comedy', 'Family'], cast: ['Macaulay Culkin', 'Joe Pesci'] },
    { id: '7', title: 'Mrs. Doubtfire', year: 1993, decade: '90s', director: 'Chris Columbus', genres: ['Comedy', 'Drama'], cast: ['Robin Williams', 'Sally Field'] },
    { id: '8', title: 'Austin Powers: International Man of Mystery', year: 1997, decade: '90s', director: 'Jay Roach', genres: ['Comedy'], cast: ['Mike Myers', 'Elizabeth Hurley'] },
    { id: '9', title: "There's Something About Mary", year: 1998, decade: '90s', director: 'Bobby Farrelly', genres: ['Comedy', 'Romance'], cast: ['Cameron Diaz', 'Ben Stiller'] },
    { id: '10', title: 'Office Space', year: 1999, decade: '90s', director: 'Mike Judge', genres: ['Comedy'], cast: ['Ron Livingston', 'Jennifer Aniston'] },
    { id: '11', title: 'Billy Madison', year: 1995, decade: '90s', director: 'Tamra Davis', genres: ['Comedy'], cast: ['Adam Sandler'] },
    { id: '12', title: 'Tommy Boy', year: 1995, decade: '90s', director: 'Peter Segal', genres: ['Comedy'], cast: ['Chris Farley', 'David Spade'] },
    { id: '13', title: 'The Nutty Professor', year: 1996, decade: '90s', director: 'Tom Shadyac', genres: ['Comedy', 'Sci-Fi'], cast: ['Eddie Murphy'] },
    { id: '14', title: 'Liar Liar', year: 1997, decade: '90s', director: 'Tom Shadyac', genres: ['Comedy', 'Fantasy'], cast: ['Jim Carrey'] },
    { id: '15', title: 'Happy Gilmore', year: 1996, decade: '90s', director: 'Dennis Dugan', genres: ['Comedy', 'Sports'], cast: ['Adam Sandler', 'Christopher McDonald'] },
  ]),
}
