export const sortAlphabetically = (a: string, b: string) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

export const sortTemplatesByFavoriteAndName = <T extends { name: string; favorite?: boolean }>(templates: T[]): T[] => {
  return templates.slice().sort((a, b) => {
    // First sort by favorite status (favorites first)
    if (a.favorite && !b.favorite) {
      return -1;
    }
    if (!a.favorite && b.favorite) {
      return 1;
    }
    // Then sort alphabetically within each group
    return sortAlphabetically(a.name, b.name);
  });
};
