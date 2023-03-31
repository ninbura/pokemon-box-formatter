import path from "path";
import { fileURLToPath } from "url";

import {
  pokedex,
  generations,
  getSideVersions,
  nationalPokedex,
  getOldPokedexes,
  getNewPokedexes,
  generateFileContents,
  generateAdditionalPokedexes,
  reorganizePokedexes,
  countPokemon,
  getVariants,
  injectVariants,
  generateMarkdownFiles,
  getCompatiblePokemon,
  deleteExistingMarkdownFiles,
} from "./util/general.js";

// console.log(await pokedex.getPokedexList());

// process.exit();

export const root = path.dirname(fileURLToPath(import.meta.url));

const sideVersions = await getSideVersions(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  compatiblePokemon = getCompatiblePokemon(),
  newPokedexes = await getNewPokedexes(
    generations,
    sideVersions,
    compatiblePokemon
  ),
  additionalPokedexes = await generateAdditionalPokedexes(oldPokedexes);

let pokedexes = [...oldPokedexes, ...newPokedexes, nationalPokedex];

pokedexes = reorganizePokedexes(pokedexes, additionalPokedexes);

const variants = await getVariants();

pokedexes = injectVariants(pokedexes, variants);

pokedexes = countPokemon(pokedexes);

const fileContents = generateFileContents(pokedexes);

deleteExistingMarkdownFiles();
generateMarkdownFiles(fileContents);
