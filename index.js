import {
  getGenerations,
  getSideVersions,
  getNationalPokedex,
  getOldPokedexes,
  getNewPokedexes,
  generateFileContents,
  generateMarkdownFile,
} from "./util.js";

const generations = await getGenerations(),
  sideVersions = await getSideVersions(),
  nationalPokedex = await getNationalPokedex(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  newPokedexes = await getNewPokedexes(generations, sideVersions),
  pokedexes = [nationalPokedex, ...oldPokedexes, ...newPokedexes],
  fileContentArray = generateFileContents(pokedexes);

generateMarkdownFile(fileContentArray);
