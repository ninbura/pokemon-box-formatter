import fs from "fs";
import Pokedex from "pokedex-promise-v2";

const pokedex = new Pokedex(),
  collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });

async function getGenerations() {
  const { results: generationNames } = await pokedex.getGenerationsList(),
    generations = Promise.all(
      generationNames.map(
        async (generationName) =>
          await pokedex.getGenerationByName(generationName?.name)
      )
    );

  return generations;
}

async function getSideVersions() {
  const { results: versionGroupNames } = await pokedex.getVersionGroupsList(),
    versionGroups = await Promise.all(
      versionGroupNames.map(async (versionGroupName) =>
        pokedex.getVersionGroupByName(versionGroupName?.name)
      )
    ),
    sideVersions = [`lets-go-pikachu-lets-go-eevee`, `legends-arceus`];

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

async function getNationalPokedex() {
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

function getOldPokedexes(generations, sideVersions) {
  const oldPokedexes = [],
    exceptionalVersionsArray = [[`stadium`], [`stadium-2`]];

  for (let index = 0; index < 7; index++) {
    const generation = generations[index],
      applicableVersions = getApplicableVersions(generation, sideVersions),
      exceptionalVersions = exceptionalVersionsArray[index];

    if (exceptionalVersions?.length > 0)
      applicableVersions.push(...exceptionalVersions);

    oldPokedexes.push({
      generation: `generation ${index + 1} (${applicableVersions.join(`, `)})`,
      pokemonPerBox: index <= 1 ? 20 : 30,
      pokemon: [],
    });

    const { pokemon_species: pokemonSpecies } = generation;

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    const previousPokedex = oldPokedexes[index - 1]?.pokemon,
      nationalPokemon = previousPokedex ? previousPokedex : [],
      generationSpecificPokemon = pokemonSpecies.map(
        (pokemonSpecimen, index) => {
          return { name: pokemonSpecimen?.name, nationalNumber: index + 1 };
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

async function getNewPokedexes(generations, sideVersions) {
  const newPokedexes = [];

  for (let index = 7; index < generations.length; index++) {
    const generation = generations[index],
      applicableVersions = getApplicableVersions(generation, sideVersions);

    newPokedexes.push({
      generation: `generation ${index + 1} (${applicableVersions.join(`, `)})`,
      pokemonPerBox: 30,
    });

    const region = generation?.main_region?.name,
      regionPokedex = await pokedex.getPokedexByName(region),
      pokemonSpecies = regionPokedex?.pokemon_entries.map(
        (entry) => entry?.pokemon_species
      );

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    newPokedexes[index - 7].pokemon = pokemonSpecies.map((specimen) => {
      return {
        name: specimen?.name,
        nationalNumber: getPokemonNumber(specimen?.url),
      };
    });
  }

  return newPokedexes;
}

function generateFileContents(generationalPokedexes) {
  const fileContents = [];

  generationalPokedexes.forEach((pokedex) => {
    let currentBox = 1,
      currentBoxPosition = 1;

    fileContents.push(`- ${pokedex?.generation}`);

    pokedex?.pokemon.forEach((pokemon, index) => {
      const pokemonNumber = pokemon?.nationalNumber;

      if (index === 0 || index % pokedex?.pokemonPerBox === 0) {
        fileContents.push(`    - box ${currentBox}`);

        currentBox++;
        currentBoxPosition = 1;
      }

      fileContents.push(
        `        ${currentBoxPosition}. ${pokemon?.name} (#${pokemonNumber})`
      );

      currentBoxPosition++;
    });
  });

  return fileContents;
}

const generations = await getGenerations(),
  sideVersions = await getSideVersions(),
  nationalPokedex = await getNationalPokedex(),
  oldPokedexes = getOldPokedexes(generations, sideVersions),
  newPokedexes = await getNewPokedexes(generations, sideVersions),
  pokedexes = [nationalPokedex, ...oldPokedexes, ...newPokedexes],
  fileContentArray = generateFileContents(pokedexes);

fs.writeFile(`pokémon box order.md`, fileContentArray.join(`\n`), (error) => {
  if (error) {
    console.error(error);
  }
});
