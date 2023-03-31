import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Pokedex from "pokedex-promise-v2";
import colosseumData from "../additional-data/colosseum.json" assert { type: "json" };
import xdData from "../additional-data/xd.json" assert { type: "json" };
import regionalVariants from "../additional-data/regional-variants.json" assert { type: "json" };
import formExclusions from "../additional-data/form-exclusions.json" assert { type: "json" };
import { extractRegionalVariantName } from "./regex.js";

export const modulePath = path.dirname(fileURLToPath(import.meta.url)),
  pokedex = new Pokedex(),
  collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  }),
  { results: generationNames } = await pokedex?.getGenerationsList(),
  generations = await Promise.all(
    generationNames?.map(
      async (generationName) =>
        await pokedex?.getGenerationByName(generationName?.name)
    )
  ),
  { results: versionGroupNames } = await pokedex?.getVersionGroupsList(),
  { results: pokemonNames } = await pokedex?.getPokemonsList(),
  _nationalPokedex = await pokedex.getPokedexByName(`national`),
  nationalPokedex = {
    generation: `pokémon home`,
    pokemonPerBox: 30,
    pokemon: _nationalPokedex?.pokemon_entries?.map((entry) => {
      const { pokemon_species: pokemonSpecies, entry_number: entryNumber } =
        entry;

      return {
        name: pokemonSpecies?.name,
        nationalNumber: entryNumber,
      };
    }),
  },
  nationalNumbers = Object.assign(
    ...nationalPokedex?.pokemon?.map((pokemon) => {
      return { [pokemon?.name]: pokemon?.nationalNumber };
    })
  );

export async function getSideVersions() {
  const versionGroups = await Promise.all(
      versionGroupNames.map(async (versionGroupName) =>
        pokedex.getVersionGroupByName(versionGroupName?.name)
      )
    ),
    sideVersions = [
      `lets-go-pikachu-lets-go-eevee`,
      `legends-arceus`,
      `the-teal-mask`,
      `the-indigo-disk`,
    ];

  versionGroups.forEach((versionGroup) => {
    if (versionGroup?.pokedexes?.length === 0)
      sideVersions.push(versionGroup.name);
  });

  return sideVersions;
}

function getApplicableVersions(generation, sideVersions) {
  const applicableVersions = [];

  generation?.version_groups.forEach((versionGroup) => {
    const { name: versionGroupName } = versionGroup;

    if (!sideVersions.includes(versionGroupName))
      applicableVersions.push(versionGroupName);
  });

  return applicableVersions;
}

export function getOldPokedexes(generations, sideVersions) {
  const oldPokedexes = [],
    exceptionalVersionsArray = [[`stadium`], [`stadium-2`]];

  for (let index = 0; index < 7; index++) {
    const generation = generations[index],
      { pokemon_species: pokemonSpecies } = generation,
      applicableVersions = getApplicableVersions(generation, sideVersions),
      exceptionalVersions = exceptionalVersionsArray[index];

    if (exceptionalVersions?.length > 0)
      applicableVersions.push(...exceptionalVersions);

    const generationNumber = index + 1,
      applicableVersionString = applicableVersions.join(`, `),
      previousPokedex = oldPokedexes[index - 1]?.pokemon,
      nationalPokemon = previousPokedex ? previousPokedex : [],
      previousPokedexLength = nationalPokemon.length;

    oldPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString})`,
      pokemonPerBox: index <= 1 ? 20 : 30,
      pokemon: [],
    });

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    const generationSpecificPokemon = pokemonSpecies.map(
      (pokemonSpecimen, jndex) => {
        return {
          name: pokemonSpecimen?.name,
          nationalNumber: previousPokedexLength + jndex + 1,
        };
      }
    );

    oldPokedexes[index]?.pokemon.push(
      ...nationalPokemon,
      ...generationSpecificPokemon
    );
  }

  return oldPokedexes;
}

function getPokemonNumber(url) {
  const urlSet = new Set(url.split(`/`)),
    urlArray = [...urlSet],
    pokemonNumber = urlArray.pop();

  return pokemonNumber;
}

export async function getNewPokedexes(generations, sideVersions) {
  const newPokedexes = [];

  for (let index = 7; index < generations.length; index++) {
    const generation = generations[index],
      region = generation?.main_region?.name,
      regionPokedex = await pokedex.getPokedexByName(region),
      pokemonSpecies = regionPokedex?.pokemon_entries.map(
        (entry) => entry?.pokemon_species
      ),
      generationNumber = index + 1,
      applicableVersions = getApplicableVersions(generation, sideVersions),
      applicableVersionString = applicableVersions.join(`, `);

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    newPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString})`,
      pokemonPerBox: 30,
    });

    newPokedexes[index - 7].pokemon = pokemonSpecies.map((specimen) => {
      return {
        name: specimen?.name,
        nationalNumber: getPokemonNumber(specimen?.url),
      };
    });
  }

  return newPokedexes;
}

function generatePokemonDisplayText(pokemon) {
  const { name, nationalNumber } = pokemon;
  let pokemonDisplayText;

  if (Array.isArray(name)) {
    const displayArray = name.map(
      (_name, index) => `${_name} (#${nationalNumber[index]})`
    );

    pokemonDisplayText = displayArray.join(` / `);
  } else {
    pokemonDisplayText = `${pokemon?.name} (#${nationalNumber})`;
  }

  return pokemonDisplayText;
}

function constructCustomPokedex(
  nationalPokedex,
  additionalData,
  generationName
) {
  const additionalPokedex = {
    generation: generationName,
    pokemonPerBox: 30,
    pokemon: additionalData.map((nationalNumbers) => {
      const pokemonArray = nationalNumbers.map(
        (nationalNumber) => nationalPokedex?.pokemon[nationalNumber - 1]?.name
      );

      return { name: pokemonArray, nationalNumber: nationalNumbers };
    }),
  };

  return additionalPokedex;
}

function constructPokemonBox(oldPokedexes) {
  const genThreePokedex = oldPokedexes.find((pokedex) =>
      pokedex?.generation?.match(`emerald`)
    ),
    genThreePokedexCopy = JSON.parse(JSON.stringify(genThreePokedex));

  genThreePokedexCopy.generation = `generation 3 (pokémon box)`;
  genThreePokedexCopy.pokemonPerBox = 60;

  return genThreePokedexCopy;
}

async function constructAdditionalPokedex(region, generationName) {
  const existingPokedex = await pokedex.getPokedexByName(region),
    pokemonSpecies = existingPokedex?.pokemon_entries.map(
      (entry) => entry?.pokemon_species
    ),
    additionalPokedex = {
      generation: generationName,
      pokemonPerBox: 30,
      boxName: `pasture`,
    };
  pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

  additionalPokedex.pokemon = pokemonSpecies.map((specimen) => {
    return {
      name: specimen?.name,
      nationalNumber: getPokemonNumber(specimen?.url),
    };
  });

  return additionalPokedex;
}

export async function generateAdditionalPokedexes(oldPokedexes) {
  const colosseumPokedex = constructCustomPokedex(
      nationalPokedex,
      colosseumData,
      `generation 3 (colosseum)`
    ),
    xdPokedex = constructCustomPokedex(
      nationalPokedex,
      xdData,
      `generation 3 (xd-gale-of-darkness)`
    ),
    pokemonBoxPokedex = constructPokemonBox(oldPokedexes),
    legendsArceusPokedex = await constructAdditionalPokedex(
      `hisui`,
      `generation 8 (legends-arceus)`
    ),
    additionalPokedexes = {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      pokemonBox: pokemonBoxPokedex,
      legendsArceus: legendsArceusPokedex,
    };

  return additionalPokedexes;
}

// export async function getRegionalVariants() {
//   const regionalVariantNames = pokemonNames
//     .filter((pokemonName) =>
//       Object.keys(regionalVariants).includes(
//         extractRegionalVariantName(pokemonName?.name)
//       )
//     )
//     .map((pokemonName) => {
//       const { name } = pokemonName,
//         region = extractRegionalVariantName(name),
//         species = name?.substring(0, name.length - region.length - 1);
//       return {
//         name: name,
//         ...regionalVariants[region],
//         nationalNumber: nationalNumbers[species],
//       };
//     });

//   return regionalVariantNames;
// }

export async function getVariants() {
  const standardPokemon = nationalPokedex?.pokemon?.map(
      (pokemon) => pokemon?.name
    ),
    { forms: excludedForms, pokemon: excludedPokemon } = formExclusions;

  let { results: formsList } = await pokedex?.getPokemonFormsList();

  formsList = formsList?.filter((form) => {
    const { name } = form;

    return !standardPokemon?.includes(name) && !excludedForms.includes(name);
  });

  let variants = await Promise.all(
    formsList?.map(
      async (form) => await pokedex?.getPokemonFormByName(form?.name)
    )
  );

  variants = variants.filter((variant) => {
    const { is_battle_only, is_mega, pokemon } = variant;

    return (
      !is_battle_only && !is_mega && !excludedPokemon.includes(pokemon?.name)
    );
  });

  variants.sort((a, b) => {
    const pokemonA = standardPokemon.find((pokemon) =>
        a?.pokemon?.name.match(pokemon)
      ),
      pokemonB = standardPokemon.find((pokemon) =>
        b?.pokemon?.name.match(pokemon)
      );

    return collator.compare(
      nationalNumbers[pokemonA],
      nationalNumbers[pokemonB]
    );
  });

  variants.forEach((variant) => console.log(variant?.name));

  return variants;
}

//generation can be partial name
function getGenerationSplicePosition(pokedexes, generation) {
  const [desiredPokedex] = Object.entries(pokedexes).find(
    ([index, pokedex]) => {
      return pokedex?.generation?.match(generation);
    }
  );

  return parseInt(desiredPokedex) + 1;
}

export function reorganizePokedexes(pokedexes, additionalPokedexes) {
  const {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      pokemonBox: pokemonBoxPokedex,
      legendsArceus: legendsArceusPokedex,
    } = additionalPokedexes,
    generationThreeIndex = getGenerationSplicePosition(pokedexes, `emerald`);

  pokedexes.splice(generationThreeIndex, 0, ...[colosseumPokedex, xdPokedex]);

  const xdIndex = getGenerationSplicePosition(pokedexes, `xd-gale`);

  pokedexes.splice(xdIndex, 0, pokemonBoxPokedex);

  const generationEightIndex = getGenerationSplicePosition(pokedexes, `sword`);

  pokedexes.splice(generationEightIndex, 0, legendsArceusPokedex);

  return pokedexes;
}

export function countPokemon(pokedexes) {
  for (const pokedex of pokedexes) {
    const pokemonCount = pokedex?.pokemon?.length;

    pokedex.generation += ` [${pokemonCount} pokémon]`;
  }

  return pokedexes;
}

export function generateFileContents(generationalPokedexes) {
  const fileContents = [];

  generationalPokedexes.forEach((pokedex) => {
    let boxName = pokedex?.boxName,
      currentBox = 1,
      currentBoxPosition = 1;

    boxName = boxName ? boxName : `box`;

    fileContents.push(`- ${pokedex?.generation}`);

    pokedex?.pokemon.forEach((pokemon, index) => {
      if (index === 0 || index % pokedex?.pokemonPerBox === 0) {
        fileContents.push(`    - ${boxName} ${currentBox}`);

        currentBox++;
        currentBoxPosition = 1;
      }

      const pokemonDisplayText = generatePokemonDisplayText(pokemon);

      fileContents.push(`        ${currentBoxPosition}. ${pokemonDisplayText}`);

      currentBoxPosition++;
    });
  });

  return fileContents;
}

export function generateMarkdownFile(fileContentArray) {
  fs.writeFile(
    `./~markdown-file-here~/pokémon box order.md`,
    fileContentArray.join(`\n`),
    (error) => {
      if (error) {
        console.error(error);
      }
    }
  );
}
