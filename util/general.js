import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Pokedex from "pokedex-promise-v2";
import colosseumData from "../additional-data/colosseum.json" assert { type: "json" };
import xdData from "../additional-data/xd.json" assert { type: "json" };
import { Console } from "console";

const pokedex = new Pokedex(),
  collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  }),
  modulePath = path.dirname(fileURLToPath(import.meta.url));

export async function getGenerations() {
  const { results: generationNames } = await pokedex.getGenerationsList(),
    generations = Promise.all(
      generationNames.map(
        async (generationName) =>
          await pokedex.getGenerationByName(generationName?.name)
      )
    );

  return generations;
}

export async function getSideVersions() {
  const { results: versionGroupNames } = await pokedex.getVersionGroupsList(),
    versionGroups = await Promise.all(
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

export async function getNationalPokedex() {
  const nationalDex = await pokedex.getPokedexByName(`national`),
    nationalPokedex = {
      generation: `pokémon home`,
      pokemonPerBox: 30,
      pokemon: nationalDex?.pokemon_entries?.map((entry) => {
        const { pokemon_species: pokemonSpecies, entry_number: entryNumber } =
          entry;

        return {
          name: pokemonSpecies?.name,
          nationalNumber: entryNumber,
        };
      }),
    };

  return nationalPokedex;
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
      previousPokedexLength = nationalPokemon.length,
      pokemonCount = previousPokedexLength + pokemonSpecies.length;

    oldPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString}) [${pokemonCount} pokémon]`,
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
      applicableVersionString = applicableVersions.join(`, `),
      pokemonCount = pokemonSpecies.length;

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    newPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString}) [${pokemonCount} pokémon]`,
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

function constructCustomPokedex(nationalDex, additionalData, generationName) {
  const pokemonCount = additionalData.length,
    additionalPokedex = {
      generation: `${generationName} [${pokemonCount} pokémon]`,
      pokemonPerBox: 30,
      pokemon: additionalData.map((nationalNumbers) => {
        const pokemonArray = nationalNumbers.map(
          (nationalNumber) => nationalDex?.pokemon[nationalNumber - 1]?.name
        );

        return { name: pokemonArray, nationalNumber: nationalNumbers };
      }),
    };

  return additionalPokedex;
}

async function constructAdditionalPokedex(region, generationName) {
  const existingPokedex = await pokedex.getPokedexByName(region),
    pokemonSpecies = existingPokedex?.pokemon_entries.map(
      (entry) => entry?.pokemon_species
    ),
    pokemonCount = pokemonSpecies.length,
    additionalPokedex = {
      generation: `${generationName} [${pokemonCount} pokémon]`,
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

export async function generateAdditionalPokedexes(nationalDex) {
  const colosseumPokedex = constructCustomPokedex(
      nationalDex,
      colosseumData,
      `generation 3 (colosseum)`
    ),
    xdPokedex = constructCustomPokedex(
      nationalDex,
      xdData,
      `generation 3 (xd-gale-of-darkness)`
    ),
    legendsArceusPokedex = await constructAdditionalPokedex(
      `hisui`,
      `generation 8 (legends-arceus)`
    ),
    additionalPokedexes = {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      legendsArceus: legendsArceusPokedex,
    };

  return additionalPokedexes;
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
  const generationThreeIndex = getGenerationSplicePosition(
      pokedexes,
      `emerald`
    ),
    {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      legendsArceus: legendsArceusPokedex,
    } = additionalPokedexes;

  pokedexes.splice(generationThreeIndex, 0, ...[colosseumPokedex, xdPokedex]);

  const generationEightIndex = getGenerationSplicePosition(pokedexes, `sword`);

  pokedexes.splice(generationEightIndex, 0, legendsArceusPokedex);

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
