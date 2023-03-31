import {
  pokedex,
  generations,
  getSideVersions,
  nationalPokedex,
  getOldPokedexes,
  getNewPokedexes,
  generateFileContents,
  generateMarkdownFile,
  generateAdditionalPokedexes,
  reorganizePokedexes,
  countPokemon,
  // getRegionalVariants,
  getVariants,
} from "./util/general.js";

const sideVersions = await getSideVersions(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  newPokedexes = await getNewPokedexes(generations, sideVersions),
  additionalPokedexes = await generateAdditionalPokedexes(oldPokedexes);

let pokedexes = [nationalPokedex, ...oldPokedexes, ...newPokedexes];

pokedexes = reorganizePokedexes(pokedexes, additionalPokedexes);
pokedexes = countPokemon(pokedexes);

// const regionalVariants = await getRegionalVariants(nationalPokedex);
const otherVariants = await getVariants();

process.exit();

const fileContentArray = generateFileContents(pokedexes);

generateMarkdownFile(fileContentArray);
