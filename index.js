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
} from "./util/general.js";

export const root = path.dirname(fileURLToPath(import.meta.url));

const sideVersions = await getSideVersions(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  newPokedexes = await getNewPokedexes(generations, sideVersions),
  additionalPokedexes = await generateAdditionalPokedexes(oldPokedexes);

let pokedexes = [...oldPokedexes, ...newPokedexes, nationalPokedex];

pokedexes = reorganizePokedexes(pokedexes, additionalPokedexes);

const variants = await getVariants();

pokedexes = injectVariants(pokedexes, variants);

pokedexes = countPokemon(pokedexes);

const fileContents = generateFileContents(pokedexes);

generateMarkdownFiles(fileContents);
