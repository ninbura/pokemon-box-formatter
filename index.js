import {
  getGenerations,
  getSideVersions,
  getNationalPokedex,
  getOldPokedexes,
  getNewPokedexes,
  generateFileContents,
  generateMarkdownFile,
  generateAdditionalPokedexes,
  reorganizePokedexes,
} from "./util/general.js";

const generations = await getGenerations(),
  sideVersions = await getSideVersions(),
  nationalPokedex = await getNationalPokedex(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  newPokedexes = await getNewPokedexes(generations, sideVersions),
  additionalPokedexes = await generateAdditionalPokedexes(nationalPokedex);

let pokedexes = [nationalPokedex, ...oldPokedexes, ...newPokedexes];

pokedexes = reorganizePokedexes(pokedexes, additionalPokedexes);

const fileContentArray = generateFileContents(pokedexes);

generateMarkdownFile(fileContentArray);
