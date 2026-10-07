import images from './breedImages.json';
export type SubjectImage = { src: string; srcSet: string; source: string; author: string; license: string; licenseUrl: string; subject: string; caption?: string; alt?: string };
export function subjectImage(slug: string): SubjectImage | undefined { return (images as Record<string, SubjectImage>)[slug]; }
