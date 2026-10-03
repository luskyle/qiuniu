export function getAvailableScoreFileName(
  existingNames: Iterable<string>
): string {
  const existing = new Set(
    [...existingNames].map((name) => name.toLocaleLowerCase())
  );
  let suffix = 1;
  while (true) {
    const fileName =
      suffix === 1 ? "Untitled.music" : `Untitled ${suffix}.music`;
    if (!existing.has(fileName.toLocaleLowerCase())) {
      return fileName;
    }
    suffix += 1;
  }
}
